import { WorkflowRunnerService } from './workflow-runner.service';

// Minimal in-memory Prisma double: records the run row + lets update mutate it.
function mkPrisma() {
  const row: any = {};
  return {
    workflowRun: {
      create: jest.fn(async ({ data }: any) => { Object.assign(row, { id: 'run1' }, data); return { ...row }; }),
      update: jest.fn(async ({ data }: any) => { Object.assign(row, data); return { ...row }; }),
    },
    _row: row,
  };
}

const wf = (graph: any) => ({ id: 'w1', key: 'k', name: 'n', version: 1, defaultSeverity: 'info', graph });

describe('WorkflowRunnerService', () => {
  it('runs nodes in topological order and succeeds', async () => {
    const nodes = { runNode: jest.fn(async (node: any) => ({ output: { ran: node.id } })) };
    const prisma = mkPrisma();
    const svc = new WorkflowRunnerService(prisma as any, nodes as any);
    const res = await svc.run(wf({ nodes: [{ id: 'a', type: 'query', next: ['b'] }, { id: 'b', type: 'alert' }] }) as any, 'manual');
    expect(res.status).toBe('succeeded');
    expect(nodes.runNode.mock.calls.map((c) => c[0].id)).toEqual(['a', 'b']);
  });

  it('a gate that is not breached → healthy, stops, does not reach the alert', async () => {
    const nodes = {
      runNode: jest.fn(async (node: any) =>
        node.type === 'threshold'
          ? { output: { value: 0, threshold: 5, breached: false }, stop: true, stopReason: 'gate' }
          : { output: { alertId: 'x' } },
      ),
    };
    const prisma = mkPrisma();
    const svc = new WorkflowRunnerService(prisma as any, nodes as any);
    const res = await svc.run(wf({ nodes: [{ id: 'g', type: 'threshold', next: ['al'] }, { id: 'al', type: 'alert' }] }) as any, 'schedule');
    expect(res.status).toBe('succeeded');
    expect(res.healthy).toBe(true);
    expect(res.alerted).toBe(false);
    expect(nodes.runNode).toHaveBeenCalledTimes(1); // alert never ran
  });

  it('an alert node sets alerted=true and healthy=false', async () => {
    const nodes = {
      runNode: jest.fn(async (node: any) =>
        node.type === 'alert' ? { output: { alertId: 'a1', severity: 'critical' } } : { output: { value: 9, threshold: 5, breached: true } },
      ),
    };
    const prisma = mkPrisma();
    const svc = new WorkflowRunnerService(prisma as any, nodes as any);
    const res = await svc.run(wf({ nodes: [{ id: 'g', type: 'threshold', next: ['al'] }, { id: 'al', type: 'alert' }] }) as any, 'manual');
    expect(res.alerted).toBe(true);
    expect(res.healthy).toBe(false);
    expect(res.checked).toEqual({ value: 9, threshold: 5, op: undefined, input: undefined });
  });

  it('a throwing node fails the run (a recorded row, not a crash)', async () => {
    const nodes = { runNode: jest.fn(async () => { throw new Error('boom'); }) };
    const prisma = mkPrisma();
    const svc = new WorkflowRunnerService(prisma as any, nodes as any);
    const res = await svc.run(wf({ nodes: [{ id: 'a', type: 'query' }] }) as any, 'manual');
    expect(res.status).toBe('failed');
    expect(prisma.workflowRun.update).toHaveBeenCalled();
  });

  it('a cyclic graph fails cleanly', async () => {
    const nodes = { runNode: jest.fn(async () => ({ output: {} })) };
    const prisma = mkPrisma();
    const svc = new WorkflowRunnerService(prisma as any, nodes as any);
    const res = await svc.run(wf({ nodes: [{ id: 'a', type: 'query', next: ['b'] }, { id: 'b', type: 'query', next: ['a'] }] }) as any, 'manual');
    expect(res.status).toBe('failed');
  });

  it('a dangling edge fails cleanly instead of silently skipping the bad target', async () => {
    const nodes = { runNode: jest.fn(async () => ({ output: {} })) };
    const prisma = mkPrisma();
    const svc = new WorkflowRunnerService(prisma as any, nodes as any);
    const res = await svc.run(wf({ nodes: [{ id: 'a', type: 'query', next: ['missing'] }] }) as any, 'manual');
    expect(res.status).toBe('failed');
    expect(String((prisma as any)._row.error)).toContain('dangling edge');
    expect(nodes.runNode).not.toHaveBeenCalled();
  });
});
