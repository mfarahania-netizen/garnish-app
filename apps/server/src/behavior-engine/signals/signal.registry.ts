// apps/server/src/behavior-engine/signals/signal.registry.ts
import { Injectable } from '@nestjs/common';

export interface ISignalDefinition {
  name: string;
  domain: 'nutrition' | 'health' | 'engagement' | 'cooking' | 'identity';
  type: 'raw' | 'behavior' | 'identity';
  halfLifeDays: number;
  description: string;
}

@Injectable()
export class SignalRegistryService {
  private readonly signals: Map<string, ISignalDefinition> = new Map();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults() {
    this.register({
      name: 'likes_high_protein',
      domain: 'nutrition',
      type: 'raw',
      halfLifeDays: 90,
      description: 'User frequently views or saves high-protein recipes',
    });

    this.register({
      name: 'likes_healthy',
      domain: 'health',
      type: 'raw',
      halfLifeDays: 90,
      description: 'User prefers healthy, lighter recipes',
    });

    this.register({
      name: 'likes_fast_meals',
      domain: 'engagement',
      type: 'behavior',
      halfLifeDays: 45,
      description: 'User often chooses quick recipes',
    });

    this.register({
      name: 'prefers_vegetarian',
      domain: 'health',
      type: 'raw',
      halfLifeDays: 90,
      description: 'User prefers vegetarian or vegan meals',
    });

    this.register({
      name: 'consistent_meal_planner',
      domain: 'cooking',
      type: 'behavior',
      halfLifeDays: 60,
      description: 'User consistently creates meal plans',
    });

    this.register({
      name: 'budget_sensitive',
      domain: 'engagement',
      type: 'behavior',
      halfLifeDays: 60,
      description: 'User is careful about shopping budget',
    });

    this.register({
      name: 'health_conscious',
      domain: 'health',
      type: 'behavior',
      halfLifeDays: 30,
      description: 'User actively pursues health goals',
    });

    this.register({
      name: 'food_explorer',
      domain: 'identity',
      type: 'identity',
      halfLifeDays: 365,
      description: 'User tries diverse recipes and ingredients',
    });

    this.register({
      name: 'likes_spicy',
      domain: 'nutrition',
      type: 'raw',
      halfLifeDays: 90,
      description: 'User prefers spicy food',
    });

    this.register({
      name: 'likes_italian',
      domain: 'nutrition',
      type: 'raw',
      halfLifeDays: 90,
      description: 'User likes Italian dishes and pasta-based meals',
    });

    this.register({
      name: 'likes_asian',
      domain: 'nutrition',
      type: 'raw',
      halfLifeDays: 90,
      description: 'User likes Asian dishes and noodle/stir fry meals',
    });

    this.register({
      name: 'likes_middle_eastern',
      domain: 'nutrition',
      type: 'raw',
      halfLifeDays: 90,
      description: 'User likes Middle Eastern flavors and recipes',
    });

    this.register({
      name: 'likes_grilled_food',
      domain: 'nutrition',
      type: 'raw',
      halfLifeDays: 90,
      description: 'User prefers grilled and barbecue recipes',
    });

    this.register({
      name: 'likes_quick_meals',
      domain: 'engagement',
      type: 'behavior',
      halfLifeDays: 45,
      description: 'User often chooses fast recipes',
    });

    this.register({
      name: 'time_poor',
      domain: 'engagement',
      type: 'behavior',
      halfLifeDays: 45,
      description: 'User usually has low cooking time availability',
    });

    this.register({
      name: 'weekend_cook',
      domain: 'cooking',
      type: 'behavior',
      halfLifeDays: 60,
      description: 'User cooks more elaborate meals on weekends',
    });

    this.register({
      name: 'meal_planner',
      domain: 'cooking',
      type: 'behavior',
      halfLifeDays: 60,
      description: 'User regularly plans meals ahead',
    });

    this.register({
      name: 'family_meal_planner',
      domain: 'cooking',
      type: 'behavior',
      halfLifeDays: 60,
      description: 'User plans recipes for family servings',
    });

    this.register({
      name: 'likes_family_meals',
      domain: 'cooking',
      type: 'behavior',
      halfLifeDays: 60,
      description: 'User prefers recipes for family servings',
    });

    this.register({
      name: 'budget_sensitive',
      domain: 'engagement',
      type: 'behavior',
      halfLifeDays: 60,
      description: 'User is careful about shopping budget',
    });

    this.register({
      name: 'goal_adherence',
      domain: 'health',
      type: 'behavior',
      halfLifeDays: 45,
      description: 'User sticks to health goals',
    });

    this.register({
      name: 'weight_loss',
      domain: 'health',
      type: 'behavior',
      halfLifeDays: 45,
      description: 'User is focused on weight loss',
    });

    this.register({
      name: 'muscle_gain',
      domain: 'health',
      type: 'behavior',
      halfLifeDays: 45,
      description: 'User is focused on muscle gain',
    });

    this.register({
      name: 'cooking_novice',
      domain: 'cooking',
      type: 'behavior',
      halfLifeDays: 90,
      description: 'User prefers easy and beginner-friendly recipes',
    });

    this.register({
      name: 'health_conscious',
      domain: 'health',
      type: 'behavior',
      halfLifeDays: 30,
      description: 'User actively pursues health goals',
    });

    this.register({
      name: 'likes_budget_meals',
      domain: 'engagement',
      type: 'behavior',
      halfLifeDays: 60,
      description: 'User prefers low-cost recipes and budget-conscious meals',
    });

    this.register({
      name: 'likes_no_cook',
      domain: 'engagement',
      type: 'raw',
      halfLifeDays: 60,
      description: 'User likes no-cook or raw recipe formats',
    });

    this.register({
      name: 'likes_one_pot',
      domain: 'cooking',
      type: 'behavior',
      halfLifeDays: 60,
      description: 'User likes one-pot or sheet-pan meals',
    });

    this.register({
      name: 'likes_weekend_cooking',
      domain: 'cooking',
      type: 'behavior',
      halfLifeDays: 60,
      description: 'User prefers elaborate recipes on weekends',
    });

    [
      ['quick_meal_lover', 'engagement', 'User repeatedly engages with recipes under 30 minutes'],
      ['breakfast_person', 'cooking', 'User often engages with breakfast recipes'],
      ['late_night_eater', 'engagement', 'User frequently interacts with food content late at night'],
      ['high_protein_seeker', 'nutrition', 'User gravitates toward protein-rich meals'],
      ['comfort_food_lover', 'identity', 'User prefers familiar, warm, comforting meals'],
      ['family_cook', 'cooking', 'User tends to choose recipes with family-size servings'],
      ['explorer_score', 'identity', 'User explores diverse recipes, cuisines, and ingredients'],
      ['recipe_vector_novelty', 'identity', 'User is receptive to distinct recipe-level variety'],
    ].forEach(([name, domain, description]) =>
      this.register({
        name,
        domain: domain as ISignalDefinition['domain'],
        type: 'behavior',
        halfLifeDays: 60,
        description,
      }),
    );
  }

  register(definition: ISignalDefinition) {
    if (this.signals.has(definition.name)) return;
    this.signals.set(definition.name, definition);
  }

  getAll(): ISignalDefinition[] {
    return Array.from(this.signals.values());
  }

  get(name: string): ISignalDefinition | undefined {
    return this.signals.get(name);
  }
}
