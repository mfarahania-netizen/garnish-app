import { Logger } from '@nestjs/common';
import { ModelProvider } from '../ai-core.types';
import { StubModelProvider } from './stub-model.provider';
import { GeminiModelProvider } from './gemini-model.provider';
import { OpenRouterModelProvider } from './openrouter-model.provider';
import { FallbackModelProvider } from './fallback-model.provider';

/**
 * Model provider factory (E47-A5; multi-model chain).
 *
 * Chooses the model provider(s) from environment config. SAFE BY DEFAULT: the stub is used unless
 * AI_PROVIDER=gemini AND AI_LIVE_ENABLED=true AND at least one real model key is present (Gemini or
 * OpenRouter). When more than one model is configured they are wrapped in a FallbackModelProvider — a
 * resilient chain that switches to the next model on a rate-limit/outage (founder's design), so the
 * free tier's 429s never break a turn. Order = preference: the configured OpenRouter models first
 * (stronger/varied free brains), Gemini last as the reliable always-answers safety net.
 *
 * Adding a model: append its slug to OPENROUTER_MODELS (comma-separated). Adding capacity: more free
 * keys can be wired per-model later — the chain shape already supports N providers.
 */
export interface AiProviderConfig {
  provider: 'stub' | 'gemini';
  liveEnabled: boolean;
  apiKey?: string;
  modelName: string;
  /** OpenRouter API key (OpenAI-compatible); enables one-key-many-models brains in the chain. */
  openRouterKey?: string;
  /** Ordered OpenRouter model slugs to stack ahead of Gemini in the fallback chain. */
  openRouterModels: string[];
  /** Cooldown (ms) a rate-limited model is skipped before the chain retries it. */
  fallbackCooldownMs: number;
}

const PLACEHOLDER_KEYS = new Set(['', 'your-gemini-api-key', 'changeme', 'placeholder', 'sk-or-v1-...']);
const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
const DEFAULT_OPENROUTER_MODELS = ['openai/gpt-oss-120b:free'];

/** Chat-specific kill switch (E47-A8): an EXTRA gate on top of the general live config. */
export const CHAT_LIVE_FLAG = 'AI_CHAT_LIVE_ENABLED';

export function resolveAiProviderConfig(env: NodeJS.ProcessEnv = process.env): AiProviderConfig {
  const provider = (env.AI_PROVIDER || 'stub').toLowerCase() === 'gemini' ? 'gemini' : 'stub';
  const liveEnabled = String(env.AI_LIVE_ENABLED ?? '').toLowerCase() === 'true';
  const rawKey = (env.GEMINI_API_KEY || '').trim();
  const apiKey = PLACEHOLDER_KEYS.has(rawKey) ? undefined : rawKey;
  const modelName = env.AI_MODEL_NAME || DEFAULT_MODEL;
  const rawOrKey = (env.OPENROUTER_API_KEY || '').trim();
  const openRouterKey = PLACEHOLDER_KEYS.has(rawOrKey) ? undefined : rawOrKey;
  const openRouterModels = (env.OPENROUTER_MODELS || (openRouterKey ? DEFAULT_OPENROUTER_MODELS.join(',') : ''))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const fallbackCooldownMs = Math.max(1000, Number(env.AI_FALLBACK_COOLDOWN_MS) || 60_000);
  return { provider, liveEnabled, apiKey, modelName, openRouterKey, openRouterModels, fallbackCooldownMs };
}

/** True only when the general live config is satisfied (live + at least one real model key: Gemini OR OpenRouter). */
export function isLiveModelConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  const cfg = resolveAiProviderConfig(env);
  const hasModelKey = !!cfg.apiKey || (!!cfg.openRouterKey && cfg.openRouterModels.length > 0);
  return cfg.provider === 'gemini' && cfg.liveEnabled && hasModelKey;
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
    const chain: ModelProvider[] = [];
    // OpenRouter models FIRST (stronger/varied free brains), in the configured order…
    if (config.openRouterKey) {
      for (const slug of config.openRouterModels) chain.push(new OpenRouterModelProvider(config.openRouterKey, slug));
    }
    // …Gemini LAST as the reliable always-answers safety net when the free pool is throttled.
    if (config.apiKey) chain.push(new GeminiModelProvider(config.apiKey, config.modelName));

    if (chain.length === 0) {
      logger.warn('AI_PROVIDER=gemini and AI_LIVE_ENABLED=true, but no real model key (GEMINI_API_KEY/OPENROUTER_API_KEY) is present — falling back to the stub provider (no live AI).');
      return new StubModelProvider();
    }
    if (chain.length === 1) {
      logger.log?.(`AI provider: ${chain[0].name} (live, single model).`);
      return chain[0];
    }
    logger.log?.(`AI provider: fallback chain (live) → ${chain.map((p) => p.name).join(' > ')}`);
    return new FallbackModelProvider(chain, config.fallbackCooldownMs, logger);
  }
  return new StubModelProvider();
}
