import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard (E3 deny-by-default)', () => {
  const makeContext = (user: any): ExecutionContext =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  const makeGuard = (requiredRoles: string[] | undefined) => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(requiredRoles),
    } as unknown as Reflector;
    return new RolesGuard(reflector);
  };

  it('DENIES when the guard is applied but no @Roles is declared (fail closed)', () => {
    expect(makeGuard(undefined).canActivate(makeContext({ isAdmin: true }))).toBe(false);
    expect(makeGuard([]).canActivate(makeContext({ isAdmin: true }))).toBe(false);
  });

  it('allows an admin when @Roles("admin") is required', () => {
    expect(makeGuard(['admin']).canActivate(makeContext({ isAdmin: true }))).toBe(true);
    expect(makeGuard(['admin']).canActivate(makeContext({ isAdmin: false, adminRole: 'ops' }))).toBe(true);
  });

  it('denies a non-admin when @Roles("admin") is required', () => {
    expect(makeGuard(['admin']).canActivate(makeContext({ isAdmin: false }))).toBe(false);
    expect(makeGuard(['admin']).canActivate(makeContext(undefined))).toBe(false);
  });

  it('denies an unknown role that the guard does not understand', () => {
    expect(makeGuard(['superuser']).canActivate(makeContext({ isAdmin: true }))).toBe(false);
  });
});
