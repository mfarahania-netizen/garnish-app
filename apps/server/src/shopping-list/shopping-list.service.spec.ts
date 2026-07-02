import { ShoppingListService } from './shopping-list.service';

function makeService(overrides: Partial<any> = {}) {
  const prisma: any = {
    shoppingList: {
      upsert: jest.fn().mockResolvedValue({
        id: 'list-1',
        userId: 'u1',
        items: [
          { id: 'old-plan', name: 'rice', source: 'plan', isChecked: false },
          { id: 'checked-plan', name: 'salt', source: 'plan', isChecked: true },
          {
            id: 'manual',
            name: 'olive oil',
            source: 'manual',
            isChecked: false,
          },
        ],
      }),
    },
    shoppingItem: {
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue({
        id: 'item-1',
        name: 'Rice',
        ingredientId: 'ing-rice',
        amount: '2',
        unit: 'cup',
        shoppingList: { userId: 'u1' },
      }),
      delete: jest.fn().mockResolvedValue({ id: 'item-1' }),
    },
    pantryItem: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'pantry-1' }),
    },
    ingredient: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    mealPlan: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'plan-1',
        slots: [
          {
            id: 'slot-1',
            recipe: {
              id: 'recipe-1',
              servings: 4,
              ingredients: [
                {
                  name: 'rice',
                  amount: '2',
                  unit: 'cup',
                  ingredientId: 'ing-rice',
                  ingredient: { id: 'ing-rice', category: 'pantry' },
                },
                {
                  name: 'olive oil',
                  amount: '1',
                  unit: 'tbsp',
                  ingredientId: 'ing-oil',
                  ingredient: { id: 'ing-oil', category: 'pantry' },
                },
                {
                  name: 'salt',
                  amount: '1',
                  unit: 'tsp',
                  ingredientId: 'ing-salt',
                  ingredient: { id: 'ing-salt', category: 'pantry' },
                },
              ],
            },
          },
        ],
      }),
    },
    mealSlot: {
      findMany: jest.fn().mockResolvedValue([{ id: 'slot-1', servings: 4 }]),
    },
    ...overrides,
  };
  const profiles: any = {
    getLivingUserProfile: jest
      .fn()
      .mockResolvedValue({ declared: { dimensions: {} } }),
  };
  const safety: any = {
    filter: jest.fn(async (_userId: string, recipes: any[]) => recipes),
  };
  return {
    service: new ShoppingListService(prisma, profiles, safety),
    prisma,
    profiles,
    safety,
  };
}

describe('ShoppingListService buildFromPlan', () => {
  it('replaces unchecked plan items before adding current plan ingredients while preserving manual and checked rows', async () => {
    const { service, prisma } = makeService();

    const result = await service.buildFromPlan('u1');

    expect(prisma.shoppingItem.deleteMany).toHaveBeenCalledWith({
      where: { shoppingListId: 'list-1', source: 'plan', isChecked: false },
    });
    expect(prisma.shoppingItem.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.shoppingItem.createMany.mock.calls[0][0].data).toEqual([
      expect.objectContaining({
        name: 'rice',
        ingredientId: 'ing-rice',
        source: 'plan',
      }),
    ]);
    expect(result).toEqual(
      expect.objectContaining({ resultStatus: 'ok', added: 1, removedPlan: 1 }),
    );
  });

  it('clears stale unchecked plan rows even when the current week has no plan recipes', async () => {
    const { service, prisma } = makeService({
      mealPlan: {
        findFirst: jest.fn().mockResolvedValue({ id: 'plan-1', slots: [] }),
      },
    });

    const result = await service.buildFromPlan('u1');

    expect(prisma.shoppingItem.deleteMany).toHaveBeenCalledWith({
      where: { shoppingListId: 'list-1', source: 'plan', isChecked: false },
    });
    expect(prisma.shoppingItem.createMany).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        resultStatus: 'no_plan',
        added: 0,
        removedPlan: 1,
        items: [],
      }),
    );
  });
});

describe('ShoppingListService pantry dedupe', () => {
  it('dedupes pantry by ingredientId when moving a shopping item into pantry', async () => {
    const { service, prisma } = makeService({
      pantryItem: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ name: 'برنج', ingredientId: 'ing-rice' }]),
        create: jest.fn(),
      },
    });

    await service.addToPantry('item-1', 'u1');

    expect(prisma.pantryItem.create).not.toHaveBeenCalled();
    expect(prisma.shoppingItem.delete).toHaveBeenCalledWith({
      where: { id: 'item-1' },
    });
  });

  it('resolves free pantry names to ingredientId and dedupes by that id', async () => {
    const { service, prisma } = makeService({
      ingredient: {
        findFirst: jest.fn().mockResolvedValue({ id: 'ing-rice' }),
      },
      pantryItem: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ name: 'rice', ingredientId: 'ing-rice' }]),
        create: jest.fn(),
      },
    });

    const result = await service.addPantryName('u1', 'برنج');

    expect(result).toEqual({ ok: true });
    expect(prisma.ingredient.findFirst).toHaveBeenCalled();
    expect(prisma.pantryItem.create).not.toHaveBeenCalled();
  });
});
