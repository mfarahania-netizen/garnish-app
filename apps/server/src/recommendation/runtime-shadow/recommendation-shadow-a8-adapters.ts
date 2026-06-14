/**
 * Prisma-backed A8 ports (E18/E43-A8). The ONLY runtime IO surfaces for the A8 layer. All reads are
 * bounded and read-only; retention is count/sample only (NEVER deletes). Used ONLY when the matching A8
 * mode is enabled; default-off → never invoked. No raw event payloads / user text / AI output are read.
 */

import { SignalObservation } from '../../behavior-engine/signals/signal-types';
import {
  ShadowProfileFeedPort,
  ShadowConsentPort,
  ShadowTraceReadPort,
  ShadowTraceRetentionPort,
  LoadedProfileObservations,
  ProfileFeedMode,
  ShadowAnalysisQuery,
  RedactedTraceRow,
} from './recommendation-shadow-profile-feed.types';
import { SHADOW_TO_CANONICAL } from './recommendation-shadow-consent-plumbing';

const MAX_SIGNALS = 500;
const MAX_TRACES = 5000;

const clampStrength = (w: number): number => (Number.isFinite(w) ? Math.max(-1, Math.min(1, w)) : 0);

/** Map a coarse persisted SignalObservation row → an A3-shaped observation (approximate rebuild). */
function rowToObservation(userId: string, signalKey: string, strength: number, evidenceCount: number, observedAt: Date, now: Date): SignalObservation {
  const family = (signalKey.split('.')[0] || 'onboarding') as SignalObservation['signalFamily'];
  return {
    observationId: `${userId}:${signalKey}`,
    userId,
    signalKey,
    signalFamily: family,
    value: strength,
    strength,
    confidence: 0.4,
    evidenceCount,
    evidenceEventIds: [],
    sourceEventTypes: [signalKey.replace('.', '_')],
    generatedAt: now.toISOString(),
    lastEvidenceAt: (observedAt instanceof Date ? observedAt : now).toISOString(),
    recencyScore: 0.7,
    consistencyScore: 0.6,
    frequencyScore: 0.6,
    privacyClass: 'P1-pseudonymous',
    consentPurpose: 'analytics',
    retentionPolicy: 'standard-365d',
    explanation: 'Rebuilt from persisted signal evidence (approximate).',
    limitations: [],
    version: 1,
  } as unknown as SignalObservation;
}

export interface A8ProfilePrisma {
  signalObservation: { findMany(args: any): Promise<any[]> };
  userBehaviorProfile?: { findUnique(args: any): Promise<any | null> };
}

export function createPrismaShadowProfileFeedPort(prisma: A8ProfilePrisma, nowFn: () => Date = () => new Date()): ShadowProfileFeedPort {
  return {
    async loadObservations(userId: string, mode: ProfileFeedMode): Promise<LoadedProfileObservations | null> {
      const now = nowFn();
      if (mode === 'rebuild') {
        const rows = await prisma.signalObservation.findMany({ where: { userId }, take: MAX_SIGNALS, orderBy: { observedAt: 'desc' }, select: { signalName: true, weight: true, observedAt: true } });
        if (!rows.length) return null;
        // aggregate rows by signalName → strength (mean weight) + evidenceCount
        const agg = new Map<string, { sum: number; n: number; latest: Date }>();
        for (const r of rows) {
          const k = String(r.signalName || '').trim();
          if (!k) continue;
          const cur = agg.get(k) || { sum: 0, n: 0, latest: new Date(0) };
          cur.sum += clampStrength(Number(r.weight)); cur.n += 1;
          const at = r.observedAt instanceof Date ? r.observedAt : new Date(r.observedAt);
          if (at > cur.latest) cur.latest = at;
          agg.set(k, cur);
        }
        const observations = [...agg.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => rowToObservation(userId, k, clampStrength(v.sum / v.n), v.n, v.latest, now));
        return observations.length ? { observations, source: 'rebuild_from_signals', signalCount: rows.length, snapshotAgeHours: null } : null;
      }
      if (mode === 'persisted' && prisma.userBehaviorProfile) {
        // SELECT ONLY `updatedAt` — NEVER read healthAdherenceScore or any medical/protected field into
        // memory (no assembly of protected attributes). Only snapshot freshness is used.
        const p = await prisma.userBehaviorProfile.findUnique({ where: { userId }, select: { updatedAt: true } });
        if (!p) return null;
        const ageHours = p.updatedAt ? Math.max(0, (now.getTime() - new Date(p.updatedAt).getTime()) / 3_600_000) : null;
        // deliberately conservative — NO medical/health field is read or inferred; only a neutral
        // engagement seed anchored to snapshot freshness.
        const observations: SignalObservation[] = [rowToObservation(userId, 'reco.save_affinity', 0, 2, p.updatedAt ? new Date(p.updatedAt) : now, now)];
        return { observations, source: 'persisted_snapshot', signalCount: observations.length, snapshotAgeHours: ageHours };
      }
      return null;
    },
  };
}

