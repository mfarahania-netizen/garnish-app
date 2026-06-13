import { AiCostControllerService } from './ai-cost-controller.service';

describe('AiCostControllerService', () => {
  it('blocks a call exceeding the per-call token limit', () => {
    const cost = new AiCostControllerService().configure({ perCallTokenLimit: 50 });
    expect(cost.check({ userId: 'u1', estimatedTokens: 200 }).allowed).toBe(false);
    expect(cost.check({ userId: 'u1', estimatedTokens: 40 }).allowed).toBe(true);
  });

  it('blocks once the per-user cumulative limit is reached', () => {
    const cost = new AiCostControllerService().configure({ perCallTokenLimit: 1000, perUserTokenLimit: 100 });
    expect(cost.check({ userId: 'u2', estimatedTokens: 60 }).allowed).toBe(true);
    cost.record({ userId: 'u2', tokens: 60 });
    expect(cost.check({ userId: 'u2', estimatedTokens: 60 }).allowed).toBe(false); // 60+60 > 100
    expect(cost.check({ userId: 'u2', estimatedTokens: 30 }).allowed).toBe(true); // 60+30 <= 100
  });

  it('tracks usage per user independently and exposes configured limits', () => {
    const cost = new AiCostControllerService().configure({ perUserTokenLimit: 100 });
    cost.record({ userId: 'a', tokens: 90 });
    expect(cost.getUsage('a')).toBe(90);
    expect(cost.getUsage('b')).toBe(0);
    expect(cost.getLimits().perUserTokenLimit).toBe(100);
  });
});
