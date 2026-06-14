import { summarizeShadowSimulationPerformance } from './recommendation-shadow-performance-guard';
import { generateShadowDevTraffic } from './recommendation-shadow-dev-traffic-simulator';

describe('summarizeShadowSimulationPerformance', () => {
  it('summarizes timings + IO with zero network and zero default-off DB IO', async () => {
    const sim = await generateShadowDevTraffic();
    const p = summarizeShadowSimulationPerformance(sim.runs);
    expect(p.runCount).toBe(sim.runs.length);
    expect(p.networkCalls).toBe(0);
    expect(p.defaultOffDbIoCount).toBe(0);
    expect(p.averageSimulatedRuntimeMs).toBeGreaterThanOrEqual(0);
    expect(p.p95SimulatedRuntimeMs).toBeGreaterThanOrEqual(0);
    expect(p.maxSimulatedRuntimeMs).toBeGreaterThanOrEqual(p.p95SimulatedRuntimeMs);
  });

  it('trace write accounting is consistent', async () => {
    const sim = await generateShadowDevTraffic();
    const p = summarizeShadowSimulationPerformance(sim.runs);
    expect(p.traceWritesAllowed).toBeLessThanOrEqual(p.traceWritesAttempted);
    expect(p.traceWritesBlocked).toBe(p.traceWritesAttempted - p.traceWritesAllowed);
  });

  it('estimated DB reads scale with allowed runs; estimates are non-negative', async () => {
    const sim = await generateShadowDevTraffic();
    const p = summarizeShadowSimulationPerformance(sim.runs);
    expect(p.estimatedDbReads).toBeGreaterThanOrEqual(0);
    expect(p.estimatedDbWrites).toBeGreaterThanOrEqual(0);
  });

  it('deterministic + never throws on garbage', async () => {
    const sim = await generateShadowDevTraffic();
    expect(summarizeShadowSimulationPerformance(sim.runs)).toEqual(summarizeShadowSimulationPerformance(sim.runs));
    expect(() => summarizeShadowSimulationPerformance(null as any)).not.toThrow();
  });
});
