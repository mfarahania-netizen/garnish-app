import { generateShadowDevTraffic, buildSimulatedUsers, SIMULATION_CONSENT_STATES, SIMULATION_CONTEXTS } from './recommendation-shadow-dev-traffic-simulator';

describe('dev-traffic simulator', () => {
  it('builds 24 synthetic users with no protected attributes', () => {
    const users = buildSimulatedUsers();
    expect(users.length).toBe(24);
    const json = JSON.stringify(users).toLowerCase();
    expect(json).not.toMatch(/diagnosis|pregnan|ethnicity|sexual|religion|medical/);
  });

  it('has 7 contexts and 6 consent states', () => {
    expect(SIMULATION_CONTEXTS.length).toBe(7);
    expect(SIMULATION_CONSENT_STATES.length).toBe(6);
  });

  it('produces a simulation meeting the minimum scale requirements', async () => {
    const sim = await generateShadowDevTraffic();
    expect(sim.summary.simulatedUsers).toBe(24);
    expect(sim.summary.contexts).toBe(7);
    expect(sim.summary.consentStates).toBe(6);
    expect(sim.summary.simulatedRequests).toBeGreaterThanOrEqual(240);
    expect(sim.summary.allowedShadowRuns).toBeGreaterThanOrEqual(80);
    expect(sim.summary.blockedConsentOrSafetyRuns).toBeGreaterThanOrEqual(40);
    expect(sim.summary.traceWriteEligibleRuns).toBeGreaterThanOrEqual(20);
    expect(sim.summary.retentionDryRunEligibleTraces).toBeGreaterThanOrEqual(10);
  });

  it('enforces safety invariants across the whole simulation', async () => {
    const sim = await generateShadowDevTraffic();
    expect(sim.summary.consentBypassCount).toBe(0);
    expect(sim.summary.responseMutationCount).toBe(0);
    expect(sim.summary.liveRankingMutationCount).toBe(0);
    expect(sim.summary.shadowFailureEscapeCount).toBe(0);
    expect(sim.summary.rawLeakCount).toBe(0);
    expect(sim.summary.unsafeExplanationRate).toBe(0);
    expect(sim.summary.defaultOffDbIoCount).toBe(0);
    expect(sim.productUseEnabled).toBe(false);
    expect(sim.liveRankingChangedForUser).toBe(false);
  });

  it('missing-consent runs are always blocked (fail-closed)', async () => {
    const sim = await generateShadowDevTraffic();
    const missing = sim.runs.filter((r) => r.consentStateId === 'missing');
    expect(missing.length).toBeGreaterThan(0);
    expect(missing.every((r) => r.blocked)).toBe(true);
  });

  it('dev-fixture consent runs are allowed (non-prod) and labeled', async () => {
    const sim = await generateShadowDevTraffic();
    const dev = sim.runs.filter((r) => r.consentStateId === 'dev_fixture');
    expect(dev.length).toBeGreaterThan(0);
    expect(dev.every((r) => r.enabled)).toBe(true);
  });

  it('trace_storage_denied runs allowed but never write a trace', async () => {
    const sim = await generateShadowDevTraffic();
    const denied = sim.runs.filter((r) => r.consentStateId === 'trace_storage_denied');
    expect(denied.every((r) => r.enabled && !r.traceWritten)).toBe(true);
  });

  it('recipe universe coverage (observedTotal 350 → ratio 1)', async () => {
    const sim = await generateShadowDevTraffic({ observedRecipeTotal: 350 });
    expect(sim.recipeUniverse.expectedTotal).toBe(350);
    expect(sim.recipeUniverse.observedTotal).toBe(350);
    expect(sim.recipeUniverse.coverageRatio).toBe(1);
  });

  it('DB-unavailable → observedTotal null, ratio 0 (no fake 350)', async () => {
    const sim = await generateShadowDevTraffic({ observedRecipeTotal: null });
    expect(sim.recipeUniverse.observedTotal).toBeNull();
    expect(sim.recipeUniverse.coverageRatio).toBe(0);
  });

  it('is deterministic across runs', async () => {
    const a = await generateShadowDevTraffic();
    const b = await generateShadowDevTraffic();
    expect(JSON.stringify(a.summary)).toBe(JSON.stringify(b.summary));
  });
});
