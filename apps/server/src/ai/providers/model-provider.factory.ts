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
/** One ordered link in the model chain: a keyed OpenRouter model, or the Gemini provider. */
export type ChainEntry = { kind: 'openrouter'; model: string; key: string } | { kind: 'gemini' };

export interface AiProviderConfig {
  provider: 'stub' | 'gemini';
  liveEnabled: boolean;
  apiKey?: string;
  modelName: string;
  /** Ordered model chain resolved from env (per-model OpenRouter entries + optional `gemini` markers). */
  chainSpec: ChainEntry[];
  /** Cooldown (ms) a rate-limited model is skipped before the chain retries it. */
  fallbackCooldownMs: number;
}

const PLACEHOLDER_KEYS = new Set(['', 'your-gemini-api-key', 'changeme', 'placeholder', 'sk-or-v1-...', 'sk-or-...']);
const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
const DEFAULT_OPENROUTER_MODELS = ['openai/gpt-oss-120b:free'];

/**
 * Parse the ordered chain from env. Two forms (OPENROUTER_CHAIN wins):
 *  - OPENROUTER_CHAIN: «model|key» entries (per-model keys = independent free quotas) and bare `gemini`
 *    markers, separated by `;` — full control over order and where the Gemini safety net sits.
 *  - else OPENROUTER_MODELS (comma slugs) × the single OPENROUTER_API_KEY (simple same-key case).
 * Gemini is NOT added here — the factory appends it last unless a `gemini` marker placed it explicitly.
 *
 * @example OPENROUTER_CHAIN=openai/gpt-oss-120b:free|sk-or-AAA;openrouter/owl-alpha|sk-or-BBB;gemini;openai/gpt-oss-20b:free|sk-or-CCC
 *   → chain order: gpt-oss-120b → owl-alpha → gemini → gpt-oss-20b (each free model on its OWN key = independent quota).
 */
function parseChainSpec(env: NodeJS.ProcessEnv, defaultKey?: string): ChainEntry[] {
  const spec: ChainEntry[] = [];
  const raw = (env.OPENROUTER_CHAIN || '').trim();
  if (raw) {
    for (const entry of raw.split(';').map((s) => s.trim()).filter(Boolean)) {
      if (entry.toLowerCase() === 'gemini') { spec.push({ kind: 'gemini' }); continue; }
      const [model, key] = entry.split('|').map((x) => x.trim());
      const k = key || defaultKey;
      if (model && k && !PLACEHOLDER_KEYS.has(k)) spec.push({ kind: 'openrouter', model, key: k });
    }
    return spec;
  }
  if (defaultKey) {
    const models = (env.OPENROUTER_MODELS || DEFAULT_OPENROUTER_MODELS.join(',')).split(',').map((s) => s.trim()).filter(Boolean);
    for (const model of models) spec.push({ kind: 'openrouter', model, key: defaultKey });
  }
  return spec;
}

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
  const chainSpec = parseChainSpec(env, openRouterKey);
  const fallbackCooldownMs = Math.max(1000, Number(env.AI_FALLBACK_COOLDOWN_MS) || 60_000);
  return { provider, liveEnabled, apiKey, modelName, chainSpec, fallbackCooldownMs };
}

/** True only when the general live config is satisfied (live + at least one real model key: Gemini OR OpenRouter). */
export function isLiveModelConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  const cfg = resolveAiProviderConfig(env);
  const hasModelKey = !!cfg.apiKey || cfg.chainSpec.some((e) => e.kind === 'openrouter');
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
    let geminiPlaced = false;
    // Build the chain in the EXACT configured order (preference order: strongest first).
    for (const e of config.chainSpec) {
      if (e.kind === 'gemini') {
        if (config.apiKey) { chain.push(new GeminiModelProvider(config.apiKey, config.modelName)); geminiPlaced = true; }
      } else {
        chain.push(new OpenRouterModelProvider(e.key, e.model));
      }
    }
    // Append Gemini as the always-answers safety net unless a `gemini` marker already placed it.
    if (!geminiPlaced && config.apiKey) chain.push(new GeminiModelProvider(config.apiKey, config.modelName));

    if (chain.length === 0) {
      logger.warn('AI_PROVIDER=gemini and AI_LIVE_ENABLED=true, but no real model key (GEMINI_API_KEY/OPENROUTER_*) is present — falling back to the stub provider (no live AI).');
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
