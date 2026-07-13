import { SetMetadata } from '@nestjs/common';
import type { AdminCapabilities } from './admin-capabilities';

export const ADMIN_CAPABILITY_KEY = 'admin_capability';

export type AdminCapability = {
  [K in keyof AdminCapabilities]: AdminCapabilities[K] extends boolean ? K : never;
}[keyof AdminCapabilities];

/**
 * Declares the single action capability required by AdminCapabilityGuard.
 * The guard is intentionally default-deny when this metadata is absent.
 */
export const RequireAdminCapability = (capability: AdminCapability) =>
  SetMetadata(ADMIN_CAPABILITY_KEY, capability);
