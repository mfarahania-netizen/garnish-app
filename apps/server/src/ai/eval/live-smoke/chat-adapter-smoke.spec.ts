import * as fs from 'node:fs';
import * as path from 'node:path';
import { runChatAdapterSmoke, ChatAdapterSmokeResult } from './chat-adapter-smoke';

/**
 * Drives the E47-A8 controlled live-chat adapter smoke. In normal/CI runs (flags absent) it SKIPS and
 * makes NO live call. To execute live: set AI_PROVIDER=gemini, AI_LIVE_ENABLED=true, a real
 * GEMINI_API_KEY, and AI_CHAT_LIVE_ENABLED=true, then run this spec. Always writes the artifact.
 */
describe('E47-A8 — controlled live chat adapter smoke', () => {
  let result: ChatAdapterSmokeResult;

  beforeAll(async () => {
    result = await runChatAdapterSmoke(process.env);
    try {
      const outDir = path.resolve(__dirname, '../../../../../..', 'docs/qa/ai');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'e47_a8_chat_adapter_results.json'), JSON.stringify(result, null, 2));
    } catch {
      /* artifact write is best-effort */
    }
    // Real Gemini calls are slow (~10-15s); the default 5s beforeAll timeout is too short for a live
    // run. In the default no-flag path runChatAdapterSmoke skips instantly, so this is inert there.
  }, 180_000);

  it('skips safely when chat-live config is absent (no live call), or executes safely when enabled', () => {
    if (result.status === 'skipped_missing_live_config') {
      expect(result.chatLiveEnabled).toBe(false);
      expect(result.liveProviderCallCount).toBe(0);
      expect(result.failures).toEqual([]);
    } else {
      expect(result.status).toBe('executed');
      expect(result.failures).toEqual([]);
    }
  });

  it('NEVER calls the provider for blocked prompts (when executed)', () => {
    expect(result.blockedProviderCallCount).toBe(0);
    if (result.status === 'executed') {
      for (const c of result.cases.filter((x) => x.kind === 'blocked')) {
        expect(c.providerDelta).toBe(0);
        expect(c.providerMode).toBe('deterministic');
        expect(c.passed).toBe(true);
      }
    }
  });

  it('safe prompt reaches the live model once and surfaces guarded model text (when executed)', () => {
    if (result.status === 'executed') {
      expect(result.liveProviderCallCount).toBe(1);
      const safe = result.cases.find((c) => c.kind === 'safe')!;
      expect(safe.passed).toBe(true);
      // user + assistant persisted for each of the 3 chats → 6 ChatMessage writes; 3 AICallLog rows
      expect(result.chatMessageWrites).toBe(6);
      expect(result.aiCallLogWrites).toBe(3);
    } else {
      expect(result.liveProviderCallCount).toBe(0);
    }
  });

  it('records no raw secret in the result', () => {
    expect(JSON.stringify(result)).not.toMatch(/AIza[A-Za-z0-9_-]{8,}/);
  });
});
