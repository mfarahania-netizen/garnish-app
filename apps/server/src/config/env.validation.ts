/**
 * Fail-fast environment validation (E1).
 *
 * Runs once at boot, before the Nest app is created. If a required secret is
 * missing, empty, or still set to an example placeholder, the process exits
 * immediately instead of starting in an insecure / half-configured state.
 *
 * Zero-dependency on purpose: adding `zod` (or any new dep) is an EL/Founder
 * decision (Constitution Part 10.1) and would churn the lockfile. This guard
 * gives the same fail-fast guarantee the E1 ticket asks for; it can be swapped
 * for a zod schema later without changing call sites.
 *
 * SECURITY: never log or print a secret value from here. We only ever report
 * a variable's *name* and *why* it failed.
 */

/** Known weak/example values that must never reach a running server. */
const PLACEHOLDER_VALUES = new Set<string>([
  'your-strong-random-secret-here',
  'your-gemini-api-key',
  'PUT_REAL_KEY_IN_ENV_ONLY',
  'PUT_REAL_BODY_ID_IN_ENV_ONLY',
  'changeme',
  'secret',
  'postgresql://username:password@localhost:5432/garnish_db',
]);

interface EnvRule {
  key: string;
  required: boolean;
  /** Minimum length, applied only to high-entropy secrets. */
  minLength?: number;
}

/**
 * GEMINI_API_KEY is required ONLY when LIVE Gemini is actually selected — i.e. AI_PROVIDER=gemini AND
 * AI_LIVE_ENABLED=true (mirrors model-provider.factory's exact condition). The default stub/dev path boots
 * cleanly WITHOUT a key (safe-default). (TRUTH-AND-SAFETY FIX 2.)
 */
function isLiveGeminiSelected(env: NodeJS.ProcessEnv): boolean {
  return (env.AI_PROVIDER ?? '').trim().toLowerCase() === 'gemini'
    && (env.AI_LIVE_ENABLED ?? '').trim().toLowerCase() === 'true';
}

function isMelipayamakSmsEnabled(env: NodeJS.ProcessEnv): boolean {
  return (env.SMS_PROVIDER ?? '').trim().toLowerCase() === 'melipayamak'
    && (env.MELIPAYAMAK_ENABLED ?? '').trim().toLowerCase() === 'true';
}

function isGoogleAuthEnabled(env: NodeJS.ProcessEnv): boolean {
  return (env.GOOGLE_AUTH_ENABLED ?? '').trim().toLowerCase() === 'true';
}

function buildRules(env: NodeJS.ProcessEnv): EnvRule[] {
  return [
    { key: 'DATABASE_URL', required: true },
    { key: 'JWT_SECRET', required: true, minLength: 32 },
    { key: 'GEMINI_API_KEY', required: isLiveGeminiSelected(env) },
    // Optional — have safe defaults in code:
    { key: 'REDIS_HOST', required: false },
    { key: 'REDIS_PORT', required: false },
    { key: 'FRONTEND_URL', required: false },
    { key: 'PORT', required: false },
    { key: 'TRUST_PROXY_HOPS', required: false },
    { key: 'SMS_PROVIDER', required: false },
    { key: 'MELIPAYAMAK_USERNAME', required: isMelipayamakSmsEnabled(env) },
    { key: 'MELIPAYAMAK_API_KEY', required: isMelipayamakSmsEnabled(env), minLength: 16 },
    { key: 'MELIPAYAMAK_PATTERN_BODY_ID', required: isMelipayamakSmsEnabled(env) },
    { key: 'MELIPAYAMAK_ENABLED', required: false },
    { key: 'SMS_PROVIDER_TIMEOUT_MS', required: false },
    { key: 'SMS_DEV_LOG_OTP', required: false },
    { key: 'OTP_TTL_SECONDS', required: false },
    { key: 'OTP_RESEND_COOLDOWN_SECONDS', required: false },
    { key: 'OTP_MAX_ATTEMPTS', required: false },
    { key: 'OTP_DAILY_LIMIT_PER_PHONE', required: false },
    { key: 'GOOGLE_AUTH_ENABLED', required: false },
    { key: 'GOOGLE_CLIENT_ID', required: isGoogleAuthEnabled(env), minLength: 20 },
  ];
}

export interface ValidatedEnv {
  DATABASE_URL: string;
  JWT_SECRET: string;
  GEMINI_API_KEY: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  FRONTEND_URL: string;
  PORT: number;
  TRUST_PROXY_HOPS: number;
  SMS_PROVIDER_TIMEOUT_MS: number;
}

