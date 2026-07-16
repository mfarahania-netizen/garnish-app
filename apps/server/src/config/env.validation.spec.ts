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
    expect(cfg.TRUST_PROXY_HOPS).toBe(0);
    expect(cfg.SMS_PROVIDER_TIMEOUT_MS).toBe(5000);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('accepts only an explicit bounded integer proxy-hop count', () => {
    expect(validateEnv({ ...valid, TRUST_PROXY_HOPS: '2' } as any).TRUST_PROXY_HOPS).toBe(2);
    for (const invalid of ['-1', '1.5', 'abc', '11']) {
      expect(() => validateEnv({ ...valid, TRUST_PROXY_HOPS: invalid } as any)).toThrow('exit:1');
    }
  });

  it('accepts only a bounded integer SMS provider timeout', () => {
    expect(validateEnv({ ...valid, SMS_PROVIDER_TIMEOUT_MS: '7000' } as any).SMS_PROVIDER_TIMEOUT_MS).toBe(7000);
    for (const invalid of ['999', '15001', '1.5', 'abc']) {
      expect(() => validateEnv({ ...valid, SMS_PROVIDER_TIMEOUT_MS: invalid } as any)).toThrow('exit:1');
    }
  });

  it('permits raw OTP logs only in explicit development or test environments', () => {
    expect(() => validateEnv({ ...valid, NODE_ENV: 'development', SMS_DEV_LOG_OTP: 'true' } as any)).not.toThrow();
    expect(() => validateEnv({ ...valid, NODE_ENV: 'test', SMS_DEV_LOG_OTP: 'true' } as any)).not.toThrow();
    expect(() => validateEnv({ ...valid, NODE_ENV: 'staging', SMS_DEV_LOG_OTP: 'true' } as any)).toThrow('exit:1');
    expect(() => validateEnv({ ...valid, SMS_DEV_LOG_OTP: 'true' } as any)).toThrow('exit:1');
    expect(() => validateEnv({ ...valid, SMS_DEV_LOG_OTP: 'yes' } as any)).toThrow('exit:1');
    expect(() => validateEnv({ ...valid, SMS_DEV_LOG_OTP: 'false' } as any)).not.toThrow();
  });

  it('keeps Household v1 default-off and requires an independent strong invite pepper when enabled', () => {
    expect(() => validateEnv({ ...valid } as any)).not.toThrow();
    expect(() => validateEnv({ ...valid, HOUSEHOLD_V1_ENABLED: 'true' } as any)).toThrow('exit:1');
    expect(() => validateEnv({
      ...valid,
      HOUSEHOLD_V1_ENABLED: 'true',
      HOUSEHOLD_INVITE_PEPPER: 'h'.repeat(32),
    } as any)).not.toThrow();
    expect(() => validateEnv({ ...valid, HOUSEHOLD_V1_ENABLED: 'yes' } as any)).toThrow('exit:1');
  });

  it.each([
    ['OTP_TTL_SECONDS', '29'],
    ['OTP_RESEND_COOLDOWN_SECONDS', '601'],
    ['OTP_MAX_ATTEMPTS', '0'],
    ['OTP_DAILY_LIMIT_PER_PHONE', '1.5'],
  ])('rejects an unsafe %s value', (key, value) => {
    expect(() => validateEnv({ ...valid, [key]: value } as any)).toThrow('exit:1');
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

  // GDPR (advisor audit): production must run the consent gate in 'enforce'.
  it('exits(1) in production when EVENT_CONSENT_GATE_MODE is not enforce (unset or off)', () => {
    expect(() => validateEnv({ ...valid, NODE_ENV: 'production' } as any)).toThrow('exit:1');
    expect(() => validateEnv({ ...valid, NODE_ENV: 'production', EVENT_CONSENT_GATE_MODE: 'off' } as any)).toThrow('exit:1');
    expect(() => validateEnv({ ...valid, NODE_ENV: 'production', EVENT_CONSENT_GATE_MODE: 'log' } as any)).toThrow('exit:1');
  });

  it('boots in production when EVENT_CONSENT_GATE_MODE=enforce', () => {
    expect(() => validateEnv({ ...valid, NODE_ENV: 'production', EVENT_CONSENT_GATE_MODE: 'enforce' } as any)).not.toThrow();
  });

  it('does NOT require enforce outside production (dev/test default-off stays valid)', () => {
    expect(() => validateEnv({ ...valid } as any)).not.toThrow();
    expect(() => validateEnv({ ...valid, NODE_ENV: 'development' } as any)).not.toThrow();
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
