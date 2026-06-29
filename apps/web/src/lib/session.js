/**
 * Client session id — the correlation key that ties a user's events into one "visit", so the control center
 * can derive sessions, session length, visit frequency, journeys and dwell. Industry-standard boundaries
 * (PostHog/Amplitude/Mixpanel): a session rotates after 30 minutes of INACTIVITY, with a 24-hour hard cap.
 *
 * Stored in localStorage so the id survives reloads and tabs (a true visit, not a per-tab fragment). The
 * id is opaque (UUID) — no PII. Best-effort: never throws.
 */

const KEY = 'garnish:session';
const IDLE_MS = 30 * 60 * 1000; // 30 min of inactivity → new session
const MAX_MS = 24 * 60 * 60 * 1000; // 24h hard cap → new session even if continuously active

function newId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `sx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode / quota — session id is best-effort */
  }
}

/**
 * Resolve the current session id, rotating on a 30-min idle gap or the 24h cap, and refresh last-activity.
 * Returns { id, started } where `started` is true ONLY on the call that opens a new session — the caller
 * uses it to emit `session_start` exactly once per session.
 */
export function touchSession() {
  const now = Date.now();
  const s = read();
  const valid =
    s &&
    typeof s.id === 'string' &&
    typeof s.startedAt === 'number' &&
    typeof s.lastSeen === 'number' &&
    now - s.lastSeen <= IDLE_MS &&
    now - s.startedAt <= MAX_MS;

  if (!valid) {
    const fresh = { id: newId(), startedAt: now, lastSeen: now };
    write(fresh);
    return { id: fresh.id, started: true };
  }
  s.lastSeen = now;
  write(s);
  return { id: s.id, started: false };
}
