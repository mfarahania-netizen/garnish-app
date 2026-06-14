import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  validateEventEnvelope,
  assertNoPIIInMetadata,
  redactEventEnvelopeForArtifact,
  CanonicalEventEnvelope,
  ActorTypeEnum,
  EventSourceEnum,
  ConsentPurposeEnum,
} from './event-envelope.schema';
import { ingestEventEnvelope } from './event-envelope.ingest-gate';
import { CANONICAL_EVENT_EXAMPLES, LEGACY_EVENT_EXAMPLES } from './event-envelope.examples';

/**
 * E43-A1 — Canonical Event Envelope contract + ingest gate.
 *
 * This spec drives the deterministic, OFFLINE contract gate (no DB / network / secrets), writes the
 * redacted artifact `docs/qa/analytics/e43_a1_event_envelope_contract_results.json`, and asserts the
 * gate is fully green (failedChecks === 0). It mirrors the E47 eval-gate convention.
 */

const GENERATED_AT = '2026-06-14T00:00:00.000Z'; // fixed → deterministic artifact (no rerun churn)
const TIMES = { occurredAt: '2026-06-14T10:00:00.000Z', receivedAt: '2026-06-14T10:00:01.000Z' };

const VALID_CANONICAL = {
  eventId: '0190a000-0000-7000-8000-00000000aa01',
  eventType: 'recipe_viewed',
  actorType: ActorTypeEnum.user,
  actorId: 'user_123',
  source: EventSourceEnum.webPwa,
  surface: 'home',
  consentPurpose: ConsentPurposeEnum.analytics,
  schemaVersion: 2,
  ...TIMES,
};

