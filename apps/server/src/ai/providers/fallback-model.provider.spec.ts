import { FallbackModelProvider } from './fallback-model.provider';
import { ModelProviderError } from './openrouter-model.provider';
import { ModelProvider, ModelGenerateInput, ModelGenerateResult } from '../ai-core.types';

const silent = { warn: () => {}, log: () => {} };

/** A fake provider with a call counter and a scripted behavior. */
class FakeProvider implements ModelProvider {
  calls = 0;
  constructor(
    readonly name: string,
    private readonly behavior: (input: ModelGenerateInput) => ModelGenerateResult,
  ) {}
  async generate(input: ModelGenerateInput): Promise<ModelGenerateResult> {
    this.calls++;
    return this.behavior(input);
  }
}
const ok = (name: string, text = 'ok') => new FakeProvider(name, () => ({ text, model: name, usage: { totalTokens: 1, source: 'estimated' } }));
const fail = (name: string, err: Error) =>
  new FakeProvider(name, () => {
    throw err;
  });
const input: ModelGenerateInput = { prompt: 'سلام' };

describe('FallbackModelProvider', () => {
  it('returns the first provider and never calls the rest when it succeeds', async () => {
    const a = ok('a', 'from-a');
    const b = ok('b', 'from-b');
    const chain = new FallbackModelProvider([a, b], 60_000, silent);
    const res = await chain.generate(input);
    expect(res.text).toBe('from-a');
    expect(res.model).toBe('a'); // result.model carries the REAL model that served
    expect(a.calls).toBe(1);
    expect(b.calls).toBe(0);
  });

  it('switches to the next model when the first fails (rate-limit)', async () => {
    const a = fail('a', new ModelProviderError('429', 429, true));
    const b = ok('b', 'from-b');
    const chain = new FallbackModelProvider([a, b], 60_000, silent);
    const res = await chain.generate(input);
    expect(res.text).toBe('from-b');
    expect(a.calls).toBe(1);
    expect(b.calls).toBe(1);
  });

  it('cools a rate-limited model down and SKIPS it on the next turn (no wasted call)', async () => {
    const a = fail('a', new ModelProviderError('429', 429, true));
    const b = ok('b', 'from-b');
    const chain = new FallbackModelProvider([a, b], 60_000, silent);
    await chain.generate(input); // a 429s → cooled; b serves
    await chain.generate(input); // a is cooling → skipped; b serves directly
    expect(a.calls).toBe(1); // a was NOT called the second time
    expect(b.calls).toBe(2);
  });

  it('throws the last error only when EVERY provider fails', async () => {
    const a = fail('a', new ModelProviderError('429', 429, true));
    const b = fail('b', new Error('boom-b'));
    const chain = new FallbackModelProvider([a, b], 60_000, silent);
    await expect(chain.generate(input)).rejects.toThrow('boom-b');
    expect(a.calls).toBe(1);
    expect(b.calls).toBe(1);
  });

  it('force-tries the chain even when all providers are cooling (better an attempt than instant fallback)', async () => {
    const a = fail('a', new ModelProviderError('429', 429, true));
    const b = fail('b', new ModelProviderError('429', 429, true));
    const chain = new FallbackModelProvider([a, b], 60_000, silent);
    await chain.generate(input).catch(() => {}); // both cooled
    a.calls = 0;
    b.calls = 0;
    // both are cooling, but with nothing else to try the chain still force-attempts them
    await chain.generate(input).catch(() => {});
    expect(a.calls + b.calls).toBeGreaterThan(0);
  });

  it('recovers a model after it succeeds again (cooldown cleared on success)', async () => {
    let aHealthy = false;
    const a = new FakeProvider('a', () => {
      if (!aHealthy) throw new ModelProviderError('429', 429, true);
      return { text: 'from-a', model: 'a', usage: { totalTokens: 1, source: 'estimated' } };
    });
    const b = ok('b', 'from-b');
    const chain = new FallbackModelProvider([a, b], 1, silent); // 1ms cooldown so it retries immediately
    expect((await chain.generate(input)).text).toBe('from-b'); // a down → b
    aHealthy = true;
    await new Promise((r) => setTimeout(r, 5)); // let the 1ms cooldown lapse
    expect((await chain.generate(input)).text).toBe('from-a'); // a healthy again → preferred
  });

  it('requires at least one provider', () => {
    expect(() => new FallbackModelProvider([], 60_000, silent)).toThrow();
  });

  describe('generateWithTools (tool-calling across the chain)', () => {
    const input = { messages: [{ role: 'user' as const, content: 'x' }], tools: [] };
    const capable = (name: string, result: unknown) => {
      const p = ok(name) as FakeProvider & { generateWithTools: jest.Mock };
      p.generateWithTools = jest.fn(async () => {
        if (result instanceof Error) throw result;
        return result;
      });
      return p;
    };

    it('forwards to the first tool-capable provider and stops there', async () => {
      const a = capable('a', { text: 'from-a', toolCalls: [], model: 'a' });
      const b = capable('b', { text: 'from-b', toolCalls: [], model: 'b' });
      const chain = new FallbackModelProvider([a, b], 60_000, silent);
      expect((await chain.generateWithTools(input)).text).toBe('from-a');
      expect(b.generateWithTools).not.toHaveBeenCalled();
    });

    it('skips a text-only provider and uses the next tool-capable one', async () => {
      const textOnly = ok('text-only'); // no generateWithTools
      const b = capable('b', { text: 'from-b', toolCalls: [], model: 'b' });
      const chain = new FallbackModelProvider([textOnly, b], 60_000, silent);
      expect((await chain.generateWithTools(input)).text).toBe('from-b');
    });

    it('switches to the next tool-capable provider when one rate-limits', async () => {
      const a = capable('a', new ModelProviderError('429', 429, true));
      const b = capable('b', { text: 'from-b', toolCalls: [], model: 'b' });
      const chain = new FallbackModelProvider([a, b], 60_000, silent);
      expect((await chain.generateWithTools(input)).text).toBe('from-b');
    });

    it('throws when NO provider in the chain supports tool-calling', async () => {
      const chain = new FallbackModelProvider([ok('t1'), ok('t2')], 60_000, silent);
      await expect(chain.generateWithTools(input)).rejects.toThrow(/tool-calling-capable/);
    });
  });
});
