import { GroundedReplyService } from './grounded-reply.service';

/**
 * AI-GROUNDED-ASSISTANT — the safety-critical unit tests.
 *
 * These exercise the REAL audited safety primitives (assessRecipeFit + analyzeRecipeIntegrity are
 * imported by the service and NOT mocked) over a controlled recipe pool. The HARD allergy gate test is
 * the binding one: a leak (any avoid_allergen recipe surfaced) is a REJECT_FOR_SAFETY.
 */

// search_recipes tool stub → returns the given candidate ids in order.
function toolsReturning(ids: string[]) {
  const handler = jest.fn().mockResolvedValue({ tool: 'search_recipes', results: ids.map((id) => ({ id })) });
  return { getTool: jest.fn().mockReturnValue({ name: 'search_recipes', handler }), _handler: handler } as any;
}

// a profile shaped exactly as assessRecipeFit reads it: reconciled.dimensions.allergies.reconciledValue.
function profileWithAllergies(allergies: string[]) {
  return { reconciled: { dimensions: allergies.length ? { allergies: { reconciledValue: allergies } } : {} } };
}

// recipe in the FIT_SELECT shape. `declared` → recipe.allergens JSON string; `derived` → an ingredient
// whose dictionary entry carries the allergen (drives analyzeRecipeIntegrity).
function recipe(id: string, opts: { title?: string; declared?: string[]; derived?: string[] } = {}) {
  const ingredients: any[] = [{ name: 'برنج', ingredient: { allergens: { eu14: [], us9: [], other: [], mayContain: [] } } }];
  if (opts.derived?.length) {
    ingredients.push({ name: 'ماده‌ی حساس', ingredient: { allergens: { eu14: opts.derived, us9: [], other: [], mayContain: [] } } });
  }
  return {
    id,
    title: opts.title ?? `recipe ${id}`,
    diet: 'omnivore',
    difficulty: 'آسان',
    cookingTime: 30,
    allergens: JSON.stringify(opts.declared ?? []),
    categories: '[]',
    region: null,
    ingredients,
  };
}

function makeService(opts: { profile?: any; profileThrows?: boolean; pool?: any[]; ids?: string[] }) {
  const prisma: any = { recipe: { findMany: jest.fn().mockResolvedValue(opts.pool ?? []) } };
  const profiles: any = {
    getLivingUserProfile: opts.profileThrows
      ? jest.fn().mockRejectedValue(new Error('profile unavailable'))
      : jest.fn().mockResolvedValue(opts.profile ?? profileWithAllergies([])),
  };
  const tools = toolsReturning(opts.ids ?? (opts.pool ?? []).map((r) => r.id));
  const svc = new GroundedReplyService(prisma, profiles, tools);
  return { svc, prisma, profiles, tools };
}

