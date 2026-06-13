const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn(() => ({ generateContent: mockGenerateContent }));
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({ getGenerativeModel: mockGetGenerativeModel })),
}));

import { GeminiModelProvider } from './gemini-model.provider';

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
    const provider = new GeminiModelProvider('realkey123', 'gemini-2.5-flash');
    const result = await provider.generate({ prompt: 'یه شام پیشنهاد بده' });

    expect(provider.name).toBe('gemini');
    expect(result.text).toBe('یک پلوی زعفرانی ساده');
    expect(result.model).toBe('gemini-2.5-flash');
    expect(result.usage).toEqual({ promptTokens: 10, completionTokens: 20, totalTokens: 30 });
    expect(mockGetGenerativeModel).toHaveBeenCalledWith({ model: 'gemini-2.5-flash' });
  });

  it('SANITIZES errors and never leaks the API key', async () => {
    mockGenerateContent.mockRejectedValue(new Error('request failed key=realkey123 token AIzaSECRETKEY123456'));
    const provider = new GeminiModelProvider('realkey123', 'gemini-2.5-flash');

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
});
