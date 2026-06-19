import { RecommendationSignalProcessor } from './recommendation.signal-processor';
import { MealPlanSignalProcessor } from './meal-plan.signal-processor';
import { ShoppingSignalProcessor } from './shopping.signal-processor';
import { SignalCalculatorService } from '../signals/signal-calculator.service';

/**
 * FI-STEP-1 — learn from rejection (write side). Proves the negative-feedback chain that the live ranker
 * reads: a dismiss → applyNegativeFeedback; applyNegativeFeedback decrements the matching UserBehaviorSignal;
 * meal-plan remove/clear now record a negative signal (previously nothing); shopping remove records friction.
 * The *_add paths are asserted unchanged (additive).
 */
describe('FI-STEP-1 — learn from rejection (signal write chain)', () => {
  describe('RecommendationSignalProcessor — dismiss → applyNegativeFeedback', () => {
    it('recommendation_dismiss routes to applyNegativeFeedback(-0.5) keyed to recipeId', async () => {
      const signalCalculator = { applyNegativeFeedback: jest.fn(), applyPositiveFeedback: jest.fn() } as any;
      const prisma = { recommendationAttributionEvent: { create: jest.fn() }, signalObservation: { create: jest.fn() } } as any;
      const proc = new RecommendationSignalProcessor(prisma, signalCalculator);
      await proc.process({ id: 'e1', type: 'recommendation_dismiss', payload: JSON.stringify({ recipeId: 'r1' }) }, 'u1');
      expect(signalCalculator.applyNegativeFeedback).toHaveBeenCalledWith('u1', 'r1', -0.5);
    });

    it('not_interested also → applyNegativeFeedback(-0.5); recipe_skip → -0.2', async () => {
      const signalCalculator = { applyNegativeFeedback: jest.fn(), applyPositiveFeedback: jest.fn() } as any;
      const prisma = { recommendationAttributionEvent: { create: jest.fn() }, signalObservation: { create: jest.fn() } } as any;
      const proc = new RecommendationSignalProcessor(prisma, signalCalculator);
      await proc.process({ id: 'e2', type: 'not_interested', payload: JSON.stringify({ recipeId: 'r2' }) }, 'u1');
      await proc.process({ id: 'e3', type: 'recipe_skip', payload: JSON.stringify({ recipeId: 'r3' }) }, 'u1');
      expect(signalCalculator.applyNegativeFeedback).toHaveBeenCalledWith('u1', 'r2', -0.5);
      expect(signalCalculator.applyNegativeFeedback).toHaveBeenCalledWith('u1', 'r3', -0.2);
    });
  });

  describe('SignalCalculatorService.applyNegativeFeedback — decrements the matching UserBehaviorSignal', () => {
    it('a chicken recipe dismiss decrements the user\'s likes_chicken (0.8 → 0.3) + drops confidence', async () => {
      const update = jest.fn();
      const prisma = {
        recipe: { findUnique: jest.fn().mockResolvedValue({ ingredients: [{ name: 'مرغ' }], categories: '[]', diet: 'omnivore' }) },
        userBehaviorSignal: {
          findUnique: jest.fn().mockResolvedValue({ value: 0.8, confidence: 0.6 }),
          update,
        },
      } as any;
      const calc = new SignalCalculatorService(prisma);
      await calc.applyNegativeFeedback('u1', 'r1', -0.5);
      expect(update).toHaveBeenCalledTimes(1);
      const arg = update.mock.calls[0][0];
      expect(arg.where).toEqual({ userId_signalName: { userId: 'u1', signalName: 'likes_chicken' } });
      expect(arg.data.value).toBeCloseTo(0.3, 5); // max(0, 0.8 - 0.5)
      expect(arg.data.confidence).toBeCloseTo(0.54, 5); // 0.6 * 0.9
    });

    it('never goes below 0 (max(0, value+factor))', async () => {
      const update = jest.fn();
      const prisma = {
        recipe: { findUnique: jest.fn().mockResolvedValue({ ingredients: [{ name: 'مرغ' }], categories: '[]', diet: 'omnivore' }) },
        userBehaviorSignal: { findUnique: jest.fn().mockResolvedValue({ value: 0.1, confidence: 0.6 }), update },
      } as any;
      const calc = new SignalCalculatorService(prisma);
      await calc.applyNegativeFeedback('u1', 'r1', -0.5);
      expect(update.mock.calls[0][0].data.value).toBe(0); // max(0, 0.1 - 0.5)
    });
  });

  describe('MealPlanSignalProcessor — remove/clear now record a negative signal (was nothing)', () => {
    it('mealplan_remove → applyNegativeFeedback(-0.2) + plan_abandonment observation', async () => {
      const signalCalculator = { applyNegativeFeedback: jest.fn(), updateSignal: jest.fn() } as any;
      const create = jest.fn();
      const prisma = { signalObservation: { create } } as any;
      const proc = new MealPlanSignalProcessor(prisma, signalCalculator);
      await proc.process({ id: 'e1', type: 'mealplan_remove', payload: JSON.stringify({ recipeId: 'r1', dayOfWeek: 1, mealType: 'dinner' }) }, 'u1');
      expect(signalCalculator.applyNegativeFeedback).toHaveBeenCalledWith('u1', 'r1', -0.2);
      expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'u1', signalName: 'plan_abandonment' }) });
    });

    it('mealplan_clear (no recipeId) → plan_abandonment observation only (no per-recipe negative)', async () => {
      const signalCalculator = { applyNegativeFeedback: jest.fn(), updateSignal: jest.fn() } as any;
      const create = jest.fn();
      const proc = new MealPlanSignalProcessor({ signalObservation: { create } } as any, signalCalculator);
      await proc.process({ id: 'e2', type: 'mealplan_clear', payload: '{}' }, 'u1');
      expect(signalCalculator.applyNegativeFeedback).not.toHaveBeenCalled();
      expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ signalName: 'plan_abandonment' }) });
    });

    it('mealplan_add is UNCHANGED (consistent_meal_planner + plans_meal; no negative)', async () => {
      const signalCalculator = { applyNegativeFeedback: jest.fn(), updateSignal: jest.fn() } as any;
      const create = jest.fn();
      const proc = new MealPlanSignalProcessor({ signalObservation: { create } } as any, signalCalculator);
      await proc.process({ id: 'e3', type: 'mealplan_add', payload: JSON.stringify({ recipeId: 'r1' }) }, 'u1');
      expect(signalCalculator.updateSignal).toHaveBeenCalledWith('u1', 'consistent_meal_planner', 'cooking', 'behavior', 0.9, 1);
      expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ signalName: 'plans_meal' }) });
      expect(signalCalculator.applyNegativeFeedback).not.toHaveBeenCalled();
    });
  });

  describe('ShoppingSignalProcessor — remove now records grocery_friction (was nothing)', () => {
    it('shopping_item_remove → grocery_friction observation', async () => {
      const create = jest.fn();
      const proc = new ShoppingSignalProcessor({ signalObservation: { create } } as any, { updateSignal: jest.fn() } as any);
      await proc.process({ id: 'e1', type: 'shopping_item_remove', payload: '{}' }, 'u1');
      expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ signalName: 'grocery_friction' }) });
    });

    it('shopping_item_add is UNCHANGED (budget_sensitive + shops_efficiently)', async () => {
      const updateSignal = jest.fn();
      const create = jest.fn();
      const proc = new ShoppingSignalProcessor({ signalObservation: { create } } as any, { updateSignal } as any);
      await proc.process({ id: 'e2', type: 'shopping_item_add', payload: '{}' }, 'u1');
      expect(updateSignal).toHaveBeenCalledWith('u1', 'budget_sensitive', 'engagement', 'behavior', 0.7, 1);
      expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ signalName: 'shops_efficiently' }) });
    });
  });
});
