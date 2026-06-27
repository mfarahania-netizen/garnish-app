import { ChatRateLimitService } from './chat-rate-limit.service';

const makePrisma = (count: number, oldest?: Date) => ({
  chatMessage: {
    count: jest.fn().mockResolvedValue(count),
    findFirst: jest.fn().mockResolvedValue(oldest ? { createdAt: oldest } : null),
  },
});

describe('ChatRateLimitService (free-tier message budget)', () => {
  const now = new Date('2026-06-28T12:00:00Z');
  afterEach(() => {
    delete process.env.AI_LIMIT_5H;
    delete process.env.AI_LIMIT_DAY;
    delete process.env.AI_LIMIT_WEEK;
  });

  it('allows when under every window limit', async () => {
    const svc = new ChatRateLimitService(makePrisma(5) as never);
    expect((await svc.check('u1', now)).allowed).toBe(true);
  });

  it('blocks at the 5-hour limit with a kind message + a reset time (oldest in-window turn + 5h)', async () => {
    process.env.AI_LIMIT_5H = '30';
    const oldest = new Date(now.getTime() - 2 * 3_600_000); // 2h ago
    const svc = new ChatRateLimitService(makePrisma(30, oldest) as never);
    const v = await svc.check('u1', now);
    expect(v.allowed).toBe(false);
    expect(v.window).toBe('5h');
    expect(v.message).toContain('سقفِ پیام');
    expect(v.resetAt!.getTime()).toBe(oldest.getTime() + 5 * 3_600_000);
  });

  it('honors env-configurable limits (AI_LIMIT_5H)', async () => {
    process.env.AI_LIMIT_5H = '3';
    const svc = new ChatRateLimitService(makePrisma(3, now) as never);
    expect((await svc.check('u1', now)).allowed).toBe(false);
  });

  it('FAILS OPEN — a counting error never blocks the user (the limit is a guardrail, not a safety gate)', async () => {
    const prisma = { chatMessage: { count: jest.fn().mockRejectedValue(new Error('db down')), findFirst: jest.fn() } };
    expect((await new ChatRateLimitService(prisma as never).check('u1', now)).allowed).toBe(true);
  });
});
