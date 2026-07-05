import { isStructural } from './ingredientRoles';

const norm = (value) => String(value ?? '').replace(/[‌‍]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

const IDENTITY_WORDS = [
  'نعناع', 'لیمو', 'زیتون', 'فتا', 'لبنه', 'زعتر', 'گردو', 'رب انار', 'تخم مرغ', 'موزارلا',
  'هالومی', 'نخود', 'سیب زمینی', 'قارچ', 'کیمچی', 'گوچوجانگ', 'ارده', 'سماق', 'توفو',
  'mint', 'lime', 'lemon', 'olive', 'feta', 'labneh', 'zaatar', 'walnut', 'egg', 'mozzarella',
  'halloumi', 'chickpea', 'potato', 'mushroom', 'kimchi', 'gochujang', 'tahini', 'sumac', 'tofu',
];

const OPTIONAL_WORDS = ['گارنیش', 'تزئین', 'روی', 'رومال', 'اختیاری', 'پاشیدن', 'garnish', 'optional', 'topping'];

const CRITICAL_ROLE_WORDS = [
  'پایه', 'اصلی', 'هویت', 'امضایی', 'ساختار', 'بافت', 'binding', 'base', 'main', 'signature',
  'main_protein', 'main_vegetable', 'signature_herb', 'signature_spice', 'signature_acid',
  'signature_sauce', 'liquid_base', 'thickener', 'dairy', 'cheese',
];

export function ingredientSafetyMeta(ingredient = {}) {
  const name = norm(ingredient.displayName || ingredient.name);
  const role = norm(ingredient.role);
  const prep = norm(ingredient.prepState);
  const explicitCritical = ingredient.identityCritical === true;
  const optional = ingredient.optional === true || OPTIONAL_WORDS.some((word) => role.includes(norm(word)) || prep.includes(norm(word)));
  const roleCritical = CRITICAL_ROLE_WORDS.some((word) => role.includes(norm(word)));
  const nameCritical = IDENTITY_WORDS.some((word) => name.includes(norm(word)));
  const structural = isStructural(name, role);
  const identityCritical = !optional && (explicitCritical || roleCritical || nameCritical || structural);
  const canRemove = optional && !structural && ingredient.canRemove !== false;
  const isReplaceable = !identityCritical && !structural && Array.isArray(ingredient.replacementCandidates) && ingredient.replacementCandidates.length > 0;
  const removalImpact = identityCritical ? 'breaks_identity' : structural ? 'breaks_structure' : optional ? 'changes_flavor' : 'changes_flavor';
  return {
    identityCritical,
    isEssential: identityCritical || structural || !optional,
    canRemove,
    isReplaceable,
    removalImpact,
    removalMessage: canRemove
      ? 'با حذف این ماده، طعم یا بافت کمی تغییر می‌کند.'
      : 'این ماده برای هویت این دستور ضروری است و قابل حذف نیست.',
    replacementCandidates: isReplaceable ? ingredient.replacementCandidates : [],
    replacementReason: isReplaceable ? ingredient.replacementReason || 'جایگزین هم‌نقش و کم‌ریسک' : 'جایگزین مطمئن ندارد',
    replacementWarning: isReplaceable ? '' : 'جایگزین مطمئن ندارد',
  };
}