export interface A8ConsentPrisma {
  consentLog: { findMany(args: any): Promise<any[]> };
}

export function createPrismaShadowConsentPort(prisma: A8ConsentPrisma): ShadowConsentPort {
  return {
    async getUserConsentPurposes(userId: string): Promise<string[] | null> {
      if (!userId) return null;
      const rows = await prisma.consentLog.findMany({ where: { userId, granted: true }, select: { type: true, purpose: true } });
      if (!rows.length) return null;
      const purposes = new Set<string>();
      for (const r of rows) {
        if (r.purpose) purposes.add(String(r.purpose));
        if (r.type) purposes.add(String(r.type));
      }
      // also surface canonical mappings so the resolver's has() checks line up
      for (const canon of Object.values(SHADOW_TO_CANONICAL)) if (purposes.has(canon)) purposes.add(canon);
      return [...purposes];
    },
  };
}

export interface A8TracePrisma {
  recommendationShadowTrace: { findMany(args: any): Promise<any[]>; count(args: any): Promise<number> };
}

export function createPrismaShadowTraceReadPort(prisma: A8TracePrisma): ShadowTraceReadPort {
  return {
    async readTraces(query: ShadowAnalysisQuery): Promise<RedactedTraceRow[]> {
      const where: any = { createdAt: { gte: query.from, lte: query.to } };
      if (query.experimentKey) where.experimentKey = query.experimentKey;
      if (query.userId) where.userId = query.userId;
      const rows = await prisma.recommendationShadowTrace.findMany({
        where, take: Math.min(MAX_TRACES, query.limit ?? MAX_TRACES), orderBy: { createdAt: 'desc' },
        select: { topKOverlap: true, rankShiftCount: true, majorDivergence: true, reasonCodes: true, summary: true },
      });
      return rows.map((r) => ({
        topKOverlap: typeof r.topKOverlap === 'number' ? r.topKOverlap : null,
        rankShiftCount: typeof r.rankShiftCount === 'number' ? r.rankShiftCount : null,
        majorDivergence: !!r.majorDivergence,
        reasonCodes: Array.isArray(r.reasonCodes) ? r.reasonCodes.filter((x: unknown) => typeof x === 'string') : [],
        summary: r.summary && typeof r.summary === 'object' ? { weakConfidenceCount: (r.summary as any).weakConfidenceCount, unsafeExplanationCount: (r.summary as any).unsafeExplanationCount, readinessStatus: (r.summary as any).readinessStatus } : null,
      }));
    },
  };
}

export function createPrismaShadowTraceRetentionPort(prisma: A8TracePrisma): ShadowTraceRetentionPort {
  return {
    async countEligible(beforeDate: Date): Promise<number> {
      return prisma.recommendationShadowTrace.count({ where: { createdAt: { lt: beforeDate } } });
    },
    async sampleEligibleIds(beforeDate: Date, limit: number): Promise<string[]> {
      const rows = await prisma.recommendationShadowTrace.findMany({ where: { createdAt: { lt: beforeDate } }, take: Math.max(0, limit), orderBy: { createdAt: 'asc' }, select: { id: true } });
      return rows.map((r) => String(r.id));
    },
  };
}
