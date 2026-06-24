import { Logger } from '@nestjs/common';
import { ModelProvider } from '../ai-core.types';
import { StubModelProvider } from './stub-model.provider';
import { GeminiModelProvider } from './gemini-model.provider';

/**
 * Model provider factory (E47-A5).
 *
 * Chooses the model provider from environment config. SAFE BY DEFAULT: the stub is used unless
 * AI_PROVIDER=gemini AND AI_LIVE_ENABLED=true AND a real GEMINI_API_KEY is present. Missing/placeholder
 * key while gemini is requested → falls back to the stub (logged, no secret printed).
 */
export interface AiProviderConfig {
  provider: 'stub' | 'gemini';
  liveEnabled: boolean;
  apiKey?: string;
  modelName: string;
}

const PLACEHOLDER_KEYS = new Set(['', 'your-gemini-api-key', 'changeme', 'placeholder']);
const DEFAULT_MODEL = 'gemini-3.1-flash-lite';

/** Chat-specific kill switch (E47-A8): an EXTRA gate on top of the general live config. */
export const CHAT_LIVE_FLAG = 'AI_CHAT_LIVE_ENABLED';

export function resolveAiProviderConfig(env: NodeJS.ProcessEnv = process.env): AiProviderConfig {
  const provider = (env.AI_PROVIDER || 'stub').toLowerCase() === 'gemini' ? 'gemini' : 'stub';
  const liveEnabled = String(env.AI_LIVE_ENABLED ?? '').toLowerCase() === 'true';
  const rawKey = (env.GEMINI_API_KEY || '').trim();
  const apiKey = PLACEHOLDER_KEYS.has(rawKey) ? undefined : rawKey;
  const modelName = env.AI_MODEL_NAME || DEFAULT_MODEL;
  return { provider, liveEnabled, apiKey, modelName };
}

/** True only when the general live config is satisfied (gemini + live + real key). */
export function isLiveModelConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  const cfg = resolveAiProviderConfig(env);
  return cfg.provider === 'gemini' && cfg.liveEnabled && !!cfg.apiKey;
}

/**
 * Whether LIVE Gemini output may be surfaced in chat (E47-A8).
 *
 * SAFE BY DEFAULT: requires the full general live config (AI_PROVIDER=gemini + AI_LIVE_ENABLED=true +
 * real GEMINI_API_KEY). The chat-specific `AI_CHAT_LIVE_ENABLED` is an additional kill switch:
 *   - unset/empty → chat follows the general live config;
 *   - 'false'     → live chat is FORCED OFF even if general live is on (kill switch);
 *   - 'true'      → allowed (still only if general live is on).
 * When this returns false, chat uses the deterministic reply and no live output is used.
 */
export function resolveChatLiveEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (!isLiveModelConfigured(env)) return false;
  const flag = (env[CHAT_LIVE_FLAG] ?? '').trim().toLowerCase();
  if (flag === '') return true; // no chat-specific override → follow general live
  return flag === 'true';
}

export function createModelProvider(
  config: AiProviderConfig,
  logger: { warn: (m: string) => void; log?: (m: string) => void } = new Logger('ModelProviderFactory'),
): ModelProvider {
  if (config.provider === 'gemini' && config.liveEnabled) {
    if (!config.apiKey) {
      logger.warn('AI_PROVIDER=gemini and AI_LIVE_ENABLED=true, but GEMINI_API_KEY is missing/placeholder — falling back to the stub provider (no live AI).');
      return new StubModelProvider();
    }
    logger.log?.(`AI provider: gemini (model=${config.modelName}, live).`);
    return new GeminiModelProvider(config.apiKey, config.modelName);
  }
  return new StubModelProvider();
}
