/**
 * GARNISH-ANALYTICS-L4-16 QA gate — deterministic + HONEST analytics, no parallel/shadow, PII-safe.
 *
 * Proves: funnels/trends/cohorts/product-intelligence are deterministic (no Math.random) and HONEST
 * (absent real-user data → awaiting_pilot, never fabricated); product-intelligence reuses the real engines
 * (getLivingUserProfile + S11 harness + S6 simulator); aggregates expose no PII; and the new files never
 * import the frozen recommendation runtime-shadow. Writes an evidence artifact under docs/qa.
 */
import * as fs from 'fs';
import * as path from 'path';
import { AnalyticsIntelligenceService } from './analytics-intelligence.service';
import { computeFunnel } from './funnel';
import { bucketTimeSeries } from './trends';
import { computeCohortRetention } from './cohort';

const DIR = __dirname; // apps/server/src/analytics/intelligence
const FILES = ['funnel.ts', 'trends.ts', 'cohort.ts', 'analytics-intelligence.service.ts'].map((f) => path.join(DIR, f));
const read = (p: string) => fs.readFileSync(p, 'utf8');
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const code = FILES.map((f) => stripComments(read(f))).join('\n');
const svcCode = stripComments(read(path.join(DIR, 'analytics-intelligence.service.ts')));
const IMPORTS_SHADOW = /from\s+['"][^'"]*runtime-shadow/;
const NOW = new Date('2026-06-16T00:00:00Z');

function emptyPrisma(): any {
  return {
    userEvent: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    recipe: { findMany: jest.fn().mockResolvedValue([]) },
    favoriteRecipe: { groupBy: jest.fn().mockResolvedValue([]) },
    userStreak: { findMany: jest.fn().mockResolvedValue([]) },
    userAchievement: { groupBy: jest.fn().mockResolvedValue([]) },
    userProgress: { groupBy: jest.fn().mockResolvedValue([]) },
  };
}
const profiles = (): any => ({ getLivingUserProfile: jest.fn().mockResolvedValue({ maturity: { band: 'forming', overallScore: 0.3 } }) });

describe('ANALYTICS-L4-16 QA gate', () => {
  it('NO parallel/shadow: analytics intelligence never imports runtime-shadow', () => {
    for (const f of FILES) expect(read(f)).not.toMatch(IMPORTS_SHADOW);
  });

  it('DETERMINISTIC: no Math.random in funnel/trends/cohort/service', () => {
    expect(code).not.toMatch(/Math\.random/);
  });

  it('reuses the real engines (getLivingUserProfile + S11 harness + S6 simulator)', () => {
    expect(svcCode).toMatch(/getLivingUserProfile/);
    expect(svcCode).toMatch(/runRecommendationEval/);
    expect(svcCode).toMatch(/runIneSimulation/);
  });

  it('HONEST: pure metrics flag awaiting on empty + compute on real input', async () => {
    expect(computeFunnel('x', [{ key: 'a', label: 'a', count: 0 }]).status).toBe('awaiting_pilot');
    expect(computeFunnel('x', [{ key: 'a', label: 'a', count: 5 }]).status).toBe('real');
    expect(bucketTimeSeries([], { types: ['cook_complete'], now: NOW }).status).toBe('awaiting_pilot');
    expect(computeCohortRetention([], []).status).toBe('awaiting_pilot');
  });

  it('HONEST service: empty data → awaiting_pilot everywhere (not faked)', async () => {
    const svc = new AnalyticsIntelligenceService(emptyPrisma(), profiles());
    const pi = await svc.getProductIntelligence(NOW);
    expect((await svc.getCohorts()).status).toBe('awaiting_pilot');
    expect(pi.foodDna.status).toBe('awaiting_pilot');
    expect(pi.briefing.acceptRate).toBeNull();
  });

  it('PII-safe aggregates (no user identifiers in product-intelligence)', async () => {
    const prisma = emptyPrisma();
    prisma.user.findMany = jest.fn().mockResolvedValue([{ id: 'secret-user-id' }]);
    const svc = new AnalyticsIntelligenceService(prisma, profiles());
    const json = JSON.stringify(await svc.getProductIntelligence(NOW));
    expect(json).not.toMatch(/secret-user-id|email|phone|password/i);
  });

  it('writes the evidence artifact', async () => {
    const svc = new AnalyticsIntelligenceService(emptyPrisma(), profiles());
    const pi = await svc.getProductIntelligence(NOW);
    const checks = {
      no_runtime_shadow_import: FILES.every((f) => !IMPORTS_SHADOW.test(read(f))),
      no_randomness: !/Math\.random/.test(code),
      reuses_living_profile: /getLivingUserProfile/.test(svcCode),
      reuses_s11_harness: /runRecommendationEval/.test(svcCode),
      reuses_s6_simulator: /runIneSimulation/.test(svcCode),
      honest_null_cohorts: computeCohortRetention([], []).status === 'awaiting_pilot',
      honest_null_briefing: pi.briefing.acceptRate === null,
      honest_null_funnel: computeFunnel('x', [{ key: 'a', label: 'a', count: 0 }]).status === 'awaiting_pilot',
      ine_dry_run: pi.ine.realSends === 0,
      pii_safe: !/secret-user-id|"email"|"phone"|"password"/i.test(JSON.stringify(pi)),
    };
    const failedChecks = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
    const artifact = { sprint: 'GARNISH-ANALYTICS-L4-16', layer: 'analytics computation engine (funnels/trends/cohorts/product-intelligence)', totalChecks: Object.keys(checks).length, failedChecks, checks };
    expect(Object.keys(checks).length).toBeGreaterThanOrEqual(10);
    expect(failedChecks).toEqual([]);

    const outDir = path.resolve(__dirname, '../../../../..', 'docs/qa/analytics');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'garnish_analytics_l4_16_results.json'), JSON.stringify(artifact, null, 2));
  });
});
