// apps/server/src/behavior-engine/routing/processor.registry.ts
import { Injectable } from '@nestjs/common';
import { RecipeSignalProcessor } from '../processors/recipe.signal-processor';
import { MealPlanSignalProcessor } from '../processors/meal-plan.signal-processor';
import { ShoppingSignalProcessor } from '../processors/shopping.signal-processor';
import { RecommendationSignalProcessor } from '../processors/recommendation.signal-processor';

export interface IEventProcessor {
  process(event: any, userId: string): Promise<void>;
}

@Injectable()
export class ProcessorRegistry {
  private readonly map = new Map<string, IEventProcessor>();

  constructor(
    recipeProcessor: RecipeSignalProcessor,
    mealPlanProcessor: MealPlanSignalProcessor,
    shoppingProcessor: ShoppingSignalProcessor,
    recommendationProcessor: RecommendationSignalProcessor,
  ) {
    // Recipe events
    this.map.set('recipe_view', recipeProcessor);
    this.map.set('favorite_add', recipeProcessor);
    this.map.set('favorite_remove', recipeProcessor);

    // Meal Plan events
    this.map.set('mealplan_add', mealPlanProcessor);
    this.map.set('mealplan_generate', mealPlanProcessor);
    this.map.set('mealplan_remove', mealPlanProcessor);
    this.map.set('mealplan_clear', mealPlanProcessor);

    // Shopping events
    this.map.set('shopping_item_add', shoppingProcessor);
    this.map.set('shopping_item_toggle', shoppingProcessor);
    this.map.set('shopping_item_remove', shoppingProcessor);

    // Recommendation events
    this.map.set('recommendation_impression', recommendationProcessor);
    this.map.set('recommendation_click', recommendationProcessor);
    this.map.set('recommendation_save', recommendationProcessor);
    this.map.set('recommendation_cook', recommendationProcessor);
    this.map.set('recommendation_dismiss', recommendationProcessor);
    this.map.set('recommendation_ignore', recommendationProcessor);

    // Negative feedback events
    this.map.set('recipe_skip', recommendationProcessor);
    this.map.set('not_interested', recommendationProcessor);
    this.map.set('quick_exit', recommendationProcessor);
  }

  get(eventType: string): IEventProcessor | undefined {
    return this.map.get(eventType);
  }
}