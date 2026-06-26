import { Logger } from '@nestjs/common';
import { ModelProvider, ModelGenerateInput, ModelGenerateResult } from '../ai-core.types';
import { ModelProviderError } from './openrouter-model.provider';

/**
 * Multi-model fallback chain (founder's design) — tries each provider in order and switches to the
 * next on any failure, so a single model's rate-limit or outage never breaks a chat turn.
 *
 * COOLDOWN (circuit breaker): a provider that returns 429 is put on a short cooldown and SKIPPED for
 * that window — we route straight to the next healthy model instead of paying a wasted round-trip to a
 * throttled free endpoint on every turn. A non-429 failure gets a shorter cooldown. A success clears it.
 * When every provider is down/cooling, the last error is rethrown and the orchestrator falls back to the
 * deterministic reply (chat still answers). The provider order is the preference order: strongest first,
 * a reliable model (e.g. Gemini) last as the always-answers safety net.
 *
 * `result.model` always carries the REAL model that served the turn, so the cost ledger stays accurate.
 */
export class FallbackModelProvider implements ModelProvider {
  readonly name: string;
  private readonly cooldownUntil = new Map<string, number>();

  constructor(
    private readonly providers: ModelProvider[],
    private readonly cooldownMs = 60_000,
    private readonly logger: { warn: (m: string) => void; log?: (m: string) => void } = new Logger('FallbackModelProvider'),
  ) {
    if (!providers.length) throw new Error('FallbackModelProvider needs at least one provider');
    this.name = `fallback(${providers.map((p) => p.name).join('>')})`;
  }

  async generate(input: ModelGenerateInput): Promise<ModelGenerateResult> {
    let lastErr: unknown = null;
    let attempted = 0;

    for (const p of this.providers) {
      if ((this.cooldownUntil.get(p.name) ?? 0) > Date.now()) continue; // still cooling down → skip
      attempted++;
      try {
        const result = await p.generate(input);
        this.cooldownUntil.delete(p.name); // healthy again
        return result;
      } catch (err) {
        lastErr = err;
        this.coolDown(p.name, err);
      }
    }

    // Everything was cooling down (nothing tried) → force-try the chain once so the user still gets an
    // answer rather than an instant deterministic fallback during a transient cool window.
    if (attempted === 0) {
      for (const p of this.providers) {
        try {
          const result = await p.generate(input);
          this.cooldownUntil.delete(p.name);
          return result;
        } catch (err) {
          lastErr = err;
          this.coolDown(p.name, err);
        }
      }
    }

    throw lastErr instanceof Error ? lastErr : new Error('all model providers failed');
  }

  private coolDown(name: string, err: unknown): void {
    const status = err instanceof ModelProviderError ? err.status : undefined;
    const rateLimited = (err instanceof ModelProviderError && err.rateLimited) || status === 429;
    const ms = rateLimited ? this.cooldownMs : Math.min(this.cooldownMs, 15_000);
    this.cooldownUntil.set(name, Date.now() + ms);
    this.logger.warn(`${name} ${rateLimited ? 'rate-limited (429)' : `failed (${status ?? 'err'})`} → cooling ${Math.round(ms / 1000)}s, switching to next model`);
  }
}
