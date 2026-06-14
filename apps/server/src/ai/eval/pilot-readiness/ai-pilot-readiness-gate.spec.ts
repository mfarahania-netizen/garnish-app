import * as fs from 'node:fs';
import * as path from 'node:path';
import { runPilotReadinessGate, PilotReadinessResult } from './ai-pilot-readiness-gate';
import { RolesGuard } from '../../../auth/roles.guard';
import { RecommendationDiagnosticsController } from '../../../recommendation/diagnostics.controller';

/**
 * E47-A12 — drives the deterministic pilot-readiness gate (offline, no key/network/DB), writes the
 * redacted artifact, and proves diagnostic-route protection via the RolesGuard + controller metadata.
 */

function ctx(user: unknown) {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as any;
}
function guard(rolesReturn: string[] | undefined) {
  return new RolesGuard({ getAllAndOverride: () => rolesReturn } as any);
}

describe('E47-A12 AI internal pilot-readiness gate', () => {
  let result: PilotReadinessResult;

  beforeAll(async () => {
    result = await runPilotReadinessGate({ timestamp: '2026-06-14T00:00:00.000Z' });
    try {
      const outDir = path.resolve(__dirname, '../../../../../..', 'docs/qa/ai');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'e47_a12_ai_internal_pilot_readiness_results.json'), JSON.stringify(result, null, 2));
    } catch { /* best-effort */ }
  });

  it('is deterministic/offline — zero live, network, and DB writes', () => {
    expect(result.runMode).toBe('offline-deterministic');
    expect(result.liveCalls).toBe(0);
    expect(result.networkCalls).toBe(0);
    expect(result.dbWrites).toBe(0);
  });

  it('ALL pilot-readiness checks pass', () => {
    if (result.failedChecks) console.error('PILOT GATE FAILURES:', JSON.stringify(result.redactedFailureDetails, null, 2));
    expect(result.failedChecks).toBe(0);
    expect(result.passedChecks).toBe(result.totalChecks);
    expect(result.totalChecks).toBeGreaterThanOrEqual(20);
  });

  it('covers every scenario family', () => {
    for (const cat of ['flags', 'orchestrator_only', 'guard_order', 'a11b_integration', 'failure_injection', 'secret_hygiene', 'docs_honesty']) {
      expect(result.categoryBreakdown[cat]?.total).toBeGreaterThan(0);
    }
  });

  it('A11B regression integration is green', () => {
    expect(result.a11bRegressionSummary.present).toBe(true);
    expect(result.a11bRegressionSummary.ok).toBe(true);
    expect(result.a11bRegressionSummary.failed).toBe(0);
    expect(result.a11bRegressionSummary.liveCalls).toBe(0);
    expect(result.a11bRegressionSummary.totalCases).toBeGreaterThanOrEqual(54);
  });

  it('R3 and R4 remain Mitigating (not Closed)', () => {
    expect(result.r3Status).toBe('Mitigating');
    expect(result.r4Status).toBe('Mitigating');
  });

  it('artifact is redacted — no secret/PII, no raw prompts/outputs', () => {
    const json = JSON.stringify(result);
    expect(json).not.toMatch(/AIza[A-Za-z0-9_-]{8,}|sk-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._-]{8,}|eyJ[A-Za-z0-9._-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/);
    expect(json).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/); // no email
    expect(json).not.toMatch(/\b0?9\d{9}\b/); // no Iranian mobile
    // failureDetails carry category/name/reason only
    for (const f of result.redactedFailureDetails) expect(Object.keys(f).sort()).toEqual(['category', 'name', 'reason']);
  });
});

describe('E47-A12 diagnostic-route protection (RolesGuard + controller metadata)', () => {
  it('admin JWT user → allowed', () => {
    expect(guard(['admin']).canActivate(ctx({ isAdmin: true }))).toBe(true);
  });
  it('non-admin JWT user → DENIED (403)', () => {
    expect(guard(['admin']).canActivate(ctx({ isAdmin: false }))).toBe(false);
  });
  it('missing user → DENIED', () => {
    expect(guard(['admin']).canActivate(ctx(undefined))).toBe(false);
  });
  it('deny-by-default: guard present but no @Roles declared → DENIED', () => {
    expect(guard(undefined).canActivate(ctx({ isAdmin: true }))).toBe(false);
    expect(guard([]).canActivate(ctx({ isAdmin: true }))).toBe(false);
  });
  it('diagnostics controller is class-guarded admin-only (AuthGuard jwt + RolesGuard + @Roles admin)', () => {
    const roles = Reflect.getMetadata('roles', RecommendationDiagnosticsController);
    expect(roles).toEqual(['admin']);
    const guards = Reflect.getMetadata('__guards__', RecommendationDiagnosticsController) ?? [];
    const names = guards.map((g: any) => (typeof g === 'function' ? g.name : g?.constructor?.name));
    expect(names).toContain('RolesGuard');
    // AuthGuard('jwt') is a mixin class; at least one guard beyond RolesGuard must be present (the JWT guard → 401 for unauthenticated)
    expect(guards.length).toBeGreaterThanOrEqual(2);
  });
});
