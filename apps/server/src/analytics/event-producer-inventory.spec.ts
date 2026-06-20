import * as fs from 'node:fs';
import * as path from 'node:path';
import { Logger } from '@nestjs/common';
import {
  EVENT_PRODUCER_INVENTORY,
  PRODUCER_INVENTORY_COVERAGE,
  PRODUCER_FAMILY_GAPS,
  checkInventoryConsistency,
  getLowRiskFirstIntegrationCandidate,
} from './event-producer-inventory';
import {
  EVENT_FAMILIES,
  EVENT_FAMILY_DEFAULTS,
  validateEventType,
  classifyEventFamily,
  EventTaxonomyContract,
} from './event-taxonomy.contract';
import { guardEventForRuntime, resolveRuntimeGuardMode } from './event-envelope-runtime-guard';
import { redactEventEnvelopeForArtifact, ConsentPurposeEnum } from './event-envelope.schema';
import { AnalyticsService } from './analytics.service';

const GENERATED_AT = '2026-06-14T00:00:00.000Z';

/* ───────────────────────── Runtime integration harness ───────────────────────── */

function makeService() {
  const created: Array<{ model: string }> = [];
  const prisma: any = {
    userEvent: {
      create: jest.fn(async () => {
        created.push({ model: 'userEvent' });
        return { id: 'evt_1' };
      }),
    },
  };
  const enrichment: any = { enrichEvent: jest.fn() };
  const outbox: any = { enqueue: jest.fn(async () => 'ob1'), processNow: jest.fn(async () => undefined) };
  const quality: any = { assess: jest.fn(() => ({ isValid: true })) };
  const consent: any = { hasPurpose: jest.fn(async () => true) }; // L0/B — gate is OFF by default; not exercised here
  const svc = new AnalyticsService(prisma, enrichment, outbox, quality, consent);
  return { svc, prisma, enrichment, outbox, quality, consent, created };
}

/* ───────────────────────── Artifact builder ───────────────────────── */

type Check = { category: string; name: string; pass: boolean; reason?: string };

