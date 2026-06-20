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
 * stripGrisIds — defensive display hygiene for free-text GRIS fields (serveWith, swap notes) that may
 * embed a raw dictionary id, e.g. «برنج سفید با ing_basmati_rice_raw» → «برنج سفید». Removes the «با
 * ing_xxx» phrase and any bare/suffix «ing_xxx» token, then tidies stray parens/spaces.
 */
export function stripGrisIds(text) {
  return String(text ?? '')
    .replace(/\s*با\s+ing_[a-z0-9_]+/gi, '')
    .replace(/\s*[—–-]?\s*ing_[a-z0-9_]+/gi, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
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
  for (const { from, to } of swaps) {
    if (from && to && out.includes(from)) { out = out.split(from).join(to); changed = true; }
  }
  for (const name of removed) {
    if (name && out.includes(name)) { caveats.push(`بدون ${name}`); changed = true; }
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
