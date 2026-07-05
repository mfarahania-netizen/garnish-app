import { getRecipeActionCopy } from './recipeActionCopy.js';

export const RecipeInteractionMode = Object.freeze({
  COOK: 'COOK',
  PREPARE: 'PREPARE',
  ASSEMBLE: 'ASSEMBLE',
  DRINK: 'DRINK',
  NO_COOK_SIMPLE: 'NO_COOK_SIMPLE',
});

const HEAT_TERMS = [
  'بپز', 'پخت', 'بجوش', 'جوش', 'دم', 'تفت', 'سرخ', 'کباب', 'گریل', 'فر',
  'تنور', 'حرارت', 'شعله', 'قابلمه', 'تابه', 'آرام پز', 'آرام‌پز',
  'cook', 'boil', 'simmer', 'fry', 'saute', 'sauté', 'bake', 'roast', 'grill',
  'braise', 'steam', 'sear',
];

const DRINK_TERMS = [
  'نوشیدنی', 'اسموتی', 'آبمیوه', 'دتاکس', 'موهیتو', 'لیموناد',
  'قهوه ترک', 'اسپرسو', 'لاته', 'دمنوش', 'juice', 'smoothie', 'drink', 'beverage',
  'mocktail', 'mojito', 'tea', 'coffee', 'latte',
];

const ASSEMBLY_TERMS = [
  'سالاد', 'بشقاب', 'چیدمان', 'مزبار', 'اسنک', 'لقمه', 'ساندویچ سرد',
  'پنیر', 'گردو', 'خرما', 'آجیل', 'کشمش', 'میوه', 'board', 'plate',
  'platter', 'snack', 'assemble',
];

const PREPARE_TERMS = [
  'مخلوط', 'ترکیب', 'خرد', 'ریز', 'هم بزن', 'سرو', 'آماده', 'سس', 'دیپ',
  'mix', 'combine', 'chop', 'slice', 'serve', 'prepare', 'dip', 'sauce',
];

const NO_COOK_TERMS = [
  'بدون پخت', 'کم پخت یا بدون پخت', 'بی نیاز از پخت', 'بی‌نیاز از پخت',
  'no cook', 'no-cook', 'ready made', 'ready_made',
];

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\u200c/g, ' ')
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/\s+/g, ' ')
    .trim();
}

function collectText(value, out = []) {
  if (value == null) return out;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    out.push(String(value));
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectText(item, out));
    return out;
  }
  if (typeof value === 'object') {
    Object.values(value).forEach((item) => collectText(item, out));
  }
  return out;
}

function ingredientModeText(ingredients) {
  if (!Array.isArray(ingredients)) return [];
  return ingredients.map((ingredient) => {
    if (typeof ingredient === 'string') return ingredient;
    return {
      name: ingredient?.name,
      displayName: ingredient?.displayName,
      component: ingredient?.component,
      group: ingredient?.group,
      section: ingredient?.section,
      preparation: ingredient?.preparation,
      prepState: ingredient?.prepState,
    };
  });
}

function recipeText(recipe) {
  return normalizeText(collectText({
    title: recipe?.title,
    category: recipe?.category,
    categories: recipe?.categories,
    mealTypes: recipe?.mealTypes,
    tags: recipe?.tags,
    description: recipe?.description,
    ingredients: ingredientModeText(recipe?.ingredients),
    steps: recipe?.steps,
    gris: {
      steps: recipe?.gris?.steps,
      ingredients: ingredientModeText(recipe?.gris?.ingredients),
      story: recipe?.gris?.story,
    },
  }).join(' '));
}

function recipeIdentityText(recipe) {
  return normalizeText(collectText({
    title: recipe?.title,
    category: recipe?.category,
    categories: recipe?.categories,
    mealTypes: recipe?.mealTypes,
    tags: recipe?.tags,
    dishType: recipe?.dishType,
  }).join(' '));
}

function includesAny(text, terms) {
  return terms.some((term) => {
    const normalizedTerm = normalizeText(term);
    if (!normalizedTerm) return false;
    if (/^[a-z0-9 ]+$/.test(normalizedTerm)) {
      const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
      return new RegExp(`(^|[^a-z0-9_])${escaped}([^a-z0-9_]|$)`, 'i').test(text);
    }
    if (normalizedTerm.length <= 2) {
      const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(^|[\\s،؛,.!?؟()])${escaped}($|[\\s،؛,.!?؟()])`).test(text);
    }
    return text.includes(normalizedTerm);
  });
}

function stepCount(recipe) {
  if (Array.isArray(recipe?.gris?.steps)) return recipe.gris.steps.length;
  if (Array.isArray(recipe?.steps)) return recipe.steps.length;
  return 0;
}

export { getRecipeActionCopy };

export function getRecipeInteractionMode(recipe) {
  const text = recipeText(recipe);
  const identityText = recipeIdentityText(recipe);
  const titleText = normalizeText(recipe?.title);
  const steps = stepCount(recipe);
  const isSharbatDrink = titleText.startsWith('شربت ');
  const isDrink = isSharbatDrink || includesAny(titleText, DRINK_TERMS) || includesAny(identityText, DRINK_TERMS);
  const hasHeat = includesAny(text, HEAT_TERMS);
  const hasAssembly = includesAny(text, ASSEMBLY_TERMS);
  const hasPrepare = includesAny(text, PREPARE_TERMS);
  const isNoCook = includesAny(text, NO_COOK_TERMS);

  if (isDrink) return RecipeInteractionMode.DRINK;
  if (isNoCook && (hasAssembly || hasPrepare || steps <= 2)) return RecipeInteractionMode.NO_COOK_SIMPLE;
  if (hasHeat) return RecipeInteractionMode.COOK;
  if (hasAssembly && steps <= 2) return RecipeInteractionMode.NO_COOK_SIMPLE;
  if (hasAssembly) return RecipeInteractionMode.ASSEMBLE;
  if (hasPrepare) return RecipeInteractionMode.PREPARE;
  if (steps > 0 && steps <= 2) return RecipeInteractionMode.NO_COOK_SIMPLE;
  return RecipeInteractionMode.COOK;
}

export function getRecipeAction(recipe) {
  const mode = getRecipeInteractionMode(recipe);
  const count = stepCount(recipe);
  const actionCopy = getRecipeActionCopy(mode, count);
  return {
    mode,
    ...actionCopy,
    label: actionCopy.primaryLabel,
    helperText: actionCopy.stepLabel,
    hideStickyCta: !actionCopy.shouldShowStickyCta,
  };
}