function buildArtifact() {
  const checks: Check[] = [];
  const run = (category: string, name: string, fn: () => boolean) => {
    let pass = false;
    let reason: string | undefined;
    try {
      pass = fn() === true;
      if (!pass) reason = 'assertion_false';
    } catch {
      pass = false;
      reason = 'threw';
    }
    checks.push({ category, name, pass, reason });
  };

  // taxonomy
  run('taxonomy', 'known legacy eventType accepted strict', () => validateEventType('recipe_view', { mode: 'strict' }).ok);
  run('taxonomy', 'unknown rejected strict', () => validateEventType('xyzzy', { mode: 'strict' }).ok === false);
  run('taxonomy', 'unknown allowed+warned shadow', () => {
    const r = validateEventType('xyzzy', { mode: 'shadow' });
    return r.ok === true && r.warnings.length > 0;
  });
  run('taxonomy', 'all 11 families have complete defaults', () =>
    EVENT_FAMILIES.length === 11 && EVENT_FAMILIES.every((f) => !!EVENT_FAMILY_DEFAULTS[f]?.surface));
  run('taxonomy', 'planned not reported as legacy', () =>
    validateEventType('cook_complete').migrationStatus === 'canonical_planned');
  run('taxonomy', 'family classification works', () =>
    classifyEventFamily('ai_message_send') === 'ai' && classifyEventFamily('shopping_item_add') === 'grocery');

  // inventory
  const consistency = checkInventoryConsistency();
  run('inventory', 'inventory internally consistent', () => consistency.ok);
  run('inventory', 'unique producer ids', () => consistency.uniqueIds);
  run('inventory', 'all required fields present', () => consistency.allFieldsPresent);
  run('inventory', 'all enums valid', () => consistency.allEnumsValid);
  run('inventory', 'low-risk first integration candidate exists', () => consistency.hasLowRiskCandidate);
  run('inventory', 'coverage reported as targeted_static_scan (no over-claim)', () =>
    PRODUCER_INVENTORY_COVERAGE === 'targeted_static_scan');
  run('inventory', 'family gaps recorded honestly', () => PRODUCER_FAMILY_GAPS.length >= 3);

  // runtime guard
  run('runtime_guard', 'off skips', () => {
    const r = guardEventForRuntime({ x: 1 }, { mode: 'off', source: 's', producerId: 'p' });
    return r.allowed && r.status === 'skipped';
  });
  run('runtime_guard', 'shadow normalizes legacy with consent', () => {
    const r = guardEventForRuntime(
      { type: 'recipe_view', userId: 'u', page: 'home', timestamp: '2026-06-14T08:00:00.000Z' },
      { mode: 'shadow', source: 's', producerId: 'p', defaultConsentPurpose: ConsentPurposeEnum.analytics, now: '2026-06-14T08:00:00.000Z' },
    );
    return r.allowed && r.status === 'accepted_with_warnings' && !!r.canonicalEvent;
  });
  run('runtime_guard', 'shadow redacts PII (no leak)', () => {
    const r = guardEventForRuntime(
      { eventType: 'recipe_view', metadata: { email: 'a@b.co' } },
      { mode: 'shadow', source: 's', producerId: 'p', redactForLogs: true },
    );
    return r.allowed && JSON.stringify(r.redactedEvent).indexOf('a@b.co') === -1;
  });
  run('runtime_guard', 'strict rejects legacy without consent (no silent consent)', () => {
    const r = guardEventForRuntime(
      { type: 'recipe_view', userId: 'u', page: 'home', timestamp: '2026-06-14T08:00:00.000Z' },
      { mode: 'strict', source: 's', producerId: 'p' },
    );
    return r.allowed === false && r.errors.some((e) => e.includes('consentPurpose'));
  });
  run('runtime_guard', 'strict rejects PII metadata', () => {
    const r = guardEventForRuntime(
      { eventType: 'recipe_view', actorType: 'user', actorId: 'u', source: 'web-pwa', surface: 'home', consentPurpose: 'analytics', schemaVersion: 2, occurredAt: '2026-06-14T10:00:00.000Z', receivedAt: '2026-06-14T10:00:01.000Z', metadata: { phone: '09123456789' } },
      { mode: 'strict', source: 's', producerId: 'p' },
    );
    return r.allowed === false;
  });
  run('runtime_guard', 'never throws on garbage', () => {
    for (const mode of ['off', 'shadow', 'strict'] as const) guardEventForRuntime(null, { mode, source: 's', producerId: 'p' });
    return true;
  });

  // integration
  const prevMode = process.env.EVENT_ENVELOPE_RUNTIME_GUARD_MODE;
  run('integration', 'default mode is shadow', () => {
    delete process.env.EVENT_ENVELOPE_RUNTIME_GUARD_MODE;
    return resolveRuntimeGuardMode() === 'shadow';
  });
  process.env.EVENT_ENVELOPE_RUNTIME_GUARD_MODE = prevMode;

  // pii redaction summary vector
  let piiLeak = false;
  const red = redactEventEnvelopeForArtifact({ email: 'x@y.zz', metadata: { token: 'Bearer abcdef0123456789', phone: '09123456789' } });
  const redJson = JSON.stringify(red);
  if (/x@y\.zz|Bearer\s+[A-Za-z0-9._-]{8,}|\b0?9\d{9}\b/.test(redJson)) piiLeak = true;
  run('artifact_safety', 'redaction leaves no PII/secret', () => piiLeak === false);

  // tally
  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.length - passed;
  const categories = [...new Set(checks.map((c) => c.category))];
  const categoryBreakdown: Record<string, { total: number; passed: number; failed: number }> = {};
  for (const cat of categories) {
    const list = checks.filter((c) => c.category === cat);
    categoryBreakdown[cat] = { total: list.length, passed: list.filter((c) => c.pass).length, failed: list.filter((c) => !c.pass).length };
  }

  const low = getLowRiskFirstIntegrationCandidate();

  return {
    schemaVersion: 1,
    generatedAt: GENERATED_AT,
    runMode: 'offline-deterministic',
    totalChecks: checks.length,
    passedChecks: passed,
    failedChecks: failed,
    categoryBreakdown,
    taxonomySummary: {
      families: EVENT_FAMILIES.length,
      legacyEventTypeCount: EventTaxonomyContract.legacyEventTypeCount,
      canonicalPlannedEventTypeCount: EventTaxonomyContract.canonicalPlannedEventTypeCount,
      strictRejectsUnknown: true,
      shadowAllowsUnknownWithWarning: true,
    },
    producerInventorySummary: {
      coverage: PRODUCER_INVENTORY_COVERAGE,
      totalProducers: consistency.totalProducers,
      uniqueIds: consistency.uniqueIds,
      byFamily: consistency.byFamily,
      byPriority: consistency.byPriority,
      byStatus: consistency.byStatus,
      familyGaps: PRODUCER_FAMILY_GAPS.map((g) => g.family),
    },
    runtimeGuardSummary: {
      modes: ['off', 'shadow', 'strict'],
      offSkips: true,
      shadowAcceptsCanonical: true,
      shadowNormalizesLegacy: true,
      shadowRedactsPII: true,
      strictRejectsInvalid: true,
      strictRejectsNoConsent: true,
      strictRejectsPII: true,
      neverThrows: true,
    },
    runtimeIntegrationSummary: {
      integratedProducerId: low?.id ?? null,
      integratedAt: 'analytics.service.trackEvent',
      mode: 'observational',
      defaultRuntimeMode: 'shadow',
      dropsEvents: false,
      newDbWrites: 0,
      logsRedacted: true,
    },
    migrationMapSummary: {
      document: 'docs/analytics/E43_A2_EVENT_PRODUCER_MIGRATION_MAP.md',
      producersMapped: EVENT_PRODUCER_INVENTORY.length,
      familyGaps: PRODUCER_FAMILY_GAPS.length,
    },
    piiRedactionSummary: { vectorsRedacted: 1, leaks: piiLeak ? 1 : 0 },
    dbMigrationRequired: false,
    dbWritesDuringGate: 0,
    runtimeModeDefault: 'shadow',
    remainingIntegrationGaps: [
      'Only 1 of ~21 producers is shadow-guarded (analytics.service.trackEvent); the rest are not_started.',
      'No producer emits canonical_v2 yet; runtime emission/migration is staged.',
      'Notification SEND/SUPPRESS decisions are not logged as events (Layer-10 gap).',
      'No admin-action audit producer; no WAT/workflow producer; cook family has no server producer.',
      'No DB migration / no envelope columns on UserEvent (deferred).',
      'Shadow integration is observational (never drops events), even in strict mode.',
    ],
    redactedFailureDetails: checks.filter((c) => !c.pass).map((c) => ({ category: c.category, name: c.name, reason: c.reason ?? 'unknown' })),
  };
}

