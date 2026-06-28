import { AgenticToolCatalogService } from './agentic-tool-catalog.service';
import { ToolContext } from '../ai-core.types';

const ctx = { userId: 'u1', snapshot: { userId: 'u1', generatedAt: '2026-01-01T00:00:00Z', schemaVersion: 1 } } as ToolContext;

describe('AgenticToolCatalogService', () => {
  const prisma = { recipe: { findFirst: jest.fn() }, ingredient: { findMany: jest.fn() } };
  const search = { handler: jest.fn() };
  const substitutions = { handler: jest.fn() };
  const userContext = { handler: jest.fn() };
  const catalog = new AgenticToolCatalogService(prisma as never, search as never, substitutions as never, userContext as never);
  const byName = (n: string) => catalog.build().find((t) => t.spec.name === n)!;

  beforeEach(() => jest.clearAllMocks());

  it('exposes exactly the curated read-only tools, in order', () => {
    expect(catalog.build().map((t) => t.spec.name)).toEqual([
      'search_recipes',
      'get_recipe_details',
      'compute_nutrition',
      'troubleshoot_cooking',
      'suggest_substitutions',
      'get_user_context',
    ]);
  });

  it('get_recipe_details reads ONLY published recipes (publish gate) and formats ingredients + numbered steps', async () => {
    prisma.recipe.findFirst.mockResolvedValue({
      id: 'r1',
      title: 'قورمه‌سبزی',
      description: 'd',
      cookingTime: 90,
      servings: 4,
      ingredients: [
        { name: 'لوبیا قرمز', amount: '۱', unit: 'پیمانه' },
        { name: 'سبزی خوردن', amount: null, unit: null },
      ],
      steps: [{ instruction: 'سبزی را تفت بده' }, { instruction: 'بگذار جا بیفتد' }],
    });
    const r = (await byName('get_recipe_details').execute({ recipeId: 'r1' }, ctx)) as Record<string, unknown>;
    expect(prisma.recipe.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'r1', status: 'active', isPublic: true }) }),
    );
    expect(r.title).toBe('قورمه‌سبزی');
    expect(r.ingredients).toEqual(['۱ پیمانه لوبیا قرمز', 'سبزی خوردن']);
    expect(r.steps).toEqual(['1. سبزی را تفت بده', '2. بگذار جا بیفتد']);
  });

  it('get_recipe_details returns an error object (never throws) when the recipe is missing/private', async () => {
    prisma.recipe.findFirst.mockResolvedValue(null);
    const r = (await byName('get_recipe_details').execute({ recipeId: 'nope' }, ctx)) as Record<string, unknown>;
    expect(r.error).toBeDefined();
  });

  it('compute_nutrition returns a per-serving line from the stored Nutrition row (publish-gated, no fabrication)', async () => {
    prisma.recipe.findFirst.mockResolvedValue({ id: 'r1', title: 'قیمه', servings: 4, gris: null, nutrition: { calories: 685, protein: 33, carbs: 53, fat: 39, fiber: 6 }, ingredients: [] });
    const r = (await byName('compute_nutrition').execute({ recipeId: 'r1' }, ctx)) as Record<string, any>;
    expect(prisma.recipe.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'r1', status: 'active', isPublic: true }) }));
    expect(r.computable).toBe(true);
    expect(r.perServing.calories).toBe(685);
    expect(String(r.line)).toContain('کالری');
  });

  it('compute_nutrition live-computes from ingredients when there is no stored row', async () => {
    prisma.recipe.findFirst.mockResolvedValue({
      id: 'r3', title: 'خوراک', servings: 2, gris: null, nutrition: null,
      ingredients: [
        { name: 'گوشت', ingredientId: 'ing_beef', amount: '۳۰۰', unit: 'گرم' },
        { name: 'برنج', ingredientId: 'ing_rice', amount: '۲۰۰', unit: 'گرم' },
        { name: 'پیاز', ingredientId: 'ing_onion', amount: '۱', unit: 'عدد' },
      ],
    });
    prisma.ingredient.findMany.mockResolvedValue([
      { id: 'ing_beef', nutritionPer100g: { calories: 250, protein: 26, carbs: 0, fat: 17 }, category: 'red_meat', gramConversions: null },
      { id: 'ing_rice', nutritionPer100g: { calories: 360, protein: 7, carbs: 80, fat: 1 }, category: 'grain', gramConversions: null },
      { id: 'ing_onion', nutritionPer100g: { calories: 40, protein: 1, carbs: 9, fat: 0 }, category: 'vegetable', gramConversions: { perUnit: { 'عدد': { g: 110, src: 'mined', n: 75 } } } },
    ]);
    const r = (await byName('compute_nutrition').execute({ recipeId: 'r3' }, ctx)) as Record<string, any>;
    expect(r.computable).toBe(true);
    expect(r.perServing.calories).toBeGreaterThan(0);
  });

  it('compute_nutrition refuses honestly (computable:false) when a real-calorie ingredient is unquantified — never guesses', async () => {
    prisma.recipe.findFirst.mockResolvedValue({
      id: 'r2', title: 'سوسیس بندری', servings: 4, gris: null, nutrition: null,
      ingredients: [
        { name: 'سوسیس', ingredientId: 'ing_sausage', amount: null, unit: 'به مقدار لازم' },
        { name: 'گوجه', ingredientId: 'ing_tomato', amount: '۲', unit: 'عدد' },
        { name: 'فلفل', ingredientId: 'ing_pepper', amount: '۱', unit: 'عدد' },
      ],
    });
    prisma.ingredient.findMany.mockResolvedValue([
      { id: 'ing_sausage', nutritionPer100g: { calories: 315, protein: 12, carbs: 2, fat: 28 }, category: 'processed_food', gramConversions: null },
      { id: 'ing_tomato', nutritionPer100g: { calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2 }, category: 'vegetable', gramConversions: { perUnit: { 'عدد': { g: 120, src: 'mined', n: 12 } } } },
      { id: 'ing_pepper', nutritionPer100g: { calories: 26, protein: 1, carbs: 6, fat: 0.3 }, category: 'vegetable', gramConversions: { perUnit: { 'عدد': { g: 120, src: 'mined', n: 6 } } } },
    ]);
    const r = (await byName('compute_nutrition').execute({ recipeId: 'r2' }, ctx)) as Record<string, any>;
    expect(r.computable).toBe(false);
    expect(r.note).toBeDefined();
  });

  it('compute_nutrition returns an error for a missing/private recipe (publish gate)', async () => {
    prisma.recipe.findFirst.mockResolvedValue(null);
    const r = (await byName('compute_nutrition').execute({ recipeId: 'nope' }, ctx)) as Record<string, unknown>;
    expect(r.error).toBeDefined();
  });

  it('troubleshoot_cooking answers a known problem with cause/fix/prevent (present-tense «میریزه»)', async () => {
    const r = (await byName('troubleshoot_cooking').execute({ dish: 'کوبیده', symptom: 'میریزه' }, ctx)) as Record<string, unknown>;
    expect(r.found).toBe(true);
    expect(String(r.fix)).toContain('یخچال');
  });

  it('troubleshoot_cooking returns found:false for an unknown problem (no fabrication)', async () => {
    const r = (await byName('troubleshoot_cooking').execute({ dish: 'پیتزای کهکشانی', symptom: 'منفجر شد' }, ctx)) as Record<string, unknown>;
    expect(r.found).toBe(false);
  });

  it('wrapped tools delegate to their real handlers with (args, ctx)', async () => {
    search.handler.mockResolvedValue({ ok: 1 });
    substitutions.handler.mockResolvedValue({ ok: 1 });
    await byName('search_recipes').execute({ query: 'خورشت' }, ctx);
    await byName('suggest_substitutions').execute({ ingredient: 'شیر' }, ctx);
    await byName('get_user_context').execute({}, ctx);
    expect(search.handler).toHaveBeenCalledWith({ query: 'خورشت' }, ctx);
    expect(substitutions.handler).toHaveBeenCalledWith({ ingredient: 'شیر' }, ctx);
    expect(userContext.handler).toHaveBeenCalledWith({}, ctx);
  });
});
