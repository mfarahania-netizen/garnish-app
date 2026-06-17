import { validateEnv } from './env.validation';

describe('validateEnv (E1 fail-fast)', () => {
  let exitSpy: jest.SpyInstance;
  let errSpy: jest.SpyInstance;

  beforeEach(() => {
    // process.exit(1) on failure → turn it into a throwable for assertions.
    exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation(((code?: number) => {
        throw new Error(`exit:${code}`);
      }) as any);
    errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
    errSpy.mockRestore();
  });

  const valid = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    JWT_SECRET: 'x'.repeat(40),
    GEMINI_API_KEY: 'realkey123',
  };

  it('returns a normalized config for valid env and does not exit', () => {
    const cfg = validateEnv(valid as any);
    expect(cfg.DATABASE_URL).toBe(valid.DATABASE_URL);
    expect(cfg.REDIS_PORT).toBe(6379);
    expect(cfg.FRONTEND_URL).toBe('http://localhost:5173');
    expect(cfg.PORT).toBe(3000);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('exits(1) when required vars are missing', () => {
    expect(() => validateEnv({} as any)).toThrow('exit:1');
    expect(errSpy).toHaveBeenCalled();
  });

  it('exits(1) when a secret is still an example placeholder', () => {
    expect(() =>
      validateEnv({ ...valid, JWT_SECRET: 'your-strong-random-secret-here' } as any),
    ).toThrow('exit:1');
  });

  it('exits(1) when JWT_SECRET is too short', () => {
    expect(() =>
      validateEnv({ ...valid, JWT_SECRET: 'sk_supersecretvalue' } as any),
    ).toThrow('exit:1');
  });

  // TRUTH-AND-SAFETY FIX 2: GEMINI_API_KEY is required ONLY for live Gemini; the stub/dev path boots without it.
  const base = { DATABASE_URL: valid.DATABASE_URL, JWT_SECRET: valid.JWT_SECRET };

  it('boots WITHOUT GEMINI_API_KEY on the default stub path (AI_PROVIDER unset)', () => {
    const cfg = validateEnv({ ...base } as any);
    expect(cfg.GEMINI_API_KEY).toBe('');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('boots WITHOUT a key when AI_PROVIDER=stub explicitly', () => {
    validateEnv({ ...base, AI_PROVIDER: 'stub' } as any);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('does NOT require a key when gemini is selected but live is OFF', () => {
    validateEnv({ ...base, AI_PROVIDER: 'gemini', AI_LIVE_ENABLED: 'false' } as any);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('exits(1) ONLY for live gemini (AI_PROVIDER=gemini + AI_LIVE_ENABLED=true) with a missing key', () => {
    expect(() =>
      validateEnv({ ...base, AI_PROVIDER: 'gemini', AI_LIVE_ENABLED: 'true' } as any),
    ).toThrow('exit:1');
  });

  it('boots for live gemini WHEN a real key is present', () => {
    validateEnv({ ...base, AI_PROVIDER: 'gemini', AI_LIVE_ENABLED: 'true', GEMINI_API_KEY: 'realkey123' } as any);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('never prints a secret value in the failure output', () => {
    try {
      validateEnv({ ...valid, JWT_SECRET: 'sk_supersecretvalue' } as any);
    } catch {
      /* expected */
    }
    const printed = errSpy.mock.calls.flat().join(' ');
    expect(printed).toContain('JWT_SECRET');
    expect(printed).not.toContain('sk_supersecretvalue');
  });
});
