import { presentIngredientSections } from './ingredientDisplayPresenter.js';
import { getRecipeAction } from './recipeInteractionMode.js';

const list = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

export function presentRecipeDetail(recipe = {}, gris = null) {
  const ingredientSource = list(gris?.ingredients).length ? list(gris.ingredients) : list(recipe.ingredients);
  const stepSource = list(gris?.steps).length ? list(gris.steps) : list(recipe.steps);
  const actionCopy = getRecipeAction({ ...recipe, gris });

  return {
    hero: {
      title: recipe.title || '',
      imageUrl: recipe.imageUrl || null,
      description: recipe.description || '',
    },
    quickFacts: {
      servingsText: recipe.servingsText || '',
      cookTimeText: recipe.cookTimeText || '',
      difficultyText: recipe.difficultyText || '',
    },
    ingredientSections: presentIngredientSections(ingredientSource).sections,
    primaryStory: gris?.story?.origin || recipe.description || '',
    guidedSteps: stepSource,
    collapsibleSections: {
      tips: list(recipe.tips),
      troubleshooting: list(gris?.troubleshooting),
      variations: list(gris?.variations),
      storage: gris?.keep || null,
      serveWith: list(gris?.serveWith),
      faq: list(gris?.faq).length ? list(gris.faq) : list(recipe.faq),
      nutrition: null,
    },
    actionCopy,
    editCapabilities: {
      usesGuardedRemove: true,
      usesGuardedSubstitution: true,
    },
  };
}
