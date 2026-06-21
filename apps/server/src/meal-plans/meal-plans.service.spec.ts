import { MealPlansService } from './meal-plans.service';
import { NotFoundException } from '@nestjs/common';

const safety: any = { filter: jest.fn() };

describe('MealPlansService — publish gate (advisor audit)', () => {
  it('savePlan REJECTS a slot referencing an unpublished recipe not owned by the user (no transaction)', async () => {
    const prisma: any = {
      recipe: { findMany: jest.fn().mockResolvedValue([{ id: 'r1', status: 'pending', isPublic: true, authorId: 'other' }]) },
      $transaction: jest.fn(),
    };
    const svc = new MealPlansService(prisma, safety);
    await expect(svc.savePlan('me', '2026-06-22', [{ dayOfWeek: 1, mealType: 'lunch', recipeId: 'r1' }]))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('savePlan allows published recipes', async () => {
    const created = { id: 'p1', slots: [{ recipe: { id: 'r1', status: 'active', isPublic: true, authorId: 'x' } }] };
    const prisma: any = {
      recipe: { findMany: jest.fn().mockResolvedValue([{ id: 'r1', status: 'active', isPublic: true, authorId: 'x' }]) },
      $transaction: jest.fn().mockResolvedValue(created),
    };
    const svc = new MealPlansService(prisma, safety);
    const out: any = await svc.savePlan('me', '2026-06-22', [{ dayOfWeek: 1, mealType: 'lunch', recipeId: 'r1' }]);
    expect(out.slots[0].recipe).toBeTruthy();
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('getCurrentPlan NULLS a stored slot recipe that is not published and not owned (keeps the rest)', async () => {
    const plan = { id: 'p1', slots: [
      { recipe: { id: 'a', status: 'active', isPublic: true, authorId: 'x' } },
      { recipe: { id: 'b', status: 'pending', isPublic: true, authorId: 'other' } }, // → null
      { recipe: { id: 'c', status: 'pending', isPublic: true, authorId: 'me' } }, // own draft → kept
    ] };
    const prisma: any = { mealPlan: { findFirst: jest.fn().mockResolvedValue(plan) } };
    const out: any = await new MealPlansService(prisma, safety).getCurrentPlan('me');
    expect(out.slots[0].recipe?.id).toBe('a');
    expect(out.slots[1].recipe).toBeNull();
    expect(out.slots[2].recipe?.id).toBe('c');
  });
});
