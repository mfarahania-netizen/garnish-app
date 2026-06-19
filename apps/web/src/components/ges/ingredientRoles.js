// GES — a conservative "is this ingredient structural?" heuristic used to WARN (never hard-block)
// before a remove, and to nudge a swap instead (PERSONALIZATION_ENGINE_SPEC §5: a critical-role
// ingredient shouldn't simply vanish — leavening/binders/structure change the result).
//
// Deliberately conservative: it only flags ingredients we're fairly sure carry structure, so it
// doesn't cry wolf on a garnish. The real per-ingredient functionalRoles live in the dictionary;
// this is the client-side guard until the server cascade (Phase 4) returns role-aware validation.

const ZWNJ = /[‌‍]/g;
const norm = (s) => String(s ?? '').replace(ZWNJ, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

// names that almost always carry structure / leavening / binding in a recipe
const STRUCTURAL_NAMES = [
  'تخم مرغ', 'زرده', 'سفیده', 'آرد', 'بکینگ پودر', 'بیکینگ پودر', 'جوش شیرین', 'بکینگ سودا',
  'خمیر مایه', 'خمیرمایه', 'مایه خمیر', 'مخمر', 'ژلاتین', 'نشاسته', 'پودر ژله', 'agar', 'آگار',
  'egg', 'flour', 'yeast', 'gelatin', 'baking powder', 'baking soda', 'cornstarch', 'starch',
];

// GRIS role-text keywords that denote a structural/critical function
const STRUCTURAL_ROLE_KEYWORDS = [
  'ساختار', 'بالابر', 'ور آمدن', 'وَر آمدن', 'پف', 'چسب', 'بایندر', 'binder', 'انعقاد', 'لخته',
  'امولسیون', 'emulsif', 'ژل', 'leaven', 'structure', 'پایهٔ خمیر', 'قوام',
];

/**
 * isStructural — true when removing this ingredient is likely to break the recipe. Checks the
 * ingredient name and (optionally) its GRIS role text. Conservative substring matching on normalized
 * Persian/Latin text.
 */
export function isStructural(name = '', role = '') {
  const n = norm(name);
  const r = norm(role);
  if (n && STRUCTURAL_NAMES.some((k) => n.includes(norm(k)))) return true;
  if (r && STRUCTURAL_ROLE_KEYWORDS.some((k) => r.includes(norm(k)))) return true;
  return false;
}