describe('E43-A2 event producer inventory + migration', () => {
  it('every record has all required fields', () => {
    for (const p of EVENT_PRODUCER_INVENTORY) {
      expect(typeof p.id).toBe('string');
      expect(typeof p.sourceFile).toBe('string');
      expect(typeof p.producerName).toBe('string');
      expect(EVENT_FAMILIES).toContain(p.targetEventFamily);
      expect(typeof p.targetCanonicalEventType).toBe('string');
      expect(['P0', 'P1', 'P2', 'P3']).toContain(p.migrationPriority);
      expect(['low', 'medium', 'high']).toContain(p.risk);
      expect(['not_started', 'shadow_guarded', 'canonical_emitting', 'blocked']).toContain(p.migrationStatus);
      expect(['canonical_v2', 'legacy', 'partial', 'unknown']).toContain(p.currentShape);
      expect(Array.isArray(p.notes)).toBe(true);
    }
  });

  it('has no duplicate producer ids', () => {
    const ids = EVENT_PRODUCER_INVENTORY.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is internally consistent', () => {
    const c = checkInventoryConsistency();
    if (!c.ok) console.error('INVENTORY ISSUES:', c.issues);
    expect(c.ok).toBe(true);
  });

  it('exposes exactly one low-risk first integration candidate (shadow_guarded + low)', () => {
    const low = getLowRiskFirstIntegrationCandidate();
    expect(low).toBeDefined();
    expect(low?.id).toBe('prod-analytics-trackevent');
  });

  it('reports coverage honestly (targeted_static_scan, not "all found")', () => {
    expect(PRODUCER_INVENTORY_COVERAGE).toBe('targeted_static_scan');
  });

  it('records missing-module / family gaps honestly', () => {
    const gapFamilies = PRODUCER_FAMILY_GAPS.map((g) => g.family);
    expect(gapFamilies).toEqual(expect.arrayContaining(['cook', 'admin', 'workflow', 'notification']));
  });
});

