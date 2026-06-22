import { PersistedDailyBudgetService } from './persisted-daily-budget.service';

/** Focused spec for the MULTI-WINDOW budget + cooldown (checkAllWindows). Mocks the single findMany the method
 *  issues; `now` is injected so rolling windows are deterministic. Defaults: cooldown 15s; 5h=60k, daily=200k,
 *  weekly=700k, monthly=2M. */
const HOUR = 3_600_000;
const now = new Date('2026-06-22T12:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms);

function makeSvc(rows: Array<{ createdAt: Date; totalTokens: number }>) {
  const findMany = jest.fn().mockResolvedValue(rows);
  const prisma = { aICallLog: { findMany } } as any;
  return { svc: new PersistedDailyBudgetService(prisma), findMany };
}

describe('PersistedDailyBudgetService.checkAllWindows (multi-window + cooldown)', () => {
  it('anonymous user → always allowed, no query issued', async () => {
    const { svc, findMany } = makeSvc([]);
    expect(await svc.checkAllWindows(null, 100, now)).toEqual({ allowed: true });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('cooldown: a live call within 15s blocks the next one', async () => {
    const { svc } = makeSvc([{ createdAt: ago(5_000), totalTokens: 10 }]);
    const r = await svc.checkAllWindows('u1', 50, now);
    expect(r.allowed).toBe(false);
    expect(r.window).toBe('cooldown');
    expect(r.reason).toBe('cooldown');
  });

  it('5h window: exceeding 60k within 5h is blocked (cooldown already satisfied)', async () => {
    const { svc } = makeSvc([{ createdAt: ago(20_000), totalTokens: 65_000 }]);
    const r = await svc.checkAllWindows('u1', 0, now);
    expect(r.allowed).toBe(false);
    expect(r.window).toBe('5h');
    expect(r.reason).toBe('budget_exceeded_5h');
    expect(r.limit).toBe(60_000);
  });

  it('daily window can block even when the last 5h is clean (tokens spent 10h ago)', async () => {
    const { svc } = makeSvc([{ createdAt: ago(10 * HOUR), totalTokens: 250_000 }]);
    const r = await svc.checkAllWindows('u1', 0, now);
    expect(r.allowed).toBe(false);
    expect(r.window).toBe('daily'); // 5h consumed=0 (ok) but rolling-24h=250k > 200k
  });

  it('allowed when under every window and past the cooldown', async () => {
    const { svc } = makeSvc([{ createdAt: ago(20_000), totalTokens: 100 }]);
    expect(await svc.checkAllWindows('u1', 500, now)).toEqual({ allowed: true });
  });

  it('the projected (estimated) tokens count toward the cap', async () => {
    const { svc } = makeSvc([{ createdAt: ago(30_000), totalTokens: 59_900 }]);
    const r = await svc.checkAllWindows('u1', 200, now); // 59_900 + 200 = 60_100 > 60_000
    expect(r.allowed).toBe(false);
    expect(r.window).toBe('5h');
  });

  it('propagates a DB error (caller fails CLOSED)', async () => {
    const findMany = jest.fn().mockRejectedValue(new Error('db down'));
    const svc = new PersistedDailyBudgetService({ aICallLog: { findMany } } as any);
    await expect(svc.checkAllWindows('u1', 0, now)).rejects.toThrow();
  });
});
