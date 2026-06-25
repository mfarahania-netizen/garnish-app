import { ChatMessageService } from './chat-message.service';
import { BadRequestException } from '@nestjs/common';

function makeService() {
  const create = jest.fn().mockResolvedValue({ id: 'm1' });
  const findMany = jest.fn().mockResolvedValue([{ id: 'm1' }, { id: 'm2' }]);
  const prisma = { chatMessage: { create, findMany } } as any;
  return { svc: new ChatMessageService(prisma), create, findMany };
}

describe('ChatMessageService', () => {
  it('creates a chat message with a valid role', async () => {
    const { svc, create } = makeService();
    const out = await svc.create({ userId: 'u1', conversationId: 'c1', role: 'assistant', content: 'here is an idea', model: 'mock-1', aiCallLogId: 'log_1' });
    expect(out).toEqual({ id: 'm1' });
    expect(create.mock.calls[0][0].data).toMatchObject({ userId: 'u1', conversationId: 'c1', role: 'assistant', aiCallLogId: 'log_1' });
  });

  it('rejects an invalid role', async () => {
    const { svc, create } = makeService();
    await expect(svc.create({ userId: 'u1', conversationId: 'c1', role: 'hacker' as any, content: 'x' })).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('lists messages by conversation in chronological order', async () => {
    const { svc, findMany } = makeService();
    const rows = await svc.listByConversation('c1');
    expect(rows).toHaveLength(2);
    expect(findMany.mock.calls[0][0]).toMatchObject({ where: { conversationId: 'c1' }, orderBy: { createdAt: 'asc' } });
  });
  it('lists recent memory turns user-scoped, newest-limited, then returns oldest-first', async () => {
    const { svc, findMany } = makeService();
    const newestFirst = [
      { role: 'assistant', content: 'newer', createdAt: new Date('2026-01-01T00:00:02.000Z') },
      { role: 'user', content: 'older', createdAt: new Date('2026-01-01T00:00:01.000Z') },
    ];
    findMany.mockResolvedValueOnce(newestFirst);

    const rows = await svc.listRecentForMemory('u1', 'c1', 8);

    expect(findMany.mock.calls[0][0]).toEqual({
      where: {
        userId: 'u1',
        conversationId: 'c1',
        // user turns always; assistant turns only when they actually answered (blocked/error excluded from memory)
        OR: [
          { role: 'user' },
          { role: 'assistant', NOT: { contentSafetyStatus: { in: ['error', 'blocked_injection', 'blocked_safety', 'blocked_nutrition', 'blocked_cost'] } } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        role: true,
        content: true,
        createdAt: true,
      },
    });
    expect(rows.map((row) => row.content)).toEqual(['older', 'newer']);
  });
});
