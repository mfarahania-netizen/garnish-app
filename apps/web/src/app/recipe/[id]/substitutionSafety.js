export const SubstitutionSafetyLevel = Object.freeze({
  SAFE_EQUIVALENT: 'SAFE_EQUIVALENT',
  ACCEPTABLE_VARIANT: 'ACCEPTABLE_VARIANT',
  CHANGES_CHARACTER: 'CHANGES_CHARACTER',
  UNSAFE: 'UNSAFE',
});

const normalize = (value) => String(value ?? '')
  .replace(/\u200c/g, ' ')
  .replace(/[ي]/g, 'ی')
  .replace(/[ك]/g, 'ک')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const has = (text, terms) => terms.some((term) => text.includes(normalize(term)));

export function assessSubstitutionSafety(source, option, recipe = {}) {
  const from = normalize(source);
  const to = normalize(option?.name || option);
  const recipeText = normalize(recipe.title || '');
  if (!from || !to || from === to) return { level: SubstitutionSafetyLevel.UNSAFE, canApply: false, badge: 'نامطمئن', reason: 'جایگزین معتبر نیست.' };

  if (has(from, ['سیب زمینی', 'سیب‌زمینی', 'potato']) && has(to, ['شلغم', 'turnip'])) {
    return { level: SubstitutionSafetyLevel.UNSAFE, canApply: false, badge: 'نامطمئن', reason: 'شلغم خام جایگزین امن سیب‌زمینی در نقش نشاسته‌ای یا سرخ‌کردنی نیست.' };
  }
  if (has(from, ['گوشت', 'lamb', 'beef']) && has(to, ['گوشت', 'lamb', 'beef'])) {
    return { level: SubstitutionSafetyLevel.ACCEPTABLE_VARIANT, canApply: true, badge: 'قابل قبول', reason: 'پروتئین هم‌خانواده است و شخصیت غذا را کمتر تغییر می‌دهد.' };
  }
  if (has(from, ['لیمو', 'آبلیمو', 'lime', 'lemon']) && has(to, ['لیمو', 'آبلیمو', 'آبغوره', 'verjuice', 'lime', 'lemon'])) {
    return { level: SubstitutionSafetyLevel.SAFE_EQUIVALENT, canApply: true, badge: 'کم‌تغییر', reason: 'اسیدیته نزدیک می‌دهد.' };
  }
  if (has(recipeText, ['قیمه']) && has(from, ['لپه'])) {
    return { level: SubstitutionSafetyLevel.UNSAFE, canApply: false, badge: 'نامطمئن', reason: 'لپه هویت قیمه را می‌سازد و جایگزین آزاد ندارد.' };
  }
  if (option?.basis === 'authored' || option?.basis === 'explicit_option') {
    return { level: SubstitutionSafetyLevel.ACCEPTABLE_VARIANT, canApply: true, badge: option.basis === 'authored' ? 'کم‌تغییر' : 'قابل قبول', reason: option.reason || 'برای این دستور قابل دفاع است.' };
  }
  if (option?.basis === 'same_category') {
    return { level: SubstitutionSafetyLevel.CHANGES_CHARACTER, canApply: false, badge: 'طعم را عوض می‌کند', reason: option.reason || 'فقط هم‌گروه است و برای اعمال مستقیم کافی نیست.' };
  }
  return { level: SubstitutionSafetyLevel.UNSAFE, canApply: false, badge: 'نامطمئن', reason: 'از نظر نقش آشپزی برای اعمال مستقیم کافی نیست.' };
}

export function filterSafeSubstitutions(source, items = [], recipe = {}) {
  const seen = new Set();
  return items
    .map((item) => ({ ...item, safety: assessSubstitutionSafety(source, item, recipe) }))
    .filter((item) => item.safety.level === SubstitutionSafetyLevel.SAFE_EQUIVALENT || item.safety.level === SubstitutionSafetyLevel.ACCEPTABLE_VARIANT)
    .filter((item) => {
      const key = normalize(item.name);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);
}
