import { LogAiFeedbackTool } from './log-ai-feedback.tool';

const ctx = { userId: 'u1', snapshot: {} } as any;

describe('LogAiFeedbackTool (narrow append-only audit)', () => {
  it('records a safe feedback audit row with no PII', async () => {
    const record = jest.fn().mockResolvedValue({ id: 'log_9' });
    const tool = new LogAiFeedbackTool({ record } as any);
    const out: any = await tool.handler({ messageId: 'm1', rating: 'up', reasonCode: 'helpful' }, ctx);

    expect(out.logged).toBe(true);
    expect(out.aiCallLogId).toBe('log_9');
    expect(out.rating).toBe('up');
    expect(out.persistenceNote).toBe('audit_logged');

    const arg = record.mock.calls[0][0];
    expect(arg.surface).toBe('feedback');
    expect(arg.provider).toBe('internal');
    expect(arg.status).toBe('ok');
    expect(arg.metadata).toEqual({ kind: 'ai_feedback', rating: 'up', reasonCode: 'helpful', messageId: 'm1' });
    expect(JSON.stringify(arg.metadata)).not.toMatch(/@|\b\d{8,}\b/); // no PII-like values
  });

  it('coerces an invalid rating to neutral and tolerates missing fields', async () => {
    const record = jest.fn().mockResolvedValue({ id: 'log_10' });
    const tool = new LogAiFeedbackTool({ record } as any);
    const out: any = await tool.handler({ rating: 'love-it' }, ctx);
    expect(out.rating).toBe('neutral');
    expect(record.mock.calls[0][0].metadata.messageId).toBeNull();
  });

  it('reports not_persisted_yet when the audit write fails', async () => {
    const record = jest.fn().mockResolvedValue(null);
    const tool = new LogAiFeedbackTool({ record } as any);
    const out: any = await tool.handler({ rating: 'down' }, ctx);
    expect(out.logged).toBe(false);
    expect(out.persistenceNote).toBe('not_persisted_yet');
  });
});
