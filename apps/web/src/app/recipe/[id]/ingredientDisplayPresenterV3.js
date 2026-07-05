import { presentIngredientSections } from './ingredientDisplayPresenter.js';
import { getIngredientIconKey } from './ingredientIconMap.js';
import { getIngredientEditGuard } from './ingredientEditGuard.js';

const PREP_DASH = /\s+[—–-]\s+/;
const INTERNAL_PATTERN = /\b(ing_[a-z0-9_]+|ingredientId|recipeId|gris|debug|database|import)\b/i;

const normalize = (value) => String(value ?? '')
  .replace(/\u200c/g, ' ')
  .replace(/[ي]/g, 'ی')
  .replace(/[ك]/g, 'ک')
  .replace(/\s+/g, ' ')
  .trim();

const stripInternal = (value) => normalize(value)
  .replace(/\s*با\s+ing_[a-z0-9_]+/gi, '')
  .replace(/\s*[—–-]?\s*ing_[a-z0-9_]+/gi, '')
  .replace(/\b(ingredientId|recipeId|gris|debug|database|import)\b/gi, '')
  .replace(/\s{2,}/g, ' ')
  .trim();

export function splitIngredientTitle(value) {
  const clean = stripInternal(value);
  const [title, ...rest] = clean.split(PREP_DASH).map((part) => part.trim()).filter(Boolean);
  return {
    titleFa: title || clean,
    appendedPreparation: rest.join(' - '),
  };
}

function firstClean(...values) {
  return values.map(stripInternal).find(Boolean) || '';
}

function shortFallbackRole(raw) {
  const firstPhrase = stripInternal(raw)
    .split(/[.؟!؛،]/)[0]
    .split(/\s+و\s+/)[0]
    .trim();
  if (!firstPhrase) return '';
  return firstPhrase.length > 28 ? `${firstPhrase.slice(0, 27).trim()}…` : firstPhrase;
}

export function normalizeIngredientRole(raw = '') {
  const text = normalize(raw);
  if (!text || INTERNAL_PATTERN.test(text)) return '';
  const compact = text.replace(/\u200c/g, ' ');

  if (/پروتئین|گوشت|مرغ|ماهی|میگو|protein|meat|chicken|fish/i.test(compact)) return 'نقش: پروتئین اصلی';
  if (/پیاز|سیر|آروماتیک|پایه|base|aromatic/i.test(compact)) return 'نقش: پایهٔ طعم';
  if (/غلظت|لعاب|قوام|thicken/i.test(compact)) return 'نقش: غلظت‌دهنده';
  if (/چاشنی|ادویه|معطر|عطر|spice|season/i.test(compact)) return 'نقش: چاشنی معطر';
  if (/بافت|ترد|جویدنی|texture/i.test(compact)) return 'نقش: بافت‌دهنده';
  if (/رنگ|زعفران|color/i.test(compact)) return 'نقش: رنگ و عطر';
  if (/اسید|ترشی|لیمو|آبغوره|سرکه|acid|sour|vinegar|lemon/i.test(compact)) return 'نقش: تعادل ترشی';
  if (/شیرینی|شکر|عسل|sweet|sugar|honey/i.test(compact)) return 'نقش: شیرینی و تعادل';

  const fallback = shortFallbackRole(compact);
  return fallback ? `نقش: ${fallback}` : '';
}

function amountLabel(amountText) {
  const clean = stripInternal(amountText);
  return clean ? `مقدار: ${clean}` : '';
}

function preparationLabel(preparationText) {
  const clean = stripInternal(preparationText);
  return clean ? `حالت آماده‌سازی: ${clean}` : '';
}

function hasSafeSubstitution(source = {}) {
  return Boolean(
    (Array.isArray(source.swaps) && source.swaps.length)
    || (Array.isArray(source.replacementCandidates) && source.replacementCandidates.length)
    || source.swap
  );
}

export function presentIngredientSectionsV3(ingredients = [], { recipe = null } = {}) {
  const base = presentIngredientSections(ingredients);
  return {
    sections: base.sections.map((section) => ({
      title: section.title,
      items: section.items.map((item) => {
        const source = item.source || {};
        const split = splitIngredientTitle(item.name || source.displayName || source.name || source.title);
        const prep = firstClean(item.preparationText, split.appendedPreparation, source.preparation, source.prepState, source.prep);
        const role = normalizeIngredientRole(firstClean(source.role, item.detailText, source.buyTip, source.note, source.userNote));
        const guard = getIngredientEditGuard({ ...source, name: split.titleFa, displayName: split.titleFa }, recipe || {});
        const iconKey = getIngredientIconKey({ ...source, name: split.titleFa, displayName: split.titleFa });

        const row = {
          titleFa: split.titleFa,
          iconKey,
          amountLabel: amountLabel(item.amountText || source.amountText || source.volume),
          preparationLabel: preparationLabel(prep),
          roleLabel: role,
          isEssential: !guard.canRemoveDirectly,
          canSubstitute: hasSafeSubstitution(source) || guard.canSubstitute,
          canRemove: guard.canRemoveDirectly,
          groupLabel: section.title,
        };
        Object.defineProperty(row, 'source', {
          value: source,
          enumerable: false,
          configurable: false,
          writable: false,
        });
        return row;
      }),
    })),
  };
}

export const ingredientDisplayPresenterV3Internals = {
  normalize,
  stripInternal,
  amountLabel,
  preparationLabel,
};
