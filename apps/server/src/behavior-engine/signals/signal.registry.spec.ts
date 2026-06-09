import { SignalRegistryService } from './signal.registry';

describe('SignalRegistryService', () => {
  it('exposes a richer signal catalog', () => {
    const registry = new SignalRegistryService();
    const signals = registry.getAll();

    expect(signals.length).toBeGreaterThanOrEqual(20);
    expect(signals.map((item) => item.name)).toEqual(
      expect.arrayContaining([
        'likes_high_protein',
        'likes_healthy',
        'likes_fast_meals',
        'likes_italian',
        'likes_asian',
        'likes_middle_eastern',
        'likes_family_meals',
        'likes_budget_meals',
        'likes_no_cook',
        'likes_one_pot',
        'likes_weekend_cooking',
      ]),
    );
  });
});
