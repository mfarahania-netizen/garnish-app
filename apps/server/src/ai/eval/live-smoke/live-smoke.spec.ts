import * as fs from 'node:fs';
import * as path from 'node:path';
import { runLiveSmoke, LiveSmokeResult } from './live-smoke';

/**
 * Drives the controlled live-Gemini smoke gate. In normal/CI runs (flags absent) it SKIPS and makes
 * NO live call. To execute live: set AI_PROVIDER=gemini, AI_LIVE_ENABLED=true, a real GEMINI_API_KEY,
 * and RUN_LIVE_AI_SMOKE=true, then `pnpm --dir apps/server run ai:live-smoke`. Always writes the artifact.
 */
describe('E47-A7 — controlled live Gemini smoke gate', () => {
  let result: LiveSmokeResult;

  beforeAll(async () => {
    result = await runLiveSmoke(process.env);
    // Only persist on a real live run. A default offline/skip run must NOT overwrite the committed
    // live-execution artifact with a skip-stub (E43-A1 hardening: prevents historical-artifact churn).
    if (result.status === 'executed') {
      try {
        const outDir = path.resolve(__dirname, '../../../../../..', 'docs/qa/ai');
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, 'e47_a7_live_smoke_results.json'), JSON.stringify(result, null, 2));
      } catch {
        /* artifact write is best-effort */
      }
    }
    // Real Gemini calls are slow (~10-15s each × 3 safe prompts); the default 5s beforeAll timeout
    // is too short for a valid-key live run (it would fail the suite even on a perfect run). In the
    // default no-flag path runLiveSmoke skips instantly, so this generous timeout is inert there.
  }, 180_000);

  it('skips safely when live config is absent (no live call), or executes safely when enabled', () => {
    if (result.status === 'skipped_missing_live_config') {
      expect(result.liveProviderCallCount).toBe(0);
      expect(result.failures).toEqual([]);
      expect(result.conditions.allMet).toBe(false);
    } else {
      expect(result.status).toBe('executed');
      expect(result.failures).toEqual([]);
    }
  });

  it('NEVER calls the provider for blocked-before-provider prompts (when executed)', () => {
    expect(result.blockedProviderCallCount).toBe(0);
    if (result.status === 'executed') {
      const blocked = result.cases.filter((c) => c.kind === 'blocked');
      expect(blocked.length).toBe(3);
      for (const c of blocked) {
        expect(c.providerDelta).toBe(0);
        expect(c.passed).toBe(true);
      }
    }
  });

  it('only safe prompts reach the live model, and AICallLog is written (when executed)', () => {
    if (result.status === 'executed') {
      expect(result.liveProviderCallCount).toBeGreaterThan(0);
      expect(result.liveProviderCallCount).toBeLessThanOrEqual(result.safeLiveCases);
      expect(result.aiCallLogWrites).toBeGreaterThanOrEqual(result.totalCases);
      expect(result.aiCallLogEstimatedCostRows).toBeGreaterThanOrEqual(result.liveProviderCallCount);
      for (const c of result.cases.filter((x) => x.kind === 'safe')) expect(c.passed).toBe(true);
    } else {
      expect(result.liveProviderCallCount).toBe(0);
    }
  });

  it('records no raw secret in the result', () => {
    const json = JSON.stringify(result);
    expect(json).not.toMatch(/AIza[A-Za-z0-9_-]{8,}/);
  });
});
