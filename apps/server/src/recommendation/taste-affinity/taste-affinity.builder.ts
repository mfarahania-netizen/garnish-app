import { Injectable } from '@nestjs/common';

type FeatureMap = Record<string, number>;

interface RecipeForTaste {
  title: string;
  diet?: string | null;
  mealType?: string | null;
  categories?: string | null;
  cookingTime?: number | null;
  ingredients?: Array<{
    name: string;
    ingredient?: { code?: string | null; category?: string | null } | null;
  }>;
  searchTerms?: Array<{ term: string }>;
}

@Injectable()
export class TasteAffinityBuilder {
  private readonly tasteSignalMap: Record<string, string[]> = {
    likes_high_protein: ['protein', 'high_protein', 'chicken', 'beef', 'egg', 'fish', 'seafood', 'shrimp'],
    likes_spicy: ['spicy', 'pepper', 'chili', 'harissa', 'sriracha', 'jalapeno'],
    likes_grilled: ['grill', 'grilled', 'bbq', 'barbecue', 'kebab'],
    likes_baked: ['baked', 'oven', 'roast', 'roasted'],
    likes_fried: ['fried', 'crispy', 'crunchy'],
    likes_stew: ['stew', 'stewed', 'braised', 'slow_cooked'],
    likes_one_pot: ['one_pot', 'one-pot', 'sheet_pan', 'casserole'],
    likes_no_cook: ['no_cook', 'raw', 'salad', 'cold'],
    likes_italian: ['italian', 'pasta', 'risotto', 'lasagna', 'pizza'],
    likes_asian: ['asian', 'ramen', 'noodle', 'stir_fry', 'teriyaki'],
    likes_middle_eastern: ['middle_eastern', 'shawarma', 'hummus', 'falafel', 'kebab'],
    likes_family_meals: ['family', 'family_meal', 'servings'],
    likes_budget_meals: ['budget', 'cheap', 'low_cost'],
    likes_healthy: ['healthy', 'light', 'salad', 'veggie', 'vegetable', 'vegetarian', 'vegan'],
    likes_fast_meals: ['quick', 'fast', '15min', '20min', '30min'],
    likes_weekend_cooking: ['slow', 'elaborate', 'roast', 'bake'],
    prefers_vegetarian: ['vegetarian', 'vegan'],
  };

  build(recipe: RecipeForTaste, features: FeatureMap) {
    const tokens = this.recipeTokens(recipe);
    const activeSignals = Object.entries(features)
      .filter(([key, value]) => key.startsWith('signal_') && Number(value) > 0.05)
      .map(([key, value]) => ({ name: key.replace(/^signal_/, ''), value: Number(value) }))
      .filter(({ name }) => this.tasteSignalMap[name]);

    if (activeSignals.length === 0) {
      return { score: 0.35, matchedSignals: [] as string[] };
    }

    let matchedWeight = 0;
    let totalWeight = 0;
    const matchedSignals: string[] = [];

    for (const signal of activeSignals) {
      totalWeight += signal.value;
      const signalTokens = this.tasteSignalMap[signal.name];
      if (
        this.isCompatibleSignal(signal.name, recipe, tokens) &&
        signalTokens.some((token) => tokens.has(token))
      ) {
        matchedWeight += signal.value;
        matchedSignals.push(signal.name);
      }
    }

    if (matchedSignals.length === 0) {
      return { score: 0.35, matchedSignals };
    }

    const signalSpecificity = Math.min(1, matchedSignals.length / Math.max(activeSignals.length, 1));
    const baseMatch = matchedWeight / Math.max(totalWeight, 0.01);
    const evidenceCap = matchedSignals.length >= 3 ? 0.96 : matchedSignals.length === 2 ? 0.9 : 0.78;
    const score = Math.min(evidenceCap, 0.12 + baseMatch * 0.76 + signalSpecificity * 0.08);

    return {
      score: Math.max(0, Math.min(1, Math.round(score * 100) / 100)),
      matchedSignals,
    };
  }

  private isCompatibleSignal(signalName: string, recipe: RecipeForTaste, tokens: Set<string>) {
    const diet = String(recipe.diet || '').toLowerCase();
    const isPlantBased = /vegetarian|vegan/.test(diet);

    if (isPlantBased && ['likes_chicken', 'likes_beef', 'likes_seafood'].includes(signalName)) {
      return false;
    }

    if (signalName === 'likes_high_protein' && isPlantBased) {
      return tokens.has('egg') || tokens.has('protein') || tokens.has('high_protein');
    }

    return true;
  }

  private recipeTokens(recipe: RecipeForTaste): Set<string> {
    const rawValues = [
      recipe.title,
      recipe.diet,
      recipe.mealType,
      recipe.categories,
      ...(recipe.ingredients || []).map((item) => item.name),
      ...(recipe.ingredients || []).map((item) => item.ingredient?.code),
      ...(recipe.ingredients || []).map((item) => item.ingredient?.category),
      ...(recipe.searchTerms || []).map((item) => item.term),
    ];

    const tokens = new Set<string>();
    for (const value of rawValues) {
      if (!value) continue;
      const normalized = String(value).toLowerCase();
      tokens.add(normalized);
      normalized
        .replace(/[[\]{}",]/g, ' ')
        .split(/[\s,_-]+/)
        .filter(Boolean)
        .forEach((token) => tokens.add(token));
    }
    return tokens;
  }
}
