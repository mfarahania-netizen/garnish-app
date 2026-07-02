import { MealPlansService } from './meal-plans.service';
import { NotFoundException } from '@nestjs/common';

const safety: any = { filter: jest.fn() };

describe('MealPlansService — publish gate (advisor audit)', () => {
  it('savePlan REJECTS a slot referencing an unpublished recipe not owned by the user (no transaction)', async () => {
    const prisma: any = {
      recipe: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'r1', status: 'pending', isPublic: true, authorId: 'other' },
          ]),
      },
      $transaction: jest.fn(),
    };
    const svc = new MealPlansService(prisma, safety);
    await expect(
      svc.savePlan('me', '2026-06-22', [
        { dayOfWeek: 1, mealType: 'lunch', recipeId: 'r1' },
      ]),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('savePlan allows published recipes', async () => {
    const created = {
      id: 'p1',
      slots: [
        {
          recipe: { id: 'r1', status: 'active', isPublic: true, authorId: 'x' },
        },
      ],
    };
    const prisma: any = {
      recipe: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'r1', status: 'active', isPublic: true, authorId: 'x' },
          ]),
      },
      $transaction: jest.fn().mockResolvedValue(created),
    };
    const svc = new MealPlansService(prisma, safety);
    const out: any = await svc.savePlan('me', '2026-06-22', [
      { dayOfWeek: 1, mealType: 'lunch', recipeId: 'r1' },
    ]);
    expect(out.slots[0].recipe).toBeTruthy();
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('getCurrentPlan NULLS a stored slot recipe that is not published and not owned (keeps the rest)', async () => {
    const plan = {
      id: 'p1',
      slots: [
        {
          id: 's1',
          recipe: { id: 'a', status: 'active', isPublic: true, authorId: 'x' },
        },
        {
          id: 's2',
          recipe: {
            id: 'b',
            status: 'pending',
            isPublic: true,
            authorId: 'other',
          },
        }, // → null
        {
          id: 's3',
          recipe: {
            id: 'c',
            status: 'pending',
            isPublic: true,
            authorId: 'me',
          },
        }, // own draft → kept
      ],
    };
    const prisma: any = {
      mealPlan: { findFirst: jest.fn().mockResolvedValue(plan) },
      mealSlot: {
        findMany: jest.fn().mockResolvedValue([
          { id: 's1', cookedAt: null, servings: null },
          { id: 's2', cookedAt: null, servings: 2 },
          { id: 's3', cookedAt: null, servings: null },
        ]),
      },
    };
    const out: any = await new MealPlansService(prisma, safety).getCurrentPlan(
      'me',
    );
    expect(out.slots[0].recipe?.id).toBe('a');
    expect(out.slots[1].recipe).toBeNull();
    expect(out.slots[2].recipe?.id).toBe('c');
  });

  it("addMealSlot REJECTS another user's unpublished recipe (no transaction, no body echo)", async () => {
    const prisma: any = {
      recipe: {
        findUnique: jest.fn().mockResolvedValue({
          status: 'pending',
          isPublic: true,
          authorId: 'other',
        }),
      },
      $transaction: jest.fn(),
    };
    await expect(
      new MealPlansService(prisma, safety).addMealSlot('me', 1, 'lunch', 'r1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('addMealSlot allows a published recipe and returns its slot', async () => {
    const created = {
      id: 's1',
      recipe: { id: 'r1', status: 'active', isPublic: true, authorId: 'x' },
    };
    const prisma: any = {
      recipe: {
        findUnique: jest.fn().mockResolvedValue({
          status: 'active',
          isPublic: true,
          authorId: 'x',
        }),
      },
      $transaction: jest.fn().mockResolvedValue(created),
    };
    const out: any = await new MealPlansService(prisma, safety).addMealSlot(
      'me',
      1,
      'lunch',
      'r1',
    );
    expect(out.recipe?.id).toBe('r1');
  });
});