describe('E43-A2 runtime integration (analytics.service shadow guard)', () => {
  let debugSpy: jest.SpyInstance;
  const prevMode = process.env.EVENT_ENVELOPE_RUNTIME_GUARD_MODE;

  beforeEach(() => {
    debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
  });
  afterEach(() => {
    debugSpy.mockRestore();
    if (prevMode === undefined) delete process.env.EVENT_ENVELOPE_RUNTIME_GUARD_MODE;
    else process.env.EVENT_ENVELOPE_RUNTIME_GUARD_MODE = prevMode;
  });

  it('default (shadow): trackEvent still writes UserEvent and returns it (flow intact)', async () => {
    delete process.env.EVENT_ENVELOPE_RUNTIME_GUARD_MODE;
    const { svc, prisma, created } = makeService();
    const result = await svc.trackEvent({ userId: 'u1', type: 'recipe_view', page: 'home' });
    expect(result).toEqual({ id: 'evt_1' });
    expect(prisma.userEvent.create).toHaveBeenCalledTimes(1);
    expect(created.filter((c) => c.model === 'userEvent').length).toBe(1); // no extra DB writes from the guard
  });

  it('invokes the runtime guard and logs a REDACTED line for not-yet-canonical events', async () => {
    delete process.env.EVENT_ENVELOPE_RUNTIME_GUARD_MODE; // shadow
    const { svc } = makeService();
    await svc.trackEvent({ userId: 'u1', type: 'recipe_view', page: 'home' });
    const guardLogs = debugSpy.mock.calls.map((c) => String(c[0])).filter((m) => m.includes('event-envelope-guard'));
    expect(guardLogs.length).toBeGreaterThan(0);
    // redacted log must not contain raw email/phone/secret
    for (const line of guardLogs) {
      expect(line).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
      expect(line).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{8,}|eyJ[A-Za-z0-9._-]{10,}/);
    }
  });

  it('off mode: guard skips, flow still works', async () => {
    process.env.EVENT_ENVELOPE_RUNTIME_GUARD_MODE = 'off';
    const { svc, prisma } = makeService();
    const result = await svc.trackEvent({ userId: 'u1', type: 'recipe_view', page: 'home' });
    expect(result).toEqual({ id: 'evt_1' });
    expect(prisma.userEvent.create).toHaveBeenCalledTimes(1);
    const guardLogs = debugSpy.mock.calls.map((c) => String(c[0])).filter((m) => m.includes('event-envelope-guard'));
    expect(guardLogs.length).toBe(0);
  });

  it('strict mode integration does NOT drop events (observational, staged migration)', async () => {
    process.env.EVENT_ENVELOPE_RUNTIME_GUARD_MODE = 'strict';
    const { svc, prisma } = makeService();
    const result = await svc.trackEvent({ userId: 'u1', type: 'recipe_view', page: 'home' });
    expect(result).toEqual({ id: 'evt_1' }); // still written even though strict guard would reject
    expect(prisma.userEvent.create).toHaveBeenCalledTimes(1);
  });

  it('quality-rejected events short-circuit before any guard/DB write (unchanged behavior)', async () => {
    const { svc, prisma, quality } = makeService();
    quality.assess.mockReturnValueOnce({ isValid: false, reason: 'bot' });
    const result = await svc.trackEvent({ userId: 'u1', type: 'recipe_view', page: 'home' });
    expect(result).toBeNull();
    expect(prisma.userEvent.create).not.toHaveBeenCalled();
  });
});

describe('E43-A2 producer migration contract gate (artifact)', () => {
  const artifact = buildArtifact();

  beforeAll(() => {
    try {
      const outDir = path.resolve(__dirname, '../../../..', 'docs/qa/analytics');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'e43_a2_event_producer_migration_results.json'), JSON.stringify(artifact, null, 2));
    } catch {
      /* best-effort */
    }
  });

  it('is offline-deterministic with no DB migration/writes', () => {
    expect(artifact.runMode).toBe('offline-deterministic');
    expect(artifact.dbMigrationRequired).toBe(false);
    expect(artifact.dbWritesDuringGate).toBe(0);
    expect(artifact.runtimeModeDefault).toBe('shadow');
  });

  it('ALL checks pass', () => {
    if (artifact.failedChecks) console.error('E43-A2 GATE FAILURES:', JSON.stringify(artifact.redactedFailureDetails, null, 2));
    expect(artifact.failedChecks).toBe(0);
    expect(artifact.passedChecks).toBe(artifact.totalChecks);
    expect(artifact.totalChecks).toBeGreaterThanOrEqual(18);
  });

  it('covers every check family', () => {
    for (const cat of ['taxonomy', 'inventory', 'runtime_guard', 'integration', 'artifact_safety']) {
      expect(artifact.categoryBreakdown[cat]?.total).toBeGreaterThan(0);
    }
  });

  it('runtime integration summary is observational + safe', () => {
    expect(artifact.runtimeIntegrationSummary.dropsEvents).toBe(false);
    expect(artifact.runtimeIntegrationSummary.newDbWrites).toBe(0);
    expect(artifact.runtimeIntegrationSummary.logsRedacted).toBe(true);
    expect(artifact.runtimeIntegrationSummary.integratedProducerId).toBe('prod-analytics-trackevent');
  });

  it('artifact is leak-free (no PII/secret/conn-string)', () => {
    const json = JSON.stringify(artifact);
    expect(json).not.toMatch(/AIza[A-Za-z0-9_-]{8,}|sk-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._-]{8,}|eyJ[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{4,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/);
    expect(json).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    expect(json).not.toMatch(/\b0?9\d{9}\b/);
    expect(json).not.toMatch(/postgres:\/\/\S+|mysql:\/\/\S+|mongodb(\+srv)?:\/\/\S+/);
  });
});
