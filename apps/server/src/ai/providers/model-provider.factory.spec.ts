// Mock the Gemini SDK so constructing GeminiModelProvider never touches the network.
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({ getGenerativeModel: jest.fn() })),
}));

import { resolveAiProviderConfig, createModelProvider, resolveChatLiveEnabled, isLiveModelConfigured } from './model-provider.factory';
import { StubModelProvider } from './stub-model.provider';
import { GeminiModelProvider } from './gemini-model.provider';

const LIVE = { AI_PROVIDER: 'gemini', AI_LIVE_ENABLED: 'true', GEMINI_API_KEY: 'realkey123' } as any;

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
      AI_MODEL_NAME: 'gemini-3.1-flash-lite',
    } as any);
    expect(cfg).toMatchObject({ provider: 'gemini', liveEnabled: true, apiKey: 'realkey123', modelName: 'gemini-3.1-flash-lite' });
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
    expect(cfg.modelName).toBe('gemini-3.1-flash-lite');
    expect(cfg.provider).toBe('gemini');
    expect(cfg.liveEnabled).toBe(true);
  });

  describe('resolveChatLiveEnabled (E47-A8 chat-live gate)', () => {
    it('is FALSE by default (no flags)', () => {
      expect(isLiveModelConfigured({} as any)).toBe(false);
      expect(resolveChatLiveEnabled({} as any)).toBe(false);
    });

    it('is TRUE when general live is configured and no chat override is set', () => {
      expect(isLiveModelConfigured(LIVE)).toBe(true);
      expect(resolveChatLiveEnabled(LIVE)).toBe(true);
    });

    it('is TRUE when general live + AI_CHAT_LIVE_ENABLED=true', () => {
      expect(resolveChatLiveEnabled({ ...LIVE, AI_CHAT_LIVE_ENABLED: 'true' })).toBe(true);
    });

    it('KILL SWITCH: FALSE when AI_CHAT_LIVE_ENABLED=false even if general live is on', () => {
      expect(resolveChatLiveEnabled({ ...LIVE, AI_CHAT_LIVE_ENABLED: 'false' })).toBe(false);
    });

    it('is FALSE when the key is placeholder/missing, regardless of the chat flag', () => {
      expect(resolveChatLiveEnabled({ ...LIVE, GEMINI_API_KEY: 'your-gemini-api-key', AI_CHAT_LIVE_ENABLED: 'true' })).toBe(false);
      expect(resolveChatLiveEnabled({ AI_PROVIDER: 'gemini', AI_LIVE_ENABLED: 'true', AI_CHAT_LIVE_ENABLED: 'true' } as any)).toBe(false);
    });

    it('is FALSE when AI_LIVE_ENABLED is not true even with the chat flag', () => {
      expect(resolveChatLiveEnabled({ ...LIVE, AI_LIVE_ENABLED: 'false', AI_CHAT_LIVE_ENABLED: 'true' })).toBe(false);
    });
  });
});
