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

const RULES: EnvRule[] = [
  { key: 'DATABASE_URL', required: true },
  { key: 'JWT_SECRET', required: true, minLength: 32 },
  { key: 'GEMINI_API_KEY', required: true },
  // Optional — have safe defaults in code:
  { key: 'REDIS_HOST', required: false },
  { key: 'REDIS_PORT', required: false },
  { key: 'FRONTEND_URL', required: false },
  { key: 'PORT', required: false },
];

export interface ValidatedEnv {
  DATABASE_URL: string;
  JWT_SECRET: string;
  GEMINI_API_KEY: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  FRONTEND_URL: string;
  PORT: number;
}

export function validateEnv(
  env: NodeJS.ProcessEnv = process.env,
): ValidatedEnv {
  const errors: string[] = [];

  for (const rule of RULES) {
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
    GEMINI_API_KEY: env.GEMINI_API_KEY as string,
    REDIS_HOST: env.REDIS_HOST || 'localhost',
    REDIS_PORT: parseInt(env.REDIS_PORT || '6379', 10),
    FRONTEND_URL: env.FRONTEND_URL || 'http://localhost:5173',
    PORT: parseInt(env.PORT || '3000', 10),
  };
}
