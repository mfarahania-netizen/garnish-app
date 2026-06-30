import { isOwnerId } from './owner.guard';

/**
 * P1-14 (re-audit): the admin capability set the UI reads (GET /admin/me/permissions) so it can hide/disable the
 * actions an operator can't perform — instead of letting them click and eat a 403. Derived from the owner
 * allowlist + isAdmin. Owner = the irreversible / PII-exfiltrating tier (export, delete, password-reset, grant
 * admin, approve recipe); a plain admin can view, support (reveal with reason+audit) and operate workflows.
 *
 * This is the single place the role→capability mapping lives, so when a DB `role` field lands (support/privacy/
 * ops/content/finance) the finer grants slot in here without touching every guard/route.
 */
export interface AdminCapabilities {
  isAdmin: boolean;
  isOwner: boolean;
  canRevealPii: boolean;
  canExportPii: boolean;
  canDeleteUser: boolean;
  canResetPassword: boolean;
  canManageAdmins: boolean;
  canApproveRecipe: boolean;
  canRunWorkflows: boolean;
}

export function resolveAdminCapabilities(userId: string | undefined, isAdmin: boolean): AdminCapabilities {
  const isOwner = isOwnerId(userId);
  return {
    isAdmin,
    isOwner,
    canRevealPii: isAdmin, // support path — reason + audit are the accountability (not owner-gated)
    canExportPii: isOwner, // full PII export → owner only
    canDeleteUser: isOwner,
    canResetPassword: isOwner,
    canManageAdmins: isOwner, // grant / revoke the admin role
    canApproveRecipe: isOwner,
    canRunWorkflows: isAdmin,
  };
}
