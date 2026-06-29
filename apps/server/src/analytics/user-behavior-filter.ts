/**
 * Operator/system events must never appear in USER-behavior analytics or the live activity feed — they are
 * the operator's own actions (the admin panel) or background jobs (cron), not what real users do. Excluding
 * them is an explicit founder requirement ("بازدید ادمین برای چی باید توی این بیاد" — admin views must not
 * pollute the user feed). Prefix-based, so any new `admin_` or `cron_` type is covered automatically, plus
 * an explicit set for non-prefixed system events.
 *
 * This is the single source of truth for "is this real user behavior?" — every broad UserEvent aggregate
 * (the live feed, event counts, sessions, journeys, page rates) filters through it.
 */

const NON_USER_PREFIXES = ['admin_', 'cron_'];
const NON_USER_TYPES = new Set<string>([
  'resolve_miss', // ingredient-resolver data-quality signal — a system event, not a user action
]);

/** True when an event type represents real USER behavior (not an operator/system event). */
export function isUserBehaviorEvent(type: string | null | undefined): boolean {
  if (!type) return false;
  const t = String(type).toLowerCase();
  if (NON_USER_PREFIXES.some((p) => t.startsWith(p))) return false;
  return !NON_USER_TYPES.has(t);
}

/**
 * Prisma `where` fragment that excludes operator/system events from a UserEvent query. Merge into a `where`
 * (it sets `NOT`). Prisma semantics: `NOT: [a, b, c]` ⇒ NOT a AND NOT b AND NOT c — i.e. exclude all of them.
 */
export const USER_BEHAVIOR_EVENT_WHERE = {
  NOT: [
    { type: { startsWith: 'admin_' } },
    { type: { startsWith: 'cron_' } },
    { type: { in: Array.from(NON_USER_TYPES) } },
  ],
};
