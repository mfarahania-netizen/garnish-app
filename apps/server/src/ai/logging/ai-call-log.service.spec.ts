import { AiCallLogService, AICallLogInput } from './ai-call-log.service';

function makeService() {
  const create = jest.fn().mockResolvedValue({ id: 'log_1' });
  const prisma = { aICallLog: { create } } as any;
  return { svc: new AiCallLogService(prisma), create };
}

const base: AICallLogInput = {
  userId: 'u1',
  model: 'mock-1',
  provider: 'mock',
  status: 'ok',
  guardHits: [],
  toolCalls: [],
};

describe('AiCallLogService (DB-backed)', () => {
  it('persists a successful call with JSON guardHits/toolCalls', async () => {
    const { svc, create } = makeService();
    const out = await svc.record({ ...base, status: 'ok', guardHits: [], toolCalls: ['search_recipes'] });
    expect(out).toEqual({ id: 'log_1' });
    const data = create.mock.calls[0][0].data;
    expect(data.status).toBe('ok');
    expect(data.toolCalls).toEqual(['search_recipes']);
    expect(data.guardHits).toEqual([]);
  });

  it('persists a blocked call', async () => {
    const { svc, create } = makeService();
    await svc.record({ ...base, status: 'blocked_safety', guardHits: ['safety'] });
    expect(create.mock.calls[0][0].data.status).toBe('blocked_safety');
    expect(create.mock.calls[0][0].data.guardHits).toEqual(['safety']);
  });

  it('REDACTS PII-like metadata before persisting (never stores it raw)', async () => {
    const { svc, create } = makeService();
    await svc.record({ ...base, metadata: { email: 'user@example.com', note: 'call me' } });
    const stored = create.mock.calls[0][0].data.metadata;
    expect(stored).toEqual({ redacted: true, reason: 'pii_detected' });
    expect(JSON.stringify(stored)).not.toContain('user@example.com');
  });

  it('passes through clean metadata unchanged', async () => {
    const { svc, create } = makeService();
    await svc.record({ ...base, metadata: { reasons: ['safety'], count: 2 } });
    expect(create.mock.calls[0][0].data.metadata).toEqual({ reasons: ['safety'], count: 2 });
  });

  it('sanitizes secrets/PII out of errorMessage', async () => {
    const { svc, create } = makeService();
    await svc.record({ ...base, status: 'error', errorCode: 'model_error', errorMessage: 'failed for user@example.com with key sk-ABCDEF0123456789 Bearer eyJhbGciOiJI.abc.def' });
    const msg = create.mock.calls[0][0].data.errorMessage as string;
    expect(msg).not.toContain('user@example.com');
    expect(msg).not.toContain('sk-ABCDEF0123456789');
    expect(msg).toContain('[redacted-email]');
    expect(msg).toContain('[redacted-key]');
  });

  it('never throws if the DB write fails (auditing must not break the call)', async () => {
    const create = jest.fn().mockRejectedValue(new Error('db down'));
    const svc = new AiCallLogService({ aICallLog: { create } } as any);
    await expect(svc.record(base)).resolves.toBeNull();
  });
});
