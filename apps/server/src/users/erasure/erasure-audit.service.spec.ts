import { ErasureAuditService } from './erasure-audit.service';

function makeService() {
  const create = jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'e1', ...data }));
  const prisma = { erasureEvent: { create } } as any;
  return { svc: new ErasureAuditService(prisma), create };
}

describe('ErasureAuditService (E39-1B foundation)', () => {
  it('records a PII-free erasure event with a non-reversible subjectHash (not the raw userId)', async () => {
    const { svc, create } = makeService();
    await svc.record({ userId: 'user_123', action: 'user_erasure_requested', status: 'requested' });
    const data = create.mock.calls[0][0].data;
    expect(data.userId).toBe('user_123');
    expect(data.action).toBe('user_erasure_requested');
    expect(data.status).toBe('requested');
    expect(typeof data.subjectHash).toBe('string');
    expect(data.subjectHash).toHaveLength(64); // sha256 hex
    expect(data.subjectHash).not.toContain('user_123'); // non-reversible reference
  });

  it('produces a deterministic subjectHash', () => {
    expect(ErasureAuditService.subjectHash('user_123')).toBe(ErasureAuditService.subjectHash('user_123'));
    expect(ErasureAuditService.subjectHash('user_123')).not.toBe(ErasureAuditService.subjectHash('user_456'));
  });

  it('REDACTS PII-like metadata (never stores it raw)', async () => {
    const { svc, create } = makeService();
    await svc.record({ userId: 'u1', action: 'user_erasure_completed', status: 'completed', metadata: { email: 'user@example.com', note: 'call me' } });
    const stored = create.mock.calls[0][0].data.metadata;
    expect(stored).toEqual({ redacted: true, reason: 'pii_detected' });
    expect(JSON.stringify(stored)).not.toContain('user@example.com');
  });

  it('passes through clean metadata + caps the reason', async () => {
    const { svc, create } = makeService();
    await svc.record({ userId: 'u1', action: 'user_erasure_completed', status: 'completed', reason: 'x'.repeat(500), metadata: { deletedTables: 30, durationMs: 12 } });
    const data = create.mock.calls[0][0].data;
    expect(data.metadata).toEqual({ deletedTables: 30, durationMs: 12 });
    expect((data.reason as string).length).toBeLessThanOrEqual(200);
  });

  it('handles a null userId (subjectHash = "unknown"), still records', async () => {
    const { svc, create } = makeService();
    await svc.record({ userId: null, action: 'user_erasure_failed', status: 'failed' });
    const data = create.mock.calls[0][0].data;
    expect(data.userId).toBeNull();
    expect(data.subjectHash).toBe('unknown');
  });
});
