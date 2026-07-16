/**
 * User response serializer (E2).
 *
 * Single source of truth for what user fields may leave the server. Built as an
 * explicit allow-list so that sensitive columns (`password`/hash, internal
 * tokens, etc.) can NEVER be returned, even if a query accidentally selects them
 * or the Prisma model grows new fields.
 *
 * Rule (see CONTRIBUTING.md): every endpoint that returns a user must pass it
 * through `sanitizeUser` / `sanitizeUsers`.
 */

export interface SafeUser {
  id: string;
  phone: string;
  phoneVerified?: boolean;
  name: string | null;
  email?: string | null;
  avatar?: string | null;
  avatarUrl?: string | null;
  isAdmin?: boolean;
  adminRole?: string;
  isGuest?: boolean;
  onboardingCompletedAt?: Date | null;
  onboardingComplete?: boolean;
  createdAt?: Date;
}

/** Fields that are safe to expose to clients. Anything not listed is dropped. */
const SAFE_FIELDS = [
  'id',
  'phone',
  'name',
  'email',
  'avatar',
  'avatarUrl',
  'isAdmin',
  'adminRole',
  'isGuest', // first-run gate: the client routes an un-onboarded guest through onboarding (not sensitive)
  'onboardingCompletedAt',
  'onboardingComplete',
  'createdAt',
] as const;

export function sanitizeUser(
  user: Record<string, any> | null | undefined,
): SafeUser | null {
  if (!user) return null;
  const out: Record<string, any> = {};
  for (const field of SAFE_FIELDS) {
    if (field in user && user[field] !== undefined) {
      out[field] = user[field];
    }
  }
  if (!('onboardingComplete' in out)) {
    out.onboardingComplete = Boolean(user.onboardingCompletedAt);
  }
  out.phoneVerified = Boolean(user.phone && user.phoneVerifiedAt);
  if (!('avatarUrl' in out) && user.avatar) {
    out.avatarUrl = user.avatar;
  }
  return out as SafeUser;
}

export function sanitizeUsers(
  users: Array<Record<string, any>> | null | undefined,
): SafeUser[] {
  if (!users) return [];
  return users
    .map((u) => sanitizeUser(u))
    .filter((u): u is SafeUser => u !== null);
}
