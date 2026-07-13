import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { resolveAdminCapabilities } from './admin-capabilities';
import { ADMIN_CAPABILITY_KEY, type AdminCapability } from './admin-capability.decorator';

@Injectable()
export class AdminCapabilityGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const capability = this.reflector.getAllAndOverride<AdminCapability>(ADMIN_CAPABILITY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!capability) throw new ForbiddenException('admin_capability_required');

    const { user } = context.switchToHttp().getRequest();
    const capabilities = resolveAdminCapabilities(user?.userId, !!user?.isAdmin, user?.adminRole);
    if (capabilities[capability] !== true) {
      throw new ForbiddenException(`admin_capability_required:${String(capability)}`);
    }
    return true;
  }
}
