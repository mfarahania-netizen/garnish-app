import { AgenticToolCatalogService } from './agentic-tool-catalog.service';
import { ToolContext } from '../ai-core.types';

const ctx = { userId: 'u1', snapshot: { userId: 'u1', generatedAt: '2026-01-01T00:00:00Z', schemaVersion: 1 } } as ToolContext;

describe('AgenticToolCatalogService', () => {
  const prisma = { recipe: { findFirst: jest.fn() } };
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
