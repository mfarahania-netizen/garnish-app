// Mock the Gemini SDK so constructing GeminiModelProvider never touches the network.
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({ getGenerativeModel: jest.fn() })),
}));

import { resolveAiProviderConfig, createModelProvider } from './model-provider.factory';
import { StubModelProvider } from './stub-model.provider';
import { GeminiModelProvider } from './gemini-model.provider';

const silentLogger = { warn: jest.fn(), log: jest.fn() };

describe('model-provider.factory', () => {
  beforeEach(() => silentLogger.warn.mockClear());

  it('defaults to the STUB provider when env is absent', () => {
    const cfg = resolveAiProviderConfig({} as any);
    expect(cfg.provider).toBe('stub');
    expect(cfg.liveEnabled).toBe(false);
    expect(createModelProvider(cfg, silentLogger)).toBeInstanceOf(StubModelProvider);
  });

  it('selects GEMINI only when AI_PROVIDER=gemini AND AI_LIVE_ENABLED=true AND a real key exists', () => {
    const cfg = resolveAiProviderConfig({
      AI_PROVIDER: 'gemini',
      AI_LIVE_ENABLED: 'true',
      GEMINI_API_KEY: 'realkey123',
      AI_MODEL_NAME: 'gemini-2.5-flash',
    } as any);
    expect(cfg).toMatchObject({ provider: 'gemini', liveEnabled: true, apiKey: 'realkey123', modelName: 'gemini-2.5-flash' });
    expect(createModelProvider(cfg, silentLogger)).toBeInstanceOf(GeminiModelProvider);
  });

  it('falls back to STUB (safe) when gemini is requested but the key is missing/placeholder', () => {
    const cfg = resolveAiProviderConfig({ AI_PROVIDER: 'gemini', AI_LIVE_ENABLED: 'true', GEMINI_API_KEY: 'your-gemini-api-key' } as any);
    expect(cfg.apiKey).toBeUndefined();
    expect(createModelProvider(cfg, silentLogger)).toBeInstanceOf(StubModelProvider);
    expect(silentLogger.warn).toHaveBeenCalled();
  });

  it('uses STUB when AI_LIVE_ENABLED is not exactly true, even if AI_PROVIDER=gemini', () => {
    const cfg = resolveAiProviderConfig({ AI_PROVIDER: 'gemini', AI_LIVE_ENABLED: 'false', GEMINI_API_KEY: 'realkey123' } as any);
    expect(createModelProvider(cfg, silentLogger)).toBeInstanceOf(StubModelProvider);
  });

  it('defaults the model name and never throws on odd env', () => {
    const cfg = resolveAiProviderConfig({ AI_PROVIDER: 'GEMINI', AI_LIVE_ENABLED: 'TRUE', GEMINI_API_KEY: 'k' } as any);
    expect(cfg.modelName).toBe('gemini-2.5-flash');
    expect(cfg.provider).toBe('gemini');
    expect(cfg.liveEnabled).toBe(true);
  });
});
