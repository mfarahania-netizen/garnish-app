import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isAdminRole } from './admin-capabilities';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // نقش‌های مورد نیاز را از دکوراتور @Roles() می‌خواند
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    // E3: deny-by-default. اگر این گارد روی یک مسیر اعمال شده ولی هیچ نقشی
    // اعلام نشده، این یک پیکربندی اشتباه است و دسترسی بسته می‌شود (fail closed)،
    // نه باز. مسیرهای عمومی نباید اصلاً RolesGuard داشته باشند.
    if (!requiredRoles || requiredRoles.length === 0) return false;

    const { user } = context.switchToHttp().getRequest();
    // چک می‌کند که آیا کاربر ادمین است یا نه
    return requiredRoles.some(role => {
      if (role === 'admin') return isAdminRole(user?.adminRole, user?.isAdmin);
      return false;
    });
  }
}
