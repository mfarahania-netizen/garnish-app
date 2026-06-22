import { resolveAiCostPolicy, DEFAULT_BUDGET_WINDOWS, DEFAULT_COOLDOWN_MS } from './ai-cost-policy';

const win = (p: ReturnType<typeof resolveAiCostPolicy>, id: string) => p.perUserBudgetWindows.find((w) => w.id === id);

describe('AiCostPolicy multi-window + cooldown (env-overridable)', () => {
  it('defaults expose 5h/daily/weekly/monthly windows + a 15s cooldown', () => {
    const p = resolveAiCostPolicy({} as any);
    expect(p.perUserBudgetWindows.map((w) => w.id)).toEqual(['5h', 'daily', 'weekly', 'monthly']);
    expect(p.perUserCooldownMs).toBe(DEFAULT_COOLDOWN_MS);
    expect(win(p, 'daily')!.maxTokens).toBe(200_000);
  });

  it('env overrides a window limit without a redeploy', () => {
    const p = resolveAiCostPolicy({ AI_BUDGET_5H_MAX_TOKENS: '100000' } as any);
    expect(win(p, '5h')!.maxTokens).toBe(100_000);
  });

  it('an explicit 0 disables that window (maxTokens → null)', () => {
    const p = resolveAiCostPolicy({ AI_BUDGET_WEEKLY_MAX_TOKENS: '0' } as any);
    expect(win(p, 'weekly')!.maxTokens).toBeNull();
  });

  it('cooldown is env-overridable; 0 disables it', () => {
    expect(resolveAiCostPolicy({ AI_BUDGET_COOLDOWN_MS: '30000' } as any).perUserCooldownMs).toBe(30_000);
    expect(resolveAiCostPolicy({ AI_BUDGET_COOLDOWN_MS: '0' } as any).perUserCooldownMs).toBe(0);
  });

  it('invalid/blank override falls back to the default', () => {
    const p = resolveAiCostPolicy({ AI_BUDGET_5H_MAX_TOKENS: 'abc' } as any);
    expect(win(p, '5h')!.maxTokens).toBe(DEFAULT_BUDGET_WINDOWS.find((w) => w.id === '5h')!.maxTokens);
  });

  it('does not mutate the shared DEFAULT_BUDGET_WINDOWS across resolves', () => {
    resolveAiCostPolicy({ AI_BUDGET_5H_MAX_TOKENS: '1' } as any);
    expect(DEFAULT_BUDGET_WINDOWS.find((w) => w.id === '5h')!.maxTokens).toBe(60_000);
  });
});
