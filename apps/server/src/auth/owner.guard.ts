import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';

/**
 * Super-admin (owner) gate — advisor audit P0-1 ("hardcoded owner check", §13). The most dangerous, irreversible
 * admin ops (hard-delete, password-reset, full PII export, role grant/revoke) require the ACTOR's id to be in the
 * `ADMIN_OWNER_IDS` allowlist (comma-separated, set in the gitignored .env). A plain `isAdmin` can view, support
 * and operate; only an owner can perform the irreversible / PII-exfiltrating acts. So a single compromised admin
 * account is no longer "compromise everything".
 *
 * FAIL-CLOSED: if the allowlist is empty/unset, NO id matches → these ops are denied until an owner is configured.
 */
export function isOwnerId(userId: string | undefined | null): boolean {
  if (!userId) return false;
  const ids = (process.env.ADMIN_OWNER_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.includes(userId);
}

@Injectable()
export class OwnerGuard implements CanActivate {
  private readonly logger = new Logger(OwnerGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    if (isOwnerId(user?.userId)) return true;
    this.logger.warn(`owner-gated action denied for actor=${user?.userId ?? 'unknown'} (configure ADMIN_OWNER_IDS to grant)`);
    throw new ForbiddenException('super_admin_required');
  }
}
