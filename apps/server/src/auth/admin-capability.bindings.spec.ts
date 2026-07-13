import { AdminController } from '../admin/admin.controller';
import { WorkflowController } from '../workflow/workflow.controller';
import { ADMIN_CAPABILITY_KEY } from './admin-capability.decorator';
import { AdminCapabilityGuard } from './admin-capability.guard';

describe('sensitive admin mutation capability bindings', () => {
  const capability = (controller: any, method: string) => Reflect.getMetadata(ADMIN_CAPABILITY_KEY, controller.prototype[method]);

  it.each([
    [AdminController, 'respondToTicket', 'canManageTickets'],
    [AdminController, 'updateTicket', 'canManageTickets'],
    [AdminController, 'addTicketNote', 'canManageTickets'],
    [AdminController, 'approveRecipe', 'canApproveRecipe'],
    [AdminController, 'rejectRecipe', 'canApproveRecipe'],
    [AdminController, 'createUser', 'canCreateUsers'],
    [AdminController, 'updateUser', 'canEditUsers'],
    [AdminController, 'banUser', 'canBanUsers'],
    [AdminController, 'forceLogoutUser', 'canForceLogoutUsers'],
    [WorkflowController, 'run', 'canRunWorkflows'],
    [WorkflowController, 'ack', 'canRunWorkflows'],
    [WorkflowController, 'resolve', 'canRunWorkflows'],
    [WorkflowController, 'snooze', 'canRunWorkflows'],
  ])('%p.%s requires %s', (controller, method, expected) => {
    const handler = controller.prototype[method];
    const guards = Reflect.getMetadata('__guards__', handler) ?? [];

    expect(capability(controller, method)).toBe(expected);
    expect(guards).toContain(AdminCapabilityGuard);
  });
});
