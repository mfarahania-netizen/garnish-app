/**
 * Recommendation attribution store — carries the recsys `requestId` ACROSS navigation so a later save or
 * cook can be joined back to the exact served slate (exposure↔reward, the IPS off-policy-learning join).
 *
 * Why this exists: the ranker stamps each served slate with a `requestId` and echoes it on the
 * recommendation cards. A click is attributable inline, but a SAVE or a COOK usually happens on a different
 * screen (recipe detail / cook mode) — by then the `requestId` is out of scope and the join is lost. This
 * remembers `recipeId → requestId` for a conversation window so those downstream rewards stay attributable.
 *
 * Privacy: shape-only (recipeId + requestId + timestamp) — never any free text or PII. localStorage so the
 * window survives across sessions (a recipe recommended today and cooked next week is still attributable),
 * pruned to a bounded, expiring set. Best-effort: never throws, never blocks navigation.
 */
import { hasAnalyticsConsent } from './analytics-init';

const KEY = 'garnish:rec-attribution';
const PERSONALIZATION_KEY = 'garnish.consent.personalization';
const WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // 14-day conversion window (spec B2: a generous 7–30d window)
const MAX_ENTRIES = 200; // bound the store; keep the most recent

export function clearRecommendationAttribution() {
  try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}

function hasAttributionConsent() {
  if (!hasAnalyticsConsent()) return false;
  try {
    // This mirror is an early local deny, never proof of canonical consent. It is
    // written true only after a current server acknowledgement and runtime approval.
    return localStorage.getItem(PERSONALIZATION_KEY) === 'true';
  } catch {
    return false;
  }
}

function readMap() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(map) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* private mode / quota — drop silently, attribution is best-effort */
  }
}

/** Remember that `recipeId` was reached from a recommendation served under `requestId` (called on click). */
export function rememberRecommendation(recipeId, requestId) {
  if (!hasAttributionConsent()) {
    clearRecommendationAttribution();
    return;
  }
  if (!recipeId || !requestId) return;
  try {
    const now = Date.now();
    const map = readMap();
    map[recipeId] = { requestId, ts: now };
    // prune expired + cap to the most-recent MAX_ENTRIES so the store can't grow unbounded
    const fresh = Object.entries(map)
      .filter(([, v]) => v && typeof v.ts === 'number' && now - v.ts < WINDOW_MS)
      .sort((a, b) => b[1].ts - a[1].ts)
      .slice(0, MAX_ENTRIES);
    writeMap(Object.fromEntries(fresh));
  } catch {
    /* never break navigation for telemetry */
  }
}

/** Recall the `requestId` a recipe was recommended under, if still within the window — else null. */
export function recallRecommendation(recipeId) {
  if (!hasAttributionConsent()) {
    clearRecommendationAttribution();
    return null;
  }
  if (!recipeId) return null;
  try {
    const entry = readMap()[recipeId];
    if (!entry || !entry.requestId || typeof entry.ts !== 'number') return null;
    if (Date.now() - entry.ts >= WINDOW_MS) return null;
    return entry.requestId;
  } catch {
    return null;
  }
}
