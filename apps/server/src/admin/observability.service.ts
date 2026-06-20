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
}