export function validateEnv(
  env: NodeJS.ProcessEnv = process.env,
): ValidatedEnv {
  const errors: string[] = [];

  for (const rule of buildRules(env)) {
    const raw = env[rule.key];
    const value = typeof raw === 'string' ? raw.trim() : '';

    if (!value) {
      if (rule.required) errors.push(`${rule.key} is required but missing/empty`);
      continue;
    }
    if (PLACEHOLDER_VALUES.has(value)) {
      errors.push(`${rule.key} is still set to an example placeholder — set a real value`);
      continue;
    }
    if (rule.minLength && value.length < rule.minLength) {
      errors.push(`${rule.key} is too short (min ${rule.minLength} chars) — use a strong random secret`);
    }
  }

  // GDPR (advisor audit): in PRODUCTION the consent gate must be ENFORCED. Booting prod with the gate off/log
  // would route personalization signals without the personalization consent purpose — a real EU exposure. The
  // fail-closed consent read already exists; this guarantees prod is configured to use it. Dev/test (NODE_ENV
  // not 'production') keep the default-off, byte-identical behavior.
  if ((env.NODE_ENV ?? '').trim().toLowerCase() === 'production') {
    const gate = (env.EVENT_CONSENT_GATE_MODE ?? '').trim().toLowerCase();
    if (gate !== 'enforce') {
      errors.push(`EVENT_CONSENT_GATE_MODE must be 'enforce' in production (GDPR) — got '${gate || 'unset'}'`);
    }
  }

  // Express must not trust caller-supplied X-Forwarded-For by default. A
  // positive hop count is allowed only when the operator knows the exact
  // number of ingress proxies and direct public access to the app is blocked.
  const trustProxyRaw = (env.TRUST_PROXY_HOPS ?? '').trim();
  const trustProxyHops = trustProxyRaw ? Number(trustProxyRaw) : 0;
  if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0 || trustProxyHops > 10) {
    errors.push('TRUST_PROXY_HOPS must be an integer between 0 and 10');
  }

  const smsTimeoutRaw = (env.SMS_PROVIDER_TIMEOUT_MS ?? '').trim();
  const smsProviderTimeoutMs = smsTimeoutRaw ? Number(smsTimeoutRaw) : 5000;
  if (!Number.isInteger(smsProviderTimeoutMs) || smsProviderTimeoutMs < 1000 || smsProviderTimeoutMs > 15_000) {
    errors.push('SMS_PROVIDER_TIMEOUT_MS must be an integer between 1000 and 15000');
  }

  const smsDevLogRaw = (env.SMS_DEV_LOG_OTP ?? '').trim().toLowerCase();
  if (smsDevLogRaw && smsDevLogRaw !== 'true' && smsDevLogRaw !== 'false') {
    errors.push('SMS_DEV_LOG_OTP must be true or false');
  }
  const nodeEnv = (env.NODE_ENV ?? '').trim().toLowerCase();
  if (smsDevLogRaw === 'true' && nodeEnv !== 'development' && nodeEnv !== 'test') {
    errors.push('SMS_DEV_LOG_OTP may be true only when NODE_ENV is development or test');
  }

  const otpBounds: Array<[string, number, number]> = [
    ['OTP_TTL_SECONDS', 30, 600],
    ['OTP_RESEND_COOLDOWN_SECONDS', 10, 600],
    ['OTP_MAX_ATTEMPTS', 1, 10],
    ['OTP_DAILY_LIMIT_PER_PHONE', 1, 50],
  ];
  for (const [key, minimum, maximum] of otpBounds) {
    const raw = (env[key] ?? '').trim();
    if (!raw) continue;
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
      errors.push(`${key} must be an integer between ${minimum} and ${maximum}`);
    }
  }

  if (errors.length > 0) {
    // No secret values are included — only key names and failure reasons.
    const message =
      'Environment validation failed:\n' +
      errors.map((e) => `  - ${e}`).join('\n') +
      '\nSee apps/server/.env.example. Refusing to start.';
    // eslint-disable-next-line no-console
    console.error(message);
    process.exit(1);
  }

  return {
    DATABASE_URL: env.DATABASE_URL as string,
    JWT_SECRET: env.JWT_SECRET as string,
    GEMINI_API_KEY: env.GEMINI_API_KEY ?? '', // '' on the stub/dev path (no key required)
    REDIS_HOST: env.REDIS_HOST || 'localhost',
    REDIS_PORT: parseInt(env.REDIS_PORT || '6379', 10),
    FRONTEND_URL: env.FRONTEND_URL || 'http://localhost:5173',
    PORT: parseInt(env.PORT || '3000', 10),
    TRUST_PROXY_HOPS: trustProxyHops,
    SMS_PROVIDER_TIMEOUT_MS: smsProviderTimeoutMs,
  };
}
