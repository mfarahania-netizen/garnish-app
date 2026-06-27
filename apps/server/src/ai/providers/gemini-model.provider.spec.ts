const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn(() => ({ generateContent: mockGenerateContent }));
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({ getGenerativeModel: mockGetGenerativeModel })),
}));

import { GeminiModelProvider, toGeminiContents, toFunctionDeclarations } from './gemini-model.provider';

describe('GeminiModelProvider (mocked SDK — no live API)', () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
    mockGetGenerativeModel.mockClear();
  });

  it('returns text, model and usage from the SDK response', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => 'یک پلوی زعفرانی ساده',
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 },
      },
    });
    const provider = new GeminiModelProvider('realkey123', 'gemini-3.1-flash-lite');
    const result = await provider.generate({ prompt: 'یه شام پیشنهاد بده' });

    expect(provider.name).toBe('gemini');
    expect(result.text).toBe('یک پلوی زعفرانی ساده');
    expect(result.model).toBe('gemini-3.1-flash-lite');
    // E47-A10A: usage now carries provenance — 'provider' when the SDK returned real usageMetadata.
    expect(result.usage).toEqual({ promptTokens: 10, completionTokens: 20, totalTokens: 30, source: 'provider' });
    expect(mockGetGenerativeModel).toHaveBeenCalledWith({ model: 'gemini-3.1-flash-lite' });
  });

  it('SANITIZES errors and never leaks the API key', async () => {
    mockGenerateContent.mockRejectedValue(new Error('request failed key=realkey123 token AIzaSECRETKEY123456'));
    const provider = new GeminiModelProvider('realkey123', 'gemini-3.1-flash-lite');

    await expect(provider.generate({ prompt: 'x' })).rejects.toThrow(/gemini_provider_error/);
    try {
      await provider.generate({ prompt: 'x' });
      fail('should have thrown');
    } catch (e: any) {
      expect(e.message).not.toContain('realkey123');
      expect(e.message).not.toContain('AIzaSECRETKEY123456');
      expect(e.message).toContain('[redacted-key]');
    }
  });

  it('generateWithTools: registers the function declarations and returns the tool call Gemini asked for', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        candidates: [{ content: { parts: [{ functionCall: { name: 'fill_week_plan', args: {} } }] } }],
        usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 4, totalTokenCount: 16 },
      },
    });
    const provider = new GeminiModelProvider('realkey123', 'gemini-3.1-flash-lite');
    const res = await provider.generateWithTools!({
      messages: [{ role: 'system', content: 'sys' }, { role: 'user', content: 'برنامهٔ هفته رو بچین' }],
      tools: [{ name: 'fill_week_plan', description: 'چیدنِ هفته', parameters: { type: 'object', properties: {} } }],
    });
    expect(res.toolCalls).toEqual([{ id: 'call_0', name: 'fill_week_plan', arguments: '{}' }]);
    expect(res.text).toBe('');
    // the SDK must be built WITH tools + systemInstruction so Gemini can function-call.
    const built: any = (mockGetGenerativeModel.mock.calls.at(-1) as any)?.[0];
    expect(built.tools[0].functionDeclarations[0].name).toBe('fill_week_plan');
    expect(built.systemInstruction).toBe('sys');
  });

  it('generateWithTools: throws a sanitized error on an empty completion (so the chain falls through)', async () => {
    mockGenerateContent.mockResolvedValue({ response: { candidates: [{ content: { parts: [] } }] } });
    const provider = new GeminiModelProvider('realkey123', 'gemini-3.1-flash-lite');
    await expect(
      provider.generateWithTools!({ messages: [{ role: 'user', content: 'x' }], tools: [] }),
    ).rejects.toThrow(/gemini_provider_error.*empty completion/);
  });
});

describe('Gemini tool-calling mappers (pure)', () => {
  it('toGeminiContents: system→instruction, user→user, assistant.toolCalls→model.functionCall, tool→functionResponse', () => {
    const { systemInstruction, contents } = toGeminiContents([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'سلام' },
      { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'fill_week_plan', arguments: '{}' }] },
      { role: 'tool', toolCallId: 'c1', content: '{"ok":true,"placed":21}' },
    ]);
    expect(systemInstruction).toBe('sys');
    expect(contents[0]).toEqual({ role: 'user', parts: [{ text: 'سلام' }] });
    expect(contents[1]).toEqual({ role: 'model', parts: [{ functionCall: { name: 'fill_week_plan', args: {} } }] });
    // the functionResponse turn must carry the call's NAME (resolved from the synthesized id) + an object response.
    expect(contents[2]).toEqual({ role: 'user', parts: [{ functionResponse: { name: 'fill_week_plan', response: { ok: true, placed: 21 } } }] });
  });

  it('toGeminiContents: parses the tool-call arguments JSON string into an args object', () => {
    const { contents } = toGeminiContents([
      { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'add_to_meal_plan', arguments: '{"day":"شنبه","mealType":"شام"}' }] },
    ]);
    expect((contents[0].parts[0] as any).functionCall.args).toEqual({ day: 'شنبه', mealType: 'شام' });
  });

  it('toGeminiContents: wraps a non-JSON tool result so functionResponse.response is always an object', () => {
    const { contents } = toGeminiContents([
      { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 't', arguments: '{}' }] },
      { role: 'tool', toolCallId: 'c1', content: 'plain text' },
    ]);
    expect((contents[1].parts[0] as any).functionResponse.response).toEqual({ result: 'plain text' });
  });

  it('toFunctionDeclarations: keeps params for arg tools, OMITS parameters for no-arg tools', () => {
    const fds = toFunctionDeclarations([
      { name: 'fill_week_plan', description: 'd', parameters: { type: 'object', properties: {} } },
      { name: 'add_to_meal_plan', description: 'd', parameters: { type: 'object', properties: { day: { type: 'string', description: 'x' } }, required: ['day'] } },
    ]);
    expect(fds[0]).toEqual({ name: 'fill_week_plan', description: 'd' });
    expect(fds[1].parameters).toEqual({ type: 'object', properties: { day: { type: 'string', description: 'x' } }, required: ['day'] });
  });

  it('toFunctionDeclarations: drops schema keys Gemini rejects (e.g. additionalProperties)', () => {
    const fds = toFunctionDeclarations([
      { name: 't', description: 'd', parameters: { type: 'object', additionalProperties: false, properties: { x: { type: 'string' } } } } as any,
    ]);
    expect(fds[0].parameters).not.toHaveProperty('additionalProperties');
    expect(fds[0].parameters.properties).toEqual({ x: { type: 'string' } });
  });
});
