import { AgenticLoopService, AgenticTool } from './agentic-loop.service';
import { ModelProvider, ToolCallingInput, ToolCallingResult, ToolContext } from '../ai-core.types';

const ctx = { userId: 'u1', snapshot: { userId: 'u1', generatedAt: '2026-01-01T00:00:00Z', schemaVersion: 1 } } as ToolContext;

/** A provider that returns scripted tool-calling results in order (last one repeats). */
class ScriptedProvider implements ModelProvider {
  readonly name = 'scripted';
  calls = 0;
  constructor(private readonly script: ToolCallingResult[]) {}
  async generate() {
    return { text: '', model: this.name };
  }
  async generateWithTools(_input: ToolCallingInput): Promise<ToolCallingResult> {
    return this.script[Math.min(this.calls++, this.script.length - 1)];
  }
}

const tool = (name: string, impl: jest.Mock): AgenticTool => ({
  spec: { name, description: 'd', parameters: { type: 'object' } },
  execute: impl,
});

describe('AgenticLoopService', () => {
  const svc = new AgenticLoopService();

  it('runs a tool the model asks for, feeds the result back, and returns the final answer', async () => {
    const provider = new ScriptedProvider([
      { text: '', toolCalls: [{ id: 'c1', name: 'search_recipes', arguments: '{"query":"بادمجان"}' }], model: 'm' },
      { text: 'قورمه‌سبزی پیدا کردم', toolCalls: [], model: 'm' },
    ]);
    const exec = jest.fn().mockResolvedValue([{ title: 'قورمه‌سبزی' }]);
    const r = await svc.run(provider, { systemPrompt: 's', userPrompt: 'خورشت بده', tools: [tool('search_recipes', exec)], ctx });
    expect(r.text).toBe('قورمه‌سبزی پیدا کردم');
    expect(r.toolCalls).toEqual([{ name: 'search_recipes', arguments: '{"query":"بادمجان"}' }]);
    expect(exec).toHaveBeenCalledWith({ query: 'بادمجان' }, ctx); // args parsed from JSON + ctx threaded
    expect(r.iterations).toBe(2);
    expect(r.truncated).toBe(false);
  });

  it('answers directly when the model needs no tool', async () => {
    const provider = new ScriptedProvider([{ text: 'سلام!', toolCalls: [], model: 'm' }]);
    const r = await svc.run(provider, { systemPrompt: 's', userPrompt: 'سلام', tools: [], ctx });
    expect(r.text).toBe('سلام!');
    expect(r.toolCalls).toHaveLength(0);
    expect(r.iterations).toBe(1);
  });

  it('feeds back an error (never throws) when the model calls an unknown tool', async () => {
    const provider = new ScriptedProvider([
      { text: '', toolCalls: [{ id: 'c1', name: 'no_such_tool', arguments: '{}' }], model: 'm' },
      { text: 'باشه', toolCalls: [], model: 'm' },
    ]);
    const r = await svc.run(provider, { systemPrompt: 's', userPrompt: 'x', tools: [], ctx });
    expect(r.text).toBe('باشه'); // the loop recovered and the model still answered
  });

  it('captures a tool throw as an error result and lets the model continue', async () => {
    const provider = new ScriptedProvider([
      { text: '', toolCalls: [{ id: 'c1', name: 'search_recipes', arguments: '{}' }], model: 'm' },
      { text: 'متاسفم، الان نشد', toolCalls: [], model: 'm' },
    ]);
    const exec = jest.fn().mockRejectedValue(new Error('db down'));
    const r = await svc.run(provider, { systemPrompt: 's', userPrompt: 'x', tools: [tool('search_recipes', exec)], ctx });
    expect(exec).toHaveBeenCalled();
    expect(r.text).toBe('متاسفم، الان نشد');
  });

  it('caps tool round-trips at maxIterations and forces a final answer', async () => {
    const askTool: ToolCallingResult = { text: '', toolCalls: [{ id: 'c', name: 'search_recipes', arguments: '{}' }], model: 'm' };
    const forced: ToolCallingResult = { text: 'جوابِ نهاییِ اجباری', toolCalls: [], model: 'm' };
    // model ALWAYS asks for a tool when tools are offered → only the forced no-tools final call ends it
    const provider: ModelProvider = {
      name: 'loopy',
      async generate() {
        return { text: '', model: 'm' };
      },
      async generateWithTools(input) {
        return input.tools.length === 0 ? forced : askTool;
      },
    };
    const exec = jest.fn().mockResolvedValue([]);
    const r = await svc.run(provider, { systemPrompt: 's', userPrompt: 'x', tools: [tool('search_recipes', exec)], ctx, maxIterations: 3 });
    expect(r.iterations).toBe(3);
    expect(r.truncated).toBe(true);
    expect(r.text).toBe('جوابِ نهاییِ اجباری');
    expect(exec).toHaveBeenCalledTimes(3); // one tool run per capped iteration
  });

  it('throws if the provider has no tool-calling capability', async () => {
    const noTools: ModelProvider = {
      name: 'textonly',
      async generate() {
        return { text: '', model: 'm' };
      },
    };
    await expect(svc.run(noTools, { systemPrompt: 's', userPrompt: 'x', tools: [], ctx })).rejects.toThrow(/tool-calling/);
  });
});
