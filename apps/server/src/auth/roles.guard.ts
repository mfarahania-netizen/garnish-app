import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // نقش‌های مورد نیاز را از دکوراتور @Roles() می‌خواند
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    // اگر هیچ نقشی تعریف نشده، یعنی همه می‌توانند دسترسی داشته باشند
    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();
    // چک می‌کند که آیا کاربر ادمین است یا نه
    return requiredRoles.some(role => {
      if (role === 'admin') return user?.isAdmin === true;
      return false;
    });
  }
}