/**
 * E11 resolver calibration (dev-only, throwaway analysis). Read-only.
 * Confirms normalize() reproduces the registry's canonical `normalized` form
 * (idempotent on every key) and measures coverage on real ingredient names.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const REG = path.join(ROOT, 'data/ingredients/phase-one-final/Registry/normalized_alias_registry.json');
const DICT = path.join(ROOT, 'data/ingredients/phase-one-final/Ingredient Dictionary/ingredients_verified_structure_resolver_ready_1000_only_closeout_patch_02_1.json');

function normalize(input) {
  if (input == null) return '';
  return String(input)
    .normalize('NFKC')
    .replace(/[ً-ْٰ]/g, '') // harakat / tashkeel / superscript alef
    .replace(/ـ/g, '') // tatweel
    .replace(/[​-‏‪-‮]/g, '') // ZWSP/ZWNJ/ZWJ + bidi marks
    .replace(/ي/g, 'ی') // arabic yeh -> persian yeh (preserve alef-maksura ى)
    .replace(/ك/g, 'ک') // arabic kaf -> persian kaf
    .replace(/[أإ]/g, 'ا') // hamza-alef -> bare alef (preserve madda آ)
    .replace(/ة/g, 'ه') // teh marbuta -> heh
    // NB: registry PRESERVES hamza forms (ئ, ؤ) — do NOT fold them, or we
    // diverge from the canonical `normalized` keys (verified by calibration).
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)) // persian digits
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)) // arabic digits
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const registry = JSON.parse(fs.readFileSync(REG, 'utf8'));
const dict = JSON.parse(fs.readFileSync(DICT, 'utf8'));

let idem = 0;
const nonIdem = [];
for (const e of registry) {
  if (normalize(e.normalized) === e.normalized) idem++;
  else if (nonIdem.length < 8) nonIdem.push({ key: e.normalized, got: normalize(e.normalized) });
}

const aliasMap = new Map();
for (const e of registry) {
  const id = Array.isArray(e.ingredientIds) ? e.ingredientIds[0] : e.ingredientIds;
  if (id) aliasMap.set(normalize(e.normalized), id);
}

function text(v) {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return v.canonical || v.fa || v.en || null;
  return String(v);
}

const nameToId = new Map();
for (const ing of dict) {
  const fa = text((ing.names || {}).fa);
  const en = text((ing.names || {}).en);
  if (fa) nameToId.set(normalize(fa), String(ing.ingredientId));
  if (en) nameToId.set(normalize(en), String(ing.ingredientId));
}

let nameTotal = 0;
let aliasHit = 0;
let combinedHit = 0;
const miss = [];
for (const ing of dict) {
  const fa = text((ing.names || {}).fa);
  if (!fa) continue;
  nameTotal++;
  const key = normalize(fa);
  const id = String(ing.ingredientId);
  if (aliasMap.get(key) === id) aliasHit++;
  if (aliasMap.get(key) === id || nameToId.get(key) === id) combinedHit++;
  else if (miss.length < 10) miss.push({ id, fa, key });
}

console.log(JSON.stringify({
  registryEntries: registry.length,
  uniqueAliasKeys: aliasMap.size,
  keyIdempotent: idem,
  keyIdempotentPct: +((idem / registry.length) * 100).toFixed(2),
  nonIdempotentSamples: nonIdem,
  ingredientNamesFa: nameTotal,
  aliasMapResolvesNamePct: +((aliasHit / nameTotal) * 100).toFixed(2),
  combinedAliasPlusNameCoveragePct: +((combinedHit / nameTotal) * 100).toFixed(2),
  missSamples: miss,
}, null, 2));
