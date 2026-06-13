import { GetUserFoodContextTool } from './get-user-food-context.tool';

describe('GetUserFoodContextTool (safe, non-sensitive, PII-free)', () => {
  const tool = new GetUserFoodContextTool();

  it('returns safe minimal context and EXCLUDES sensitive preference keys', async () => {
    const ctx = {
      userId: 'u1',
      snapshot: {
        userId: 'u1',
        generatedAt: 'now',
        schemaVersion: 1,
        locale: 'fa',
        preferences: {
          diet: 'vegetarian',
          skillLevel: 'beginner',
          budget: 'low',
          allergy_peanut: true, // sensitive — must be excluded
          healthGoal: 'weight_loss', // sensitive
          blood_pressure: 'high', // sensitive
        },
      },
    } as any;
    const out: any = await tool.handler({}, ctx);

    expect(out.userId).toBe('u1');
    expect(out.locale).toBe('fa');
    expect(out.preferences).toEqual({ diet: 'vegetarian', skillLevel: 'beginner', budget: 'low' });
    expect(out.preferences).not.toHaveProperty('allergy_peanut');
    expect(out.preferences).not.toHaveProperty('healthGoal');
    expect(out.preferences).not.toHaveProperty('blood_pressure');
    expect(out.recentSignals).toEqual([]);
    expect(out.contextStatus).toBe('partial');
  });

  it('returns explicit limited context when nothing is stored', async () => {
    const out: any = await tool.handler({}, { userId: 'u1', snapshot: { userId: 'u1', generatedAt: 'now', schemaVersion: 1 } } as any);
    expect(out.contextStatus).toBe('limited');
    expect(out.preferences).toEqual({});
    expect(out.recentSignals).toEqual([]);
  });

  it('output contains no PII-like values (no emails / phone-like digit runs)', async () => {
    const ctx = { userId: 'u1', snapshot: { userId: 'u1', generatedAt: 'now', schemaVersion: 1, preferences: { diet: 'vegan' } } } as any;
    const s = JSON.stringify(await tool.handler({}, ctx));
    expect(s).not.toMatch(/@/);
    expect(s).not.toMatch(/\b\d{8,}\b/);
  });
});
