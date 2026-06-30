import { WorkflowService } from './workflow.service';

describe('WorkflowService alert lifecycle', () => {
  it('marks overdue alerts in the feed without mutating reads', async () => {
    const dueAt = new Date(Date.now() - 60_000);
    const prisma: any = {
      workflowAlert: {
        findMany: jest.fn(async () => [{ id: 'a1', status: 'open', dueAt, createdAt: new Date() }]),
        count: jest.fn(async () => 1),
      },
    };
    const svc = new WorkflowService(prisma, {} as any);

    const res = await svc.getAlerts('open', 50);

    expect(res.openCount).toBe(1);
    expect(res.alerts[0]).toMatchObject({ id: 'a1', isOverdue: true });
    expect(prisma.workflowAlert.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }));
  });

  it('stores resolver, assignee, last changer, and resolution reason', async () => {
    const prisma: any = {
      workflowAlert: {
        update: jest.fn(async ({ data }: any) => ({ id: 'a1', status: data.status })),
      },
    };
    const svc = new WorkflowService(prisma, {} as any);

    await svc.resolveAlert('a1', 'ops-1', 'fixed upstream model outage');

    expect(prisma.workflowAlert.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'a1' },
      data: expect.objectContaining({
        status: 'resolved',
        assignedTo: 'ops-1',
        lastChangedBy: 'ops-1',
        resolutionReason: 'fixed upstream model outage',
      }),
    }));
  });
});
