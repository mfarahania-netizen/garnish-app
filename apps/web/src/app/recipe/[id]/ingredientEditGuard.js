export const IngredientEditability = Object.freeze({
  LOCKED_ESSENTIAL: 'LOCKED_ESSENTIAL',
  REMOVABLE_OPTIONAL: 'REMOVABLE_OPTIONAL',
  REMOVABLE_WITH_WARNING: 'REMOVABLE_WITH_WARNING',
  SUBSTITUTE_ONLY: 'SUBSTITUTE_ONLY',
  QUANTITY_ADJUST_ONLY: 'QUANTITY_ADJUST_ONLY',
});

const normalize = (value) => String(value ?? '')
  .replace(/\u200c/g, ' ')
  .replace(/[ي]/g, 'ی')
  .replace(/[ك]/g, 'ک')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const OPTIONAL_TERMS = ['اختیاری', 'تزئین', 'تزیین', 'گارنیش', 'برای سرو', 'روی غذا', 'پاشیدن', 'garnish', 'optional'];
const ESSENTIAL_TERMS = [
  'لپه', 'بادمجان', 'گوشت', 'برنج', 'میسو', 'رب انار', 'گردو', 'تخم مرغ', 'تخم‌مرغ', 'سیب زمینی', 'سیب‌زمینی',
  'chickpea', 'potato', 'miso', 'egg', 'rice', 'walnut',
];
const IDENTITY_BY_RECIPE = [
  { recipe: ['قیمه'], ingredient: ['لپه', 'گوشت', 'رب گوجه', 'لیموعمانی'] },
  { recipe: ['کشک بادمجان', 'میرزا قاسمی'], ingredient: ['بادمجان'] },
  { recipe: ['پلو'], ingredient: ['برنج'] },
  { recipe: ['miso'], ingredient: ['miso', 'میسو'] },
  { recipe: ['قنبرپلو'], ingredient: ['رب انار', 'گردو'] },
  { recipe: ['املت', 'کوکو'], ingredient: ['تخم مرغ', 'تخم‌مرغ'] },
  { recipe: ['fish and chips'], ingredient: ['potato', 'سیب زمینی', 'سیب‌زمینی'] },
];

const includesAny = (text, terms) => terms.some((term) => text.includes(normalize(term)));

export function getIngredientEditGuard(ingredient = {}, recipe = {}) {
  const name = normalize(ingredient.displayName || ingredient.name || ingredient.title);
  const role = normalize(ingredient.role || ingredient.component || ingredient.section || ingredient.group);
  const recipeText = normalize(`${recipe.title || ''} ${recipe.category || ''} ${(recipe.categories || []).join(' ')}`);
  const optional = ingredient.optional === true || includesAny(`${name} ${role}`, OPTIONAL_TERMS);
  const identityByRecipe = IDENTITY_BY_RECIPE.some((rule) => (
    includesAny(recipeText, rule.recipe) && includesAny(name, rule.ingredient)
  ));
  const identityByName = includesAny(name, ESSENTIAL_TERMS);
  const identityByRole = includesAny(role, ['اصلی', 'هویت', 'ساختار', 'پایه', 'امضای طعم']);

  if (optional && !identityByRecipe) {
    return {
      status: IngredientEditability.REMOVABLE_OPTIONAL,
      canRemoveDirectly: true,
      canSubstitute: true,
      message: 'این ماده اختیاری است و حذفش فقط طعم یا ظاهر را کمی تغییر می‌دهد.',
      impact: 'تغییر کم',
    };
  }
  if (identityByRecipe || identityByName || identityByRole) {
    return {
      status: IngredientEditability.LOCKED_ESSENTIAL,
      canRemoveDirectly: false,
      canSubstitute: true,
      message: 'این ماده هویت غذا را می‌سازد و قابل حذف مستقیم نیست.',
      impact: 'هویت غذا تغییر می‌کند',
    };
  }
  return {
    status: IngredientEditability.REMOVABLE_WITH_WARNING,
    canRemoveDirectly: false,
    canSubstitute: true,
    message: 'حذف این ماده ممکن است طعم یا بافت غذا را تغییر دهد. قبل از حذف، اثرش را بررسی کن.',
    impact: 'تغییر قابل توجه',
  };
}
