import { OpenRouterModelProvider } from './openrouter-model.provider';

const mockFetch = (status: number, json: unknown) =>
  jest.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => json });

describe('OpenRouterModelProvider', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('generate() returns the completion text + provider usage (text path unchanged by the tool refactor)', async () => {
    global.fetch = mockFetch(200, { choices: [{ message: { content: 'سلام' } }], usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 } }) as never;
    const p = new OpenRouterModelProvider('sk-or-x', 'openai/gpt-oss-120b:free');
    const r = await p.generate({ prompt: 'سلام کن' });
    expect(r.text).toBe('سلام');
    expect(r.model).toBe('openai/gpt-oss-120b:free');
    expect(r.usage).toMatchObject({ totalTokens: 7, source: 'provider' });
  });

  it('generateWithTools() surfaces the tool calls the model wants run', async () => {
    global.fetch = mockFetch(200, {
      choices: [{ message: { content: '', tool_calls: [{ id: 'c1', function: { name: 'search_recipes', arguments: '{"query":"بادمجان"}' } }] } }],
    }) as never;
    const p = new OpenRouterModelProvider('sk-or-x', 'm');
    const r = await p.generateWithTools({ messages: [{ role: 'user', content: 'یه خورشت با بادمجان' }], tools: [{ name: 'search_recipes', description: 'd', parameters: { type: 'object' } }] });
    expect(r.toolCalls).toHaveLength(1);
    expect(r.toolCalls[0]).toMatchObject({ id: 'c1', name: 'search_recipes', arguments: '{"query":"بادمجان"}' });
    expect(r.text).toBe('');
  });

  it('generateWithTools() returns the final text when the model answers directly (no tool calls)', async () => {
    global.fetch = mockFetch(200, { choices: [{ message: { content: 'قورمه‌سبزی عالیه' } }] }) as never;
    const p = new OpenRouterModelProvider('sk-or-x', 'm');
    const r = await p.generateWithTools({ messages: [{ role: 'user', content: 'سلام' }], tools: [] });
    expect(r.text).toBe('قورمه‌سبزی عالیه');
    expect(r.toolCalls).toHaveLength(0);
  });

  it('serializes a tool-result turn back to the model (assistant tool_calls + tool reply)', async () => {
    const fetchMock = mockFetch(200, { choices: [{ message: { content: 'بر اساس نتیجه: قورمه‌سبزی' } }] });
    global.fetch = fetchMock as never;
    const p = new OpenRouterModelProvider('sk-or-x', 'm');
    await p.generateWithTools({
      messages: [
        { role: 'user', content: 'خورشت بده' },
        { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'search_recipes', arguments: '{}' }] },
        { role: 'tool', toolCallId: 'c1', content: '[{"title":"قورمه‌سبزی"}]' },
      ],
      tools: [{ name: 'search_recipes', description: 'd', parameters: {} }],
    });
    const sentBody = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(sentBody.messages[1]).toMatchObject({ role: 'assistant', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'search_recipes' } }] });
    expect(sentBody.messages[2]).toMatchObject({ role: 'tool', tool_call_id: 'c1' });
  });

  it('tags a 429 as a rate-limit ModelProviderError so the chain cools + switches', async () => {
    global.fetch = mockFetch(429, { error: { code: 429, message: 'rate' } }) as never;
    const p = new OpenRouterModelProvider('sk-or-x', 'm');
    await expect(p.generate({ prompt: 'hi' })).rejects.toMatchObject({ status: 429, rateLimited: true });
  });

  it('redacts the api key from any thrown error', async () => {
    global.fetch = mockFetch(500, { error: { message: 'boom with sk-or-secret123456789 leaked' } }) as never;
    const p = new OpenRouterModelProvider('sk-or-secret123456789', 'm');
    await expect(p.generate({ prompt: 'hi' })).rejects.toThrow(/redacted-key/);
  });
});