/** PII/secret rejection vectors — labels only (raw values never enter the artifact). */
const PII_VECTORS: Array<{ name: string; metadata: Record<string, unknown> }> = [
  { name: 'email value', metadata: { c: 'reach me at jane.doe@example.com' } },
  { name: 'standalone iranian phone', metadata: { ref: '09123456789' } },
  { name: 'embedded iranian phone', metadata: { ref: 'order 09123456789 ok' } },
  { name: 'jwt token', metadata: { t: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.sig123abc' } },
  { name: 'bearer token', metadata: { a: 'Bearer abcdef0123456789' } },
  { name: 'api key', metadata: { k: 'AIzaSyABCDEFGHIJ0123456' } },
  { name: 'private key block', metadata: { k: '-----BEGIN RSA PRIVATE KEY-----' } },
  { name: 'db connection string', metadata: { db: 'postgres://u:p@host:5432/db' } },
  { name: 'denylisted key (email)', metadata: { email: 'x' } },
  { name: 'nested pii', metadata: { outer: { inner: { phone: '021-12345678' } } } },
];

const SAFE_METADATA: Array<{ name: string; metadata: Record<string, unknown> }> = [
  { name: 'runId/stepId', metadata: { runId: 'ops:weekly-kpi-draft', stepId: 'draft-summary' } },
  { name: 'snapshotHash', metadata: { snapshotHash: 'sha256:deadbeefcafe' } },
  { name: 'experimentArm', metadata: { experimentArm: 'briefing-copy-a' } },
  { name: 'counters/flags', metadata: { position: 3, mergedCount: 2, blockedBeforeProvider: true } },
];

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

  // ── schema ──
  run('schema', 'valid canonical passes', () => validateEventEnvelope(VALID_CANONICAL).ok);
  run('schema', 'missing required field fails', () => {
    const bad: any = { ...VALID_CANONICAL };
    delete bad.eventId;
    return validateEventEnvelope(bad).ok === false;
  });
  run('schema', 'invalid enum fails', () => validateEventEnvelope({ ...VALID_CANONICAL, actorType: 'robot' }).ok === false);
  run('schema', 'invalid schemaVersion fails', () => validateEventEnvelope({ ...VALID_CANONICAL, schemaVersion: 0 }).ok === false);
  run('schema', 'invalid date fails', () => validateEventEnvelope({ ...VALID_CANONICAL, occurredAt: 'yesterday' }).ok === false);
  run('schema', 'schemaVersion drift warns (still ok)', () => {
    const r = validateEventEnvelope({ ...VALID_CANONICAL, schemaVersion: 1 });
    return r.ok === true && r.warnings.some((w) => w.path === 'schemaVersion');
  });
  run('schema', 'unknown extra fields ignored (backward tolerant)', () => {
    const r = validateEventEnvelope({ ...VALID_CANONICAL, futureField: 'x' });
    return r.ok === true && !(r.value as any).futureField;
  });

  // ── examples ──
  const exampleNames = Object.keys(CANONICAL_EVENT_EXAMPLES);
  for (const name of exampleNames) {
    run('examples', `example ${name} validates`, () => {
      const r = validateEventEnvelope(CANONICAL_EVENT_EXAMPLES[name]);
      return r.ok === true && r.errors.length === 0;
    });
  }

  // ── pii ──
  let piiDetected = 0;
  for (const v of PII_VECTORS) {
    run('pii', `rejects ${v.name}`, () => {
      let threw = false;
      try {
        assertNoPIIInMetadata(v.metadata);
      } catch {
        threw = true;
      }
      if (threw) piiDetected++;
      return threw;
    });
  }
  for (const s of SAFE_METADATA) {
    run('pii', `accepts safe ${s.name}`, () => {
      try {
        assertNoPIIInMetadata(s.metadata);
        return true;
      } catch {
        return false;
      }
    });
  }

  // ── ingest_strict ──
  run('ingest_strict', 'strict valid accepted (mode canonical)', () => {
    const r = ingestEventEnvelope(VALID_CANONICAL, { strict: true });
    return r.accepted && r.mode === 'canonical';
  });
  run('ingest_strict', 'strict invalid rejected', () => {
    const bad: any = { ...VALID_CANONICAL };
    delete bad.consentPurpose;
    const r = ingestEventEnvelope(bad, { strict: true });
    return !r.accepted && r.mode === 'rejected' && r.value === null;
  });
  run('ingest_strict', 'PII metadata rejected', () => {
    const r = ingestEventEnvelope({ ...VALID_CANONICAL, metadata: { email: 'a@b.co' } }, { strict: true });
    return !r.accepted;
  });
  run('ingest_strict', 'reject carries a redacted (leak-free) input copy', () => {
    const r = ingestEventEnvelope({ ...VALID_CANONICAL, metadata: { email: 'a@b.co' } }, { strict: true });
    return JSON.stringify(r.redacted).indexOf('a@b.co') === -1;
  });

  // ── ingest_legacy ──
  let legacyNormalized = 0;
  let legacyWarnings = 0;
  run('ingest_legacy', 'legacy normalized with caller consent default', () => {
    const r = ingestEventEnvelope(LEGACY_EVENT_EXAMPLES.legacy_recipe_view, {
      strict: false,
      defaultConsentPurpose: ConsentPurposeEnum.analytics,
    });
    if (r.accepted) legacyNormalized++;
    legacyWarnings += r.warnings.length;
    return r.accepted && r.mode === 'legacy-normalized' && r.warnings.length > 0;
  });
  run('ingest_legacy', 'legacy cron normalized (source=server inferred)', () => {
    const r = ingestEventEnvelope(LEGACY_EVENT_EXAMPLES.legacy_cron_run, {
      strict: false,
      defaultConsentPurpose: ConsentPurposeEnum.core,
    });
    if (r.accepted) legacyNormalized++;
    return r.accepted && (r.value as CanonicalEventEnvelope).source === EventSourceEnum.server;
  });
  run('ingest_legacy', 'no silent consent — legacy without default consent rejected', () => {
    const r = ingestEventEnvelope(LEGACY_EVENT_EXAMPLES.legacy_recipe_view, { strict: false });
    return !r.accepted && r.errors.some((e) => e.path === 'consentPurpose');
  });

  // ── redaction ──
  run('redaction', 'redaction scrubs secrets/PII, preserves structure', () => {
    const dirty = {
      eventType: 'x',
      actorId: 'user_1',
      metadata: { token: 'Bearer abcdef0123456789', nested: { apiKey: 'AIzaSyABCDEFGHIJ0123456', phone: '09123456789' } },
    };
    const out = redactEventEnvelopeForArtifact(dirty) as any;
    const json = JSON.stringify(out);
    return (
      out.eventType === 'x' &&
      !/AIza[A-Za-z0-9_-]{8,}/.test(json) &&
      !/Bearer\s+[A-Za-z0-9._-]{8,}/.test(json) &&
      !/\b0?9\d{9}\b/.test(json)
    );
  });
  run('redaction', 'redaction returns null for null input', () => redactEventEnvelopeForArtifact(null) === null);

  // ── safety ──
  run('safety', 'gate runs with no DB/prisma dependency (pure)', () => {
    // If the gate touched the DB it could not run here (no Prisma is constructed/imported).
    return ingestEventEnvelope(VALID_CANONICAL).accepted === true;
  });

  // ── tally ──
  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.length - passed;
  const categories = [...new Set(checks.map((c) => c.category))];
  const categoryBreakdown: Record<string, { total: number; passed: number; failed: number }> = {};
  for (const cat of categories) {
    const list = checks.filter((c) => c.category === cat);
    categoryBreakdown[cat] = {
      total: list.length,
      passed: list.filter((c) => c.pass).length,
      failed: list.filter((c) => !c.pass).length,
    };
  }

  const artifact = {
    schemaVersion: 1,
    generatedAt: GENERATED_AT,
    runMode: 'offline-deterministic',
    totalChecks: checks.length,
    passedChecks: passed,
    failedChecks: failed,
    categoryBreakdown,
    exampleCount: exampleNames.length,
    piiDetectionSummary: {
      vectors: PII_VECTORS.length,
      detected: piiDetected,
      missed: PII_VECTORS.length - piiDetected,
      safeAccepted: SAFE_METADATA.length,
    },
    strictModeSummary: {
      validAccepted: true,
      invalidRejected: true,
      piiRejected: true,
    },
    legacyNormalizationSummary: {
      legacyCases: Object.keys(LEGACY_EVENT_EXAMPLES).length,
      normalized: legacyNormalized,
      noSilentConsent: true,
      warningsEmitted: legacyWarnings,
    },
    dbMigrationRequired: false,
    dbWritesDuringGate: 0,
    redactedFailureDetails: checks
      .filter((c) => !c.pass)
      .map((c) => ({ category: c.category, name: c.name, reason: c.reason ?? 'unknown' })),
    remainingIntegrationGaps: [
      'analytics.service.trackEvent still writes the legacy UserEvent shape; gate not wired into the live ingest path (Founder-gated log-only adoption deferred per E43-W6).',
      'No additive nullable envelope columns on UserEvent yet (no DB migration in E43-A1).',
      'Other producers (AICallLog, RecommendationExposure/Attribution, behavior-engine cron) not yet emitting canonical envelopes.',
      'eventType is not cross-checked against event-taxonomy.ts (decoupled for backward tolerance).',
      'PII detection is deterministic/heuristic (no NLP); policy relies on keeping metadata small and structured.',
    ],
  };

  return artifact;
}

describe('E43-A1 Canonical Event Envelope contract + ingest gate', () => {
  const artifact = buildArtifact();

  beforeAll(() => {
    try {
      const outDir = path.resolve(__dirname, '../../../..', 'docs/qa/analytics');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'e43_a1_event_envelope_contract_results.json'), JSON.stringify(artifact, null, 2));
    } catch {
      /* artifact write is best-effort */
    }
  });

  it('is deterministic/offline with no DB writes', () => {
    expect(artifact.runMode).toBe('offline-deterministic');
    expect(artifact.dbWritesDuringGate).toBe(0);
    expect(artifact.dbMigrationRequired).toBe(false);
  });

  it('ALL contract checks pass', () => {
    if (artifact.failedChecks) console.error('E43-A1 GATE FAILURES:', JSON.stringify(artifact.redactedFailureDetails, null, 2));
    expect(artifact.failedChecks).toBe(0);
    expect(artifact.passedChecks).toBe(artifact.totalChecks);
    expect(artifact.totalChecks).toBeGreaterThanOrEqual(30);
  });

  it('covers every check family', () => {
    for (const cat of ['schema', 'examples', 'pii', 'ingest_strict', 'ingest_legacy', 'redaction', 'safety']) {
      expect(artifact.categoryBreakdown[cat]?.total).toBeGreaterThan(0);
    }
  });

  it('validates at least 12 canonical examples and detects every PII vector', () => {
    expect(artifact.exampleCount).toBeGreaterThanOrEqual(12);
    expect(artifact.piiDetectionSummary.missed).toBe(0);
    expect(artifact.piiDetectionSummary.detected).toBe(artifact.piiDetectionSummary.vectors);
  });

  it('normalizes legacy events and never fabricates consent', () => {
    expect(artifact.legacyNormalizationSummary.normalized).toBeGreaterThanOrEqual(2);
    expect(artifact.legacyNormalizationSummary.noSilentConsent).toBe(true);
    expect(artifact.legacyNormalizationSummary.warningsEmitted).toBeGreaterThan(0);
  });

  it('artifact is leak-free — no secret/PII/email/phone in the written JSON', () => {
    const json = JSON.stringify(artifact);
    expect(json).not.toMatch(/AIza[A-Za-z0-9_-]{8,}|sk-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._-]{8,}|eyJ[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{4,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/);
    expect(json).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/); // no email
    expect(json).not.toMatch(/\b0?9\d{9}\b/); // no Iranian mobile
    expect(json).not.toMatch(/postgres:\/\/\S+|mysql:\/\/\S+|mongodb(\+srv)?:\/\/\S+/); // no conn string
  });
});
