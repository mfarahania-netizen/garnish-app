import { NutritionClaimGuardService } from './nutrition-claim.guard';

describe('NutritionClaimGuardService', () => {
  const guard = new NutritionClaimGuardService();

  it('blocks health/medical nutrition claims when nutrition is NOT source-locked', () => {
    const claims = [
      'This meal helps you lose weight fast',
      'It lowers your cholesterol',
      'Great for your diabetes',
      'Boosts your immune system',
      'This recipe has 250 calories of protein',
      'کاهش وزن سریع با این غذا',
    ];
    for (const c of claims) {
      expect(guard.inspect(c, { nutritionSourceLocked: false }).blocked).toBe(true);
    }
  });

  it('allows the same statements when nutrition IS source-locked', () => {
    expect(guard.inspect('This recipe has 250 calories', { nutritionSourceLocked: true }).blocked).toBe(false);
    expect(guard.inspect('It lowers cholesterol', { nutritionSourceLocked: true }).blocked).toBe(false);
  });

  it('allows non-claim text regardless of lock', () => {
    expect(guard.inspect('A warm, comforting stew for a cold night', { nutritionSourceLocked: false }).blocked).toBe(false);
  });

  it('defaults to NOT source-locked (strict) when unspecified', () => {
    expect(guard.inspect('helps you lose weight').blocked).toBe(true);
  });
});
