import { isOpsAdminId, isOwnerId, isPrivacyAdminId } from './owner.guard';

/**
 * P1-14 (re-audit): the admin capability set the UI reads (GET /admin/me/permissions) so it can hide/disable the
 * actions an operator can't perform — instead of letting them click and eat a 403. Derived from the owner
 * allowlist + isAdmin. Owner = the irreversible / PII-exfiltrating tier (export, delete, password-reset, grant
 * admin); bounded operational mutations are separately assigned to content/support/ops roles.
 *
 * This is the single place the role→capability mapping lives, so when a DB `role` field lands (support/privacy/
 * ops/content/finance) the finer grants slot in here without touching every guard/route.
 */
export interface AdminCapabilities {
  isAdmin: boolean;
  isOwner: boolean;
  adminRole: string;
  canRevealPii: boolean;
  canExportPii: boolean;
  canDeleteUser: boolean;
  canResetPassword: boolean;
  canManageAdmins: boolean;
  canApproveRecipe: boolean;
  canRunWorkflows: boolean;
  canCreateUsers: boolean;
  canEditUsers: boolean;
  canBanUsers: boolean;
  canForceLogoutUsers: boolean;
  canManageTickets: boolean;
}

const ROLE_SET = new Set(['owner', 'admin', 'support', 'privacy', 'ops', 'content', 'finance', 'readonly']);

export function normalizeAdminRole(adminRole: string | undefined | null, isAdmin: boolean): string {
  const role = String(adminRole || '').trim().toLowerCase();
  if (ROLE_SET.has(role)) return role;
  return isAdmin ? 'admin' : 'user';
}

export function isAdminRole(adminRole: string | undefined | null, isAdmin: boolean): boolean {
  return normalizeAdminRole(adminRole, isAdmin) !== 'user' || !!isAdmin;
}

export function resolveAdminCapabilities(userId: string | undefined, isAdmin: boolean, adminRole?: string | null): AdminCapabilities {
  const role = normalizeAdminRole(adminRole, isAdmin);
  // ADMIN_OWNER_IDS is the security source of truth. A mutable DB label must not silently grant owner powers.
  const isOwner = isOwnerId(userId);
  const privacy = isOwner || role === 'privacy' || role === 'support' || isPrivacyAdminId(userId);
  const ops = isOwner || role === 'ops' || isOpsAdminId(userId);
  const content = isOwner || role === 'content';
  const admin = isAdminRole(role, isAdmin);
  return {
    isAdmin: admin,
    isOwner,
    adminRole: role,
    canRevealPii: admin && privacy,
    canExportPii: isOwner,
    canDeleteUser: isOwner,
    canResetPassword: isOwner,
    canManageAdmins: isOwner, // grant / revoke the admin role
    canApproveRecipe: content,
    canRunWorkflows: admin && ops,
    canCreateUsers: isOwner || role === 'admin',
    canEditUsers: isOwner || role === 'admin',
    canBanUsers: isOwner || role === 'admin' || role === 'ops',
    canForceLogoutUsers: isOwner || role === 'admin' || role === 'ops',
    canManageTickets: isOwner || role === 'admin' || role === 'support',
  };
}
