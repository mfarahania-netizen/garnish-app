import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileReadService } from '../behavior-engine/profile/read/profile-read.service';

/**
 * R8 — admin observability "behavioral cabin" ("capture every second"; SEE the loop close). Read-only,
 * PII-CONSCIOUS (ids + derived signals only; allergy VALUES are redacted to a count). It exposes the L0
 * loop end-to-end for one user — event stream → derived signals → profile trace — plus engagement counters
 * (what's trending / which dish has a problem). It is the rebuild's acceptance surface: without it "the loop
 * closes" is unverifiable.
 */
@Injectable()
export class ObservabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfileReadService,
  ) {}

  /** What the user DID — the raw interaction stream (no payload dump). */
  async eventStream(userId: string, limit = 50) {
    const events = await this.prisma.userEvent.findMany({
      where: { userId }, orderBy: { timestamp: 'desc' }, take: Math.min(Math.max(limit, 1), 200),
      select: { id: true, type: true, recipeId: true, page: true, consentPurpose: true, timestamp: true }, // consentPurpose = GDPR provenance per event

    });
    return { userId, count: events.length, events };
  }

  /** What the engine LEARNED — derived taste/behavior signals (e.g. taste.cuisine_affinity=persian). */
  async observations(userId: string, limit = 50) {
    const obs = await this.prisma.signalObservation.findMany({
      where: { userId }, orderBy: { observedAt: 'desc' }, take: Math.min(Math.max(limit, 1), 200),
      select: { signalName: true, dimension: true, value: true, weight: true, confidence: true, recipeId: true, source: true, observedAt: true },
    });
    const byName = new Map<string, { count: number; sumWeight: number; values: Set<string> }>();
    for (const o of obs) {
      const cur = byName.get(o.signalName) || { count: 0, sumWeight: 0, values: new Set<string>() };
      cur.count += 1; cur.sumWeight += o.weight || 0; if (o.value) cur.values.add(o.value);
      byName.set(o.signalName, cur);
    }
    const summary = [...byName.entries()].map(([signalName, v]) => ({ signalName, count: v.count, meanWeight: +(v.sumWeight / v.count).toFixed(2), values: [...v.values] }))
      .sort((a, b) => b.count - a.count);
    return { userId, count: obs.length, summary, recent: obs };
  }

  /** The living-profile trace: declared → observed → reconciled. Allergy VALUES are REDACTED (count only). */
  async profileTrace(userId: string) {
    let p: any;
    try {
      p = await this.profiles.getLivingUserProfile(userId);
    } catch {
      return { userId, error: 'profile_unavailable_fail_closed' };
    }
    const recon: Record<string, any> = {};
    for (const [k, d] of Object.entries<any>(p?.reconciled?.dimensions ?? {})) {
      recon[k] = k === 'allergies'
        ? { status: d?.status, count: Array.isArray(d?.reconciledValue) ? d.reconciledValue.length : 0, safetyCritical: true } // VALUES redacted (sensitive)
        : { status: d?.status, value: d?.reconciledValue, confidence: d?.confidence };
    }
    const observed = p?.observed ?? null;
    return {
      userId,
      consentPurposes: p?.privacy?.consentPurposesUsed ?? null,
      maturity: p?.maturity ?? null,
      observed: observed ? { status: observed.status, overallConfidence: observed.overallConfidence, strongestDimensions: observed.strongestDimensions ?? [] } : null,
      reconciled: recon,
    };
  }

  /** GDPR consent provenance — the user's granular grants (purpose + state + lawful basis), newest first. */
  async consent(userId: string) {
    const consents = await this.prisma.userConsent.findMany({
      where: { userId }, orderBy: { updatedAt: 'desc' }, take: 100,
      select: { purpose: true, status: true, lawfulBasis: true, policyVersion: true, source: true, grantedAt: true, withdrawnAt: true, updatedAt: true },
    }).catch(() => []);
    return { userId, count: consents.length, consents };
  }

  /** Recent AI calls — METADATA ONLY (the log never stores prompt/response text; GDPR shape-only). */
  async aiCalls(userId: string, limit = 30) {
    const calls = await this.prisma.aICallLog.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' }, take: Math.min(Math.max(limit, 1), 100),
      select: { id: true, surface: true, intent: true, model: true, provider: true, status: true, latencyMs: true, estimatedInputTokens: true, estimatedOutputTokens: true, estimatedCost: true, createdAt: true },
    }).catch(() => []);
    return { userId, count: calls.length, calls };
  }

  /** The user's recent support tickets (metadata — the support side of the dossier). */
  async tickets(userId: string, limit = 30) {
    const tickets = await this.prisma.supportTicket.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' }, take: Math.min(Math.max(limit, 1), 100),
      select: { id: true, subject: true, status: true, priority: true, category: true, firstResponseAt: true, lastReplyAt: true, createdAt: true },
    }).catch(() => []);
    return { userId, count: tickets.length, tickets };
  }

  /** Engagement counters — trending dishes + a "problem" list (high views, low cook-through). */
  async counters(opts: { days?: number; limit?: number } = {}) {
    const days = Math.min(Math.max(opts.days ?? 30, 1), 365);
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
    const since = new Date(Date.now() - days * 86_400_000);
    const grouped: any[] = await this.prisma.userEvent.groupBy({
      by: ['type', 'recipeId'], where: { timestamp: { gte: since }, recipeId: { not: null } }, _count: { _all: true },
    } as any);
    const byRecipe = new Map<string, any>();
    for (const g of grouped) {
      const rid = g.recipeId; if (!rid) continue;
      const r = byRecipe.get(rid) || { recipeId: rid, cook: 0, view: 0, favorite: 0, skip: 0 };
      const n = g._count?._all ?? 0;
      if (g.type === 'cook_complete' || g.type === 'recipe_cooked') r.cook += n;
      else if (g.type === 'recipe_view') r.view += n;
      else if (g.type === 'favorite_add') r.favorite += n;
      else if (g.type === 'recipe_skip' || g.type === 'not_interested') r.skip += n;
      byRecipe.set(rid, r);
    }
    const rows = [...byRecipe.values()];
    rows.forEach((r) => { r.cookThrough = r.view ? +(r.cook / r.view).toFixed(2) : null; });
    const trending = [...rows].sort((a, b) => (b.cook + b.favorite) - (a.cook + a.favorite)).slice(0, limit);
    const problem = rows.filter((r) => r.view >= 5).sort((a, b) => (a.cookThrough ?? 1) - (b.cookThrough ?? 1) || b.skip - a.skip).slice(0, limit);
    return { sinceDays: days, recipesTracked: rows.length, trending, problem };
  }

  /**
   * recsys audit §12 — SYSTEM-level operational health of the personalization/recsys loop: the "is the engine
   * alive + honest?" cabin. Read-only + additive + defensive (optional models degrade to null, never throws).
   * Surfaces exactly what §12 demands so the founder can SEE, at launch: (1) the outbox no-lost-signal pipeline
   * — deadLetter>0 means signals permanently failed; (2) signal coverage — is it actually learning, for how
   * many users, which signal types (the P0-2/3/4 processors should now appear here); (3) consent provenance
   * coverage — the P0-5 gate stamping every event; (4) L1 prior freshness — has the learner run.
   */
  async recsysHealth(opts: { days?: number } = {}) {
    const days = Math.min(Math.max(opts.days ?? 7, 1), 90);
    const since = new Date(Date.now() - days * 86_400_000);

    // 1. Outbox pipeline — the at-least-once "no lost signals" guarantee.
    const [pending, processing, dead, processedInWindow] = await Promise.all([
      this.prisma.eventOutbox.count({ where: { status: 'pending' } }).catch(() => 0),
      this.prisma.eventOutbox.count({ where: { status: 'processing' } }).catch(() => 0),
      this.prisma.eventOutbox.count({ where: { status: 'dead' } }).catch(() => 0),
      this.prisma.eventOutbox.count({ where: { status: 'done', processedAt: { gte: since } } }).catch(() => 0),
    ]);

    // 2. Signal coverage — is the engine deriving signals, and for how many users? (P0-2/3/4 types appear here.)
    const [usersWithSignals, totalObservations, observationsInWindow, obsByName] = await Promise.all([
      this.prisma.userBehaviorSignal.groupBy({ by: ['userId'], _count: { _all: true } } as any).then((r: any[]) => r.length).catch(() => 0),
      this.prisma.signalObservation.count().catch(() => 0),
      this.prisma.signalObservation.count({ where: { observedAt: { gte: since } } }).catch(() => 0),
      this.prisma.signalObservation.groupBy({ by: ['signalName'], _count: { _all: true }, where: { observedAt: { gte: since } } } as any).catch(() => []),
    ]);

    // 3. Consent provenance coverage — the P0-5 gate: every event carries the purpose it was collected under.
    const consentByPurpose = await this.prisma.userEvent
      .groupBy({ by: ['consentPurpose'], _count: { _all: true }, where: { timestamp: { gte: since } } } as any)
      .catch(() => []);

    // 4. L1 prior freshness — optional; the learner may not have run yet pre-launch (then this is null).
    let priors: any = null;
    try {
      const [count, latest, byScope] = await Promise.all([
        this.prisma.recipePrior.count(),
        this.prisma.recipePrior.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
        this.prisma.recipePrior.groupBy({ by: ['scope'], _count: { _all: true } } as any),
      ]);
      priors = { count, latestUpdate: latest?.updatedAt ?? null, byScope: (byScope as any[]).map((g) => ({ scope: g.scope, count: g._count?._all ?? 0 })) };
    } catch {
      priors = null;
    }

    const outboxHealth = dead > 0 ? 'dead_letters_present' : pending > 200 ? 'backlog' : 'healthy';

    return {
      sinceDays: days,
      outbox: { pendingBacklog: pending, processing, deadLetter: dead, processedInWindow, health: outboxHealth },
      signals: {
        usersWithSignals,
        totalObservations,
        observationsInWindow,
        typeCoverage: (obsByName as any[]).map((g) => ({ signalName: g.signalName, count: g._count?._all ?? 0 })).sort((a, b) => b.count - a.count),
      },
      consent: {
        byPurpose: (consentByPurpose as any[]).map((g) => ({ purpose: g.consentPurpose ?? 'unstamped', count: g._count?._all ?? 0 })).sort((a, b) => b.count - a.count),
      },
      priors,
    };
  }
}