describe('GroundedReplyService — grounded retrieval', () => {
  it('returns real corpus recipes for a query when the user has no allergies', async () => {
    const pool = [recipe('r1', { title: 'خورش سبزی' }), recipe('r2', { title: 'پلو ساده' })];
    const { svc } = makeService({ profile: profileWithAllergies([]), pool });
    const g = await svc.buildGrounding('u1', 'یه غذای گیاهی');
    expect(g.groundingStatus).toBe('ok');
    expect(g.safeRecipes.map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(g.safeRecipes.map((r) => r.title)).toEqual(['خورش سبزی', 'پلو ساده']);
    expect(g.droppedForAllergy).toBe(0);
  });
});

describe('GroundedReplyService — ALLERGY HARD GATE (leaks must be 0)', () => {
  it('HARD-drops both declared-allergen and derived-allergen recipes; never surfaces them', async () => {
    const pool = [
      recipe('safe', { title: 'خورش کدو' }),
      recipe('declared', { title: 'کره بادام‌زمینی', declared: ['peanut'] }), // recipe-level declared allergen
      recipe('derived', { title: 'کلوچه مغزدار', derived: ['peanut'] }), // ingredient-dictionary derived allergen
    ];
    const { svc } = makeService({ profile: profileWithAllergies(['peanut']), pool, ids: ['safe', 'declared', 'derived'] });

    const g = await svc.buildGrounding('allergic-user', 'یه دسر');

    const surfacedIds = g.safeRecipes.map((r) => r.id);
    const surfacedTitles = g.safeRecipes.map((r) => r.title);
    // THE leak assertions — zero allergen recipes may appear, by id OR title:
    expect(surfacedIds).toEqual(['safe']);
    expect(surfacedIds).not.toContain('declared');
    expect(surfacedIds).not.toContain('derived');
    expect(surfacedTitles).not.toContain('کره بادام‌زمینی');
    expect(surfacedTitles).not.toContain('کلوچه مغزدار');
    // both unsafe recipes were counted + recorded for the live output gate
    expect(g.droppedForAllergy).toBe(2);
    expect(g.unsafeTitles.sort()).toEqual(['کره بادام‌زمینی', 'کلوچه مغزدار'].sort());
    expect(g.groundingStatus).toBe('ok'); // a safe one remains
  });

  it('when EVERY candidate conflicts, surfaces NOTHING (empty) — never an unsafe fallback', async () => {
    const pool = [recipe('only', { title: 'بادام‌زمینی بو داده', declared: ['peanut'] })];
    const { svc } = makeService({ profile: profileWithAllergies(['peanut']), pool, ids: ['only'] });
    const g = await svc.buildGrounding('allergic-user', 'چیزی با بادام‌زمینی');
    expect(g.safeRecipes).toEqual([]);
    expect(g.groundingStatus).toBe('empty');
    expect(g.droppedForAllergy).toBe(1);
  });
});

describe('GroundedReplyService — unsafe set unavailable (surface nothing)', () => {
  it('returns unsafe_set_unavailable and never retrieves when the living profile cannot be loaded', async () => {
    const { svc, prisma, tools } = makeService({ profileThrows: true });
    const g = await svc.buildGrounding('u1', 'هر چیزی');
    expect(g.groundingStatus).toBe('unsafe_set_unavailable');
    expect(g.safeRecipes).toEqual([]);
    // we bail BEFORE retrieval — never guess a safe set
    expect(tools.getTool).not.toHaveBeenCalled();
    expect(prisma.recipe.findMany).not.toHaveBeenCalled();
  });

  it('deterministic composer renders an honest no-personalization message for unsafe_set_unavailable', async () => {
    const { svc } = makeService({ profileThrows: true });
    const g = await svc.buildGrounding('u1', 'هر چیزی');
    const reply = svc.composeDeterministicReply(g);
    expect(reply).toContain('امن'); // honest "can't personalize safely" wording, no invented recipe
    expect(reply).not.toContain('**'); // no recipe rendered
  });
});

describe('GroundedReplyService — live OUTPUT allergy gate', () => {
  const grounding = { safeRecipes: [], unsafeTitles: ['کره بادام‌زمینی'], groundingStatus: 'ok' as const, retrievedCount: 2, droppedForAllergy: 1 };

  it('discards model text that mentions a declared allergen', async () => {
    const { svc } = makeService({ profile: profileWithAllergies(['peanut']) });
    const verdict = await svc.screenLiveOutput('u1', 'این غذا با peanut خیلی خوبه', grounding);
    expect(verdict.safe).toBe(false);
    expect(verdict.reason).toBe('declared_allergen_in_output');
  });

  it('discards model text that names a HARD-dropped (unsafe) recipe', async () => {
    const { svc } = makeService({ profile: profileWithAllergies(['peanut']) });
    const verdict = await svc.screenLiveOutput('u1', 'پیشنهاد من کره بادام‌زمینی است', grounding);
    expect(verdict.safe).toBe(false);
    expect(verdict.reason).toBe('unsafe_recipe_named');
  });

  it('allows benign model text with no allergen / no unsafe recipe', async () => {
    const { svc } = makeService({ profile: profileWithAllergies(['peanut']) });
    const verdict = await svc.screenLiveOutput('u1', 'یک خورش سادهٔ سبزیجات پیشنهاد می‌کنم', grounding);
    expect(verdict.safe).toBe(true);
    expect(verdict.reason).toBeNull();
  });

  it('FAILS CLOSED: discards live output when the allergy set cannot be read', async () => {
    const { svc } = makeService({ profileThrows: true });
    const verdict = await svc.screenLiveOutput('u1', 'هر متنی', grounding);
    expect(verdict.safe).toBe(false);
    expect(verdict.reason).toBe('allergy_set_unavailable');
  });
});

describe('GroundedReplyService — getDeclaredAllergens (substitution avoid-set source)', () => {
  it('returns the reconciled declared allergens (the SAME source the hard gate reads)', async () => {
    const { svc } = makeService({ profile: profileWithAllergies(['dairy', 'nut']) });
    await expect(svc.getDeclaredAllergens('u1')).resolves.toEqual(['dairy', 'nut']);
  });

  it('returns [] for a known profile with no allergies', async () => {
    const { svc } = makeService({ profile: profileWithAllergies([]) });
    await expect(svc.getDeclaredAllergens('u1')).resolves.toEqual([]);
  });

  it('returns null (fail-closed) when the living profile cannot be loaded', async () => {
    const { svc } = makeService({ profileThrows: true });
    await expect(svc.getDeclaredAllergens('u1')).resolves.toBeNull();
  });

  it('returns null (fail-closed) when the profile is null', async () => {
    // makeService coalesces a null profile, so construct directly to assert the null path.
    const prisma: any = { recipe: { findMany: jest.fn() } };
    const profiles: any = { getLivingUserProfile: jest.fn().mockResolvedValue(null) };
    const svc = new GroundedReplyService(prisma, profiles, { getTool: jest.fn() } as any);
    await expect(svc.getDeclaredAllergens('u1')).resolves.toBeNull();
  });
});

describe('GroundedReplyService — getIngredientNutrition', () => {
  function svcWithIngredients(rows: any[]) {
    const prisma: any = { recipe: { findMany: jest.fn() }, ingredient: { findMany: jest.fn().mockResolvedValue(rows) } };
    return new GroundedReplyService(prisma, { getLivingUserProfile: jest.fn() } as any, { getTool: jest.fn() } as any);
  }

  it('returns the per-100g nutrition for a resolved ingredient, preferring the entry that has data', async () => {
    const svc = svcWithIngredients([
      { nameFa: 'برنج سفید خام', nameEn: 'white rice raw', code: 'RICE', nutritionPer100g: { calories: 365, protein: 7.1 } },
    ]);
    const n = await svc.getIngredientNutrition('برنج');
    expect(n?.name).toBe('برنج سفید خام');
    expect(n?.per100g.calories).toBe(365);
  });

  it('returns null (no invented number) when no match carries nutrition data', async () => {
    const svc = svcWithIngredients([{ nameFa: 'چیز نادر', nameEn: 'rare', nutritionPer100g: null }]);
    await expect(svc.getIngredientNutrition('چیز نادر')).resolves.toBeNull();
  });
});

describe('GroundedReplyService — deterministic reply formatting', () => {
  const base = { safeRecipes: [], unsafeTitles: [], retrievedCount: 0 };

  it('renders recipe difficulty in Persian (easy→آسان) and drops the allergy framing when nothing was dropped', async () => {
    const { svc } = makeService({});
    const reply = svc.composeDeterministicReply({
      ...base,
      groundingStatus: 'ok',
      safeRecipes: [{ id: 'r1', title: 'آش رشته', cookingTime: 90, difficulty: 'easy', fit: 'ok' }],
      droppedForAllergy: 0,
    } as any);
    expect(reply).toContain('آسان');
    expect(reply).not.toMatch(/easy|medium|hard/i);
    expect(reply).not.toContain('آلرژی'); // nothing dropped → no allergy-filter claim
  });

  it('keeps the allergy-filter note ONLY when a recipe was dropped for allergy', async () => {
    const { svc } = makeService({});
    const reply = svc.composeDeterministicReply({
      ...base,
      groundingStatus: 'ok',
      safeRecipes: [{ id: 'r1', title: 'خورش کدو', cookingTime: 80, difficulty: 'hard', fit: 'ok' }],
      droppedForAllergy: 2,
    } as any);
    expect(reply).toContain('سخت');
    expect(reply).toContain('آلرژی');
  });

  it('an empty result with NO allergy drop returns a neutral clarifier (not an allergy-flavored dead-end)', async () => {
    const { svc } = makeService({});
    const reply = svc.composeDeterministicReply({ ...base, groundingStatus: 'empty', droppedForAllergy: 0 } as any);
    expect(reply).toContain('متوجه نشدم');
    expect(reply).not.toContain('آلرژی');
  });
});

describe('GroundedReplyService — provider-agnostic (no model dependency)', () => {
  it('builds grounding + composes a disclosed, hedged reply with NO model provider', async () => {
    const pool = [recipe('r1', { title: 'آش رشته' })];
    // constructed with ONLY (prisma, profiles, tools) — there is no model provider to inject.
    const { svc } = makeService({ profile: profileWithAllergies([]), pool });
    const g = await svc.buildGrounding('u1', 'آش');
    const reply = svc.composeDeterministicReply(g);
    expect(g.groundingStatus).toBe('ok');
    expect(reply).toContain('آش رشته'); // grounded in the real corpus result
    expect(reply).toContain('هوش مصنوعی'); // AI disclosure
    expect(reply).toContain('اطلاعات عمومی، نه توصیهٔ پزشکی'); // non-medical hedge
    // GroundedReplyService.length === 3 (prisma, profiles, tools): no model-provider constructor arg.
    expect(GroundedReplyService.length).toBe(3);
  });
});
