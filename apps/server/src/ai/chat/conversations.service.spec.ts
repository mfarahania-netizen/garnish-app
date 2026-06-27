import { ConversationsService } from './conversations.service';

const makePrisma = () => ({
  conversation: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn(), delete: jest.fn() },
  chatMessage: { findFirst: jest.fn(), findMany: jest.fn(), deleteMany: jest.fn() },
});

describe('ConversationsService', () => {
  it('touch: creates the thread with an auto-title from the first prompt on first sight', async () => {
    const prisma = makePrisma();
    prisma.conversation.findUnique.mockResolvedValue(null);
    await new ConversationsService(prisma as never).touch('u1', 'c1', 'برنامهٔ هفتگیم رو بچین');
    expect(prisma.conversation.create).toHaveBeenCalledWith({ data: { id: 'c1', userId: 'u1', title: 'برنامهٔ هفتگیم رو بچین' } });
  });

  it('touch: bumps an existing OWN thread, never recreates', async () => {
    const prisma = makePrisma();
    prisma.conversation.findUnique.mockResolvedValue({ userId: 'u1' });
    await new ConversationsService(prisma as never).touch('u1', 'c1', 'x');
    expect(prisma.conversation.create).not.toHaveBeenCalled();
    expect(prisma.conversation.update).toHaveBeenCalled();
  });

  it('touch: never touches another user\'s thread', async () => {
    const prisma = makePrisma();
    prisma.conversation.findUnique.mockResolvedValue({ userId: 'other' });
    await new ConversationsService(prisma as never).touch('u1', 'c1', 'x');
    expect(prisma.conversation.update).not.toHaveBeenCalled();
    expect(prisma.conversation.create).not.toHaveBeenCalled();
  });

  it('messages: returns null for a non-owner (no leak) and never reads the rows', async () => {
    const prisma = makePrisma();
    prisma.conversation.findUnique.mockResolvedValue({ userId: 'other' });
    const svc = new ConversationsService(prisma as never);
    expect(await svc.messages('u1', 'c1')).toBeNull();
    expect(prisma.chatMessage.findMany).not.toHaveBeenCalled();
  });

  it('messages: returns the ordered thread for the owner', async () => {
    const prisma = makePrisma();
    prisma.conversation.findUnique.mockResolvedValue({ userId: 'u1' });
    prisma.chatMessage.findMany.mockResolvedValue([{ id: 'm1', role: 'user', content: 'سلام' }]);
    expect(await new ConversationsService(prisma as never).messages('u1', 'c1')).toHaveLength(1);
  });

  it('remove: owner-checked → deletes the messages AND the thread', async () => {
    const prisma = makePrisma();
    prisma.conversation.findUnique.mockResolvedValue({ userId: 'u1' });
    expect(await new ConversationsService(prisma as never).remove('u1', 'c1')).toBe(true);
    expect(prisma.chatMessage.deleteMany).toHaveBeenCalledWith({ where: { conversationId: 'c1', userId: 'u1' } });
    expect(prisma.conversation.delete).toHaveBeenCalled();
  });

  it('remove: refuses a non-owner (returns false, deletes nothing)', async () => {
    const prisma = makePrisma();
    prisma.conversation.findUnique.mockResolvedValue({ userId: 'other' });
    expect(await new ConversationsService(prisma as never).remove('u1', 'c1')).toBe(false);
    expect(prisma.conversation.delete).not.toHaveBeenCalled();
    expect(prisma.chatMessage.deleteMany).not.toHaveBeenCalled();
  });

  it('rename: owner-checked', async () => {
    const prisma = makePrisma();
    prisma.conversation.findUnique.mockResolvedValue({ userId: 'u1' });
    prisma.conversation.update.mockResolvedValue({ id: 'c1', title: 'برنامهٔ من' });
    expect(await new ConversationsService(prisma as never).rename('u1', 'c1', 'برنامهٔ من')).toMatchObject({ title: 'برنامهٔ من' });
  });
});
