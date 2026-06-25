/**
 * Jest setupFilesAfterEnv — HERMETIC tests, never live (no real paid Gemini call from `npm test`).
 *
 * Lives in `test/` (OUTSIDE `src/`) so the app's production build never compiles it — it uses jest globals
 * (beforeAll/beforeEach) that only exist in the test context.
 *
 * The app now runs the LIVE grounded LLM (AI_PROVIDER=gemini + AI_LIVE_ENABLED=true + a real GEMINI_API_KEY +
 * AI_CHAT_LIVE_ENABLED=true in `.env`). jest/ts-jest pulls `.env` into process.env during test-module load, so
 * those values would (a) flip deterministic-path specs onto the live branch and (b) make the live-smoke execute a
 * REAL call in every `npm test`. We strip them in a global `beforeAll` (runs before any describe-level beforeAll,
 * e.g. the live-smoke's) AND a global `beforeEach` — bulletproof regardless of when `.env` is read. Specs that
 * exercise the live adapter set them explicitly with a FAKE key + mock model (chat-orchestration.service.spec
 * `setLive`), which runs after these hooks.
 *
 * Escape hatch: AI_ALLOW_LIVE_IN_TESTS=true keeps the live config (for the on-demand `ai:live-smoke`).
 */
const LIVE_KEYS = [
  'AI_PROVIDER', 'AI_LIVE_ENABLED', 'AI_CHAT_LIVE_ENABLED', 'GEMINI_API_KEY', 'AI_MODEL_NAME',
  // cost-policy overrides also leak from .env and would flip default-budget specs; tests must use the code defaults
  'AI_BUDGET_COOLDOWN_MS', 'AI_BUDGET_5H_MAX_TOKENS', 'AI_BUDGET_DAILY_MAX_TOKENS', 'AI_BUDGET_WEEKLY_MAX_TOKENS', 'AI_BUDGET_MONTHLY_MAX_TOKENS',
];
const clearLiveEnv = () => {
  if (process.env.AI_ALLOW_LIVE_IN_TESTS === 'true') return;
  for (const k of LIVE_KEYS) delete process.env[k];
};
clearLiveEnv();
beforeAll(clearLiveEnv);
beforeEach(clearLiveEnv);
