import { CURRENT_PRIVACY_POLICY_VERSION } from '../consent/consent.constants';
import { MealPlansService } from './meal-plans.service';

const recipes = Array.from({ length: 14 }, (_, index) => ({
  id: `r${index}`,
  status: 'active',
  isPublic: true,
  region: 'persian',
  mealType:
    index % 3 === 0
      ? 'breakfast'
      : index % 3 === 1
        ? 'lunch'
        : 'dinner',
  ingredients: [],
}));

function make(decisions: unknown[] = []) {
  const tx = {
    mealSlot: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    mealPlan: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({ id: 'p1', slots: [] }),
    },
  };
  const prisma: any = {
    userConsent: { findMany: jest.fn().mockResolvedValue(decisions) },
    userPreference: {
      findUnique: jest.fn().mockResolvedValue({
        diet: 'vegetarian',
        skillLevel: 'beginner',
        budget: 'low',
      }),
    },
    recipe: { findMany: jest.fn().mockResolvedValue(recipes) },
    $transaction: jest.fn((callback) => callback(tx)),
  };
  const safety: any = {
    filter: jest.fn((_userId, candidates) => Promise.resolve(candidates)),
  };
  return {
    prisma,
    safety,
    service: new MealPlansService(prisma, safety),
  };
}

describe('MealPlansService.generateSmartPlan budget consent boundary', () => {
  const previousRuntime = process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;

  beforeEach(() => {
    delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
  });

  afterAll(() => {
    if (previousRuntime === undefined)
      delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
    else
      process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = previousRuntime;
  });

  it('runtime OFF selects core diet/skill only and never applies budget', async () => {
    const h = make([
      {
        purpose: 'personalization',
        status: 'granted',
        policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
      },
    ]);

    await h.service.generateSmartPlan('u1');

    expect(h.prisma.userConsent.findMany).not.toHaveBeenCalled();
    expect(h.prisma.userPreference.findUnique).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      select: { diet: true, skillLevel: true },
    });
    const recipeWhere = h.prisma.recipe.findMany.mock.calls[0][0].where;
    expect(recipeWhere).toMatchObject({
      status: 'active',
      isPublic: true,
      diet: { in: ['vegetarian', 'vegan'] },
      difficulty: expect.any(Object),
    });
    expect(recipeWhere).not.toHaveProperty('cost');
    expect(h.safety.filter).toHaveBeenCalled();
  });

  it('runtime ON but denied consent also excludes budget selection and use', async () => {
    process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
    const h = make([]);

    await h.service.generateSmartPlan('u1');

    expect(h.prisma.userPreference.findUnique).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      select: { diet: true, skillLevel: true },
    });
    expect(h.prisma.recipe.findMany.mock.calls[0][0].where).not.toHaveProperty(
      'cost',
    );
  });

  it('runtime ON plus current grant may select and apply budget', async () => {
    process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
    const h = make([
      {
        purpose: 'personalization',
        status: 'granted',
        policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
      },
    ]);

    await h.service.generateSmartPlan('u1');

    expect(h.prisma.userPreference.findUnique).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      select: { diet: true, skillLevel: true, budget: true },
    });
    expect(h.prisma.recipe.findMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({ cost: expect.any(String) }),
    );
  });
});
