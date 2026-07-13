import { ForbiddenException } from '@nestjs/common';
import { AdminCapabilityGuard } from './admin-capability.guard';

describe('AdminCapabilityGuard', () => {
  const originalOwnerIds = process.env.ADMIN_OWNER_IDS;
  const reflector = { getAllAndOverride: jest.fn() };
  const guard = new AdminCapabilityGuard(reflector as any);

  const context = (user: Record<string, unknown>) => ({
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as any);

  beforeEach(() => {
    reflector.getAllAndOverride.mockReset();
    process.env.ADMIN_OWNER_IDS = '';
  });

  afterAll(() => {
    if (originalOwnerIds === undefined) delete process.env.ADMIN_OWNER_IDS;
    else process.env.ADMIN_OWNER_IDS = originalOwnerIds;
  });

  it('denies by default when a capability decorator is missing', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(() => guard.canActivate(context({ userId: 'admin-1', isAdmin: true, adminRole: 'admin' })))
      .toThrow(new ForbiddenException('admin_capability_required'));
  });

  it('denies a readonly admin from editing a user', () => {
    reflector.getAllAndOverride.mockReturnValue('canEditUsers');

    expect(() => guard.canActivate(context({ userId: 'readonly-1', isAdmin: true, adminRole: 'readonly' })))
      .toThrow(new ForbiddenException('admin_capability_required:canEditUsers'));
  });

  it('allows user edits only for an admin or configured owner', () => {
    reflector.getAllAndOverride.mockReturnValue('canEditUsers');

    expect(guard.canActivate(context({ userId: 'admin-1', isAdmin: true, adminRole: 'admin' }))).toBe(true);
    expect(() => guard.canActivate(context({ userId: 'support-1', isAdmin: true, adminRole: 'support' })))
      .toThrow(new ForbiddenException('admin_capability_required:canEditUsers'));
  });

  it('allows only capabilities assigned to the operator role', () => {
    reflector.getAllAndOverride.mockReturnValue('canApproveRecipe');
    expect(guard.canActivate(context({ userId: 'content-1', isAdmin: true, adminRole: 'content' }))).toBe(true);

    reflector.getAllAndOverride.mockReturnValue('canBanUsers');
    expect(() => guard.canActivate(context({ userId: 'content-1', isAdmin: true, adminRole: 'content' })))
      .toThrow(ForbiddenException);
  });

  it('preserves configured owner access regardless of the mutable role label', () => {
    process.env.ADMIN_OWNER_IDS = 'owner-1';
    reflector.getAllAndOverride.mockReturnValue('canManageTickets');

    expect(guard.canActivate(context({ userId: 'owner-1', isAdmin: true, adminRole: 'readonly' }))).toBe(true);
  });
});
