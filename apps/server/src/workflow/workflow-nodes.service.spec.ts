import { WorkflowNodesService } from './workflow-nodes.service';

const ctx = (outputs: Record<string, any> = {}) => ({
  outputs,
  workflow: { id: 'wf1', key: 'cost-guard', name: 'Cost Guard', version: 1, defaultSeverity: 'warning' },
  runId: 'run1',
  log: jest.fn(),
});

describe('WorkflowNodesService safety behavior', () => {
  it('treats a null threshold input as unknown + breached, not as numeric zero', async () => {
    const svc = new WorkflowNodesService({} as any, {} as any, {} as any);
    const res = await svc.runNode(
      { id: 'gate', type: 'threshold', params: { input: 'source.metric', op: 'lte', threshold: 0, gate: true } } as any,
      ctx({ source: { metric: null } }) as any,
    );
    expect(res.output).toMatchObject({ value: null, threshold: 0, breached: true, status: 'unknown' });
    expect(res.stop).toBeUndefined();
  });

  it('suppresses duplicate alerts while an alert is snoozed', async () => {
    const prisma: any = {
      workflowAlert: {
        findFirst: jest.fn(async () => ({ id: 'alert-1', status: 'snoozed', snoozedUntil: new Date(Date.now() + 60_000) })),
        update: jest.fn(),
        create: jest.fn(),
      },
    };
    const svc = new WorkflowNodesService(prisma, {} as any, {} as any);
    const res = await svc.runNode(
      { id: 'alert', type: 'alert', params: { metric: 'ai.cost', title: 'AI cost', valueRef: 'gate.value', thresholdRef: 'gate.threshold' } } as any,
      ctx({ gate: { value: null, threshold: 0 } }) as any,
    );
    expect(res.output).toMatchObject({ alertId: 'alert-1', deduped: true, suppressed: true });
    expect(prisma.workflowAlert.create).not.toHaveBeenCalled();
    expect(prisma.workflowAlert.update).not.toHaveBeenCalled();
  });

  it('stamps new alerts with runbook owner and dueAt for incident triage', async () => {
    const prisma: any = {
      workflowAlert: {
        findFirst: jest.fn(async () => null),
        create: jest.fn(async ({ data }: any) => ({ id: 'alert-2', ...data })),
      },
    };
    const svc = new WorkflowNodesService(prisma, {} as any, {} as any);

    await svc.runNode(
      { id: 'alert', type: 'alert', params: { metric: 'ai.costToday', title: 'AI cost', valueRef: 'gate.value', thresholdRef: 'gate.threshold' } } as any,
      {
        ...ctx({ gate: { value: 9, threshold: 5 } }),
        workflow: { id: 'wf1', key: 'ai-cost-guardrail', name: 'Cost Guard', version: 1, defaultSeverity: 'critical' },
      } as any,
    );

    expect(prisma.workflowAlert.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerRole: expect.any(String),
        dueAt: expect.any(Date),
        lastChangedBy: 'system',
      }),
    });
  });
});
