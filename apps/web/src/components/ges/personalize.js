// GES — deterministic personalization helpers shared by the recipe method section and Cook Mode.
//
// These derive the *displayed* recipe from the shared {servedFor, swaps, removed} layer without any
// fabrication: ingredient references in step text are best-effort rewritten, and a clear summary line
// states every change. Free-text step matching is imperfect by nature, so the summary banner — not the
// inline edit — is the honest, reliable signal of what was personalized.

import { toFaDigits } from './format';

// GRIS ingredient names carry their real dictionary id as a suffix, e.g.
// «گوشت گوسفند خام (خردشده) — ing_lamb_meat_raw». Split the human display from the grounding id so the
// UI shows a clean name and the server can resolve the exact ingredient.
const GRIS_ID = /\s*[—–-]\s*(ing_[a-z0-9_]+)\s*$/i;
export function parseGrisName(rawName) {
  const raw = String(rawName ?? '');
  const m = raw.match(GRIS_ID);
  return { display: (m ? raw.slice(0, m.index) : raw).trim(), ingredientId: m ? m[1] : null };
}

/**
 * stripGrisIds — defensive display hygiene for free-text GRIS fields (serveWith, swap notes, volume)
 * that may carry authoring leftovers: a raw dictionary id («برنج سفید با ing_basmati_rice_raw» →
 * «برنج سفید») or a source-correction note («… (اصلاح واحد منبع از «۲ قاشق»)» → «…»). Removes the «با
 * ing_xxx» phrase, any bare/suffix «ing_xxx» token, «(اصلاح …)» notes, then tidies stray parens/spaces.
 */
export function stripGrisIds(text) {
  return String(text ?? '')
    .replace(/\s*با\s+ing_[a-z0-9_]+/gi, '')
    .replace(/\s*[—–-]?\s*ing_[a-z0-9_]+/gi, '')
    .replace(/\s*\(\s*اصلاح[^)]*\)/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// prep-state / qualifier words that aren't part of an ingredient's core identity (so removing
// «گوشت گوسفند خام (خردشده)» still matches a step that just says «گوشت»).
const PREP_WORDS = new Set(['خام', 'تازه', 'خشک', 'پخته', 'له‌شده', 'آسیاب‌شده', 'ساییده', 'خردشده', 'رنده‌شده', 'کامل', 'متوسط', 'بزرگ', 'کوچک', 'ریز', 'درشت', 'شسته‌شده', 'نیم‌پز']);

/** core match terms for an ingredient name: full (parens stripped) + first-two-words + first word */
function coreTerms(name) {
  const base = String(name ?? '').replace(/\(.*?\)/g, '').replace(/\s*[—–-]\s*ing_[a-z0-9_]+/i, '').trim();
  if (!base) return [];
  const words = base.split(/\s+/).filter((w) => w.length >= 3 && !PREP_WORDS.has(w));
  const terms = new Set();
  if (base) terms.add(base);
  if (words.length >= 2) terms.add(`${words[0]} ${words[1]}`);
  if (words.length >= 1) terms.add(words[0]);
  return [...terms].filter((t) => t.length >= 3).sort((a, b) => b.length - a.length); // longest first
}

/** turn the personalization swaps map ({from:{to,...}}) into a [{from,to}] list */
export function swapsList(swaps = {}) {
  return Object.entries(swaps).map(([from, v]) => ({ from, to: v?.to })).filter((s) => s.from && s.to);
}

/**
 * patchStepText — best-effort inline rewrite of one step's text for the active swaps/removes, plus the
 * caveats that apply to it. Only rewrites when the exact source string appears; otherwise the summary
 * banner still tells the cook about the change. Never invents new instructions.
 */
export function patchStepText(text, swaps = [], removed = []) {
  let out = String(text ?? '');
  const caveats = [];
  let changed = false;
  // swaps: replace the longest matching core term of `from` (so a step that just says «گوشت» still
  // updates when «گوشت گوسفند خام (…)» is swapped) with the target name.
  for (const { from, to } of swaps) {
    if (!from || !to) continue;
    for (const term of coreTerms(from)) {
      if (out.includes(term)) { out = out.split(term).join(to); changed = true; break; }
    }
  }
  // removes: if any core term of the removed ingredient appears in the step, add a «بدون X» caveat
  // (so «گوشت را تفت دهید» picks up «بدون گوشت» after the meat is removed).
  for (const name of removed) {
    if (!name) continue;
    for (const term of coreTerms(name)) {
      if (out.includes(term)) { caveats.push(`بدون ${term}`); changed = true; break; }
    }
  }
  return { text: out, caveats, changed };
}

/**
 * personalizationSummary — a short, human list of what the user changed, for the banner above the steps.
 * Returns [] when nothing is personalized.
 */
export function personalizationSummary({ servedFor = null, swaps = {}, removed = [] } = {}) {
  const out = [];
  if (servedFor) out.push(`${toFaDigits(servedFor)} نفر`);
  for (const { from, to } of swapsList(swaps)) out.push(`${from} ← ${to}`);
  for (const name of removed) out.push(`بدون ${name}`);
  return out;
}
