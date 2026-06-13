/**
 * PHASE_ONE_200_RECIPES validator (v0.6.1) — E39-adjacent controlled dev import.
 *
 * Validates the staged active 200 dataset against the canonical 1008 Ingredient Dictionary.
 * NOTE: written as plain JS (run via node) because `tsx` is not installed in this repo; this mirrors
 * the existing `apps/server/scripts/data/*.js` importer pattern (no new dependency). Pure read-only.
 *
 * Exports validate() → { ok, errors, warnings, gates, summary }. CLI: prints summary, exits 1 on failure.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../../..');
const ACTIVE = path.join(ROOT, 'data/recipes/active/recipes.fa.phase-one.200.json');
const WRAPPER = path.join(ROOT, 'data/recipes/active/recipes.fa.phase-one.200.wrapper.json');
const DICT = path.join(ROOT, 'data/ingredients/phase-one-final/Ingredient Dictionary/ingredients_verified_structure_resolver_ready_1008_only_recipe_resolver_alias_patch_00.json');

const REMOVED_SLUGS = ['faloodeh-shirazi', 'khoresh-chaghaleh-badam', 'ash-soraneh-kermanshahi'];
const REPLACEMENT_SLUGS = ['khoresh-sib', 'anar-polo-shirazi', 'tahandaz-morgh'];
const ALLOWED_MISSING_SEQ = [19, 138, 178, 195];
const FORBIDDEN_SEQ_FILL = 19;
const FORBIDDEN_REVIVE_SLUG = 'khoresh-kangar';
const INTERNAL_TERMS = ['garnish', 'dictionary', 'ingredientid', 'resolver', 'unresolved', 'batch', 'phase', 'import', 'metadata'];

function text(v, fb = '') {
  if (v == null) return fb;
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return v.fa || v.en || fb;
  return String(v);
}
function asArray(v) { return Array.isArray(v) ? v : v ? [v] : []; }

function validate() {
  const errors = [];
  const warnings = [];
  const gates = {};
  const fail = (key, cond, msg) => { gates[key] = !!cond; if (!cond) errors.push(msg); };

  // Dictionary presence is a hard STOP.
  if (!fs.existsSync(DICT)) {
    return { ok: false, errors: [`Ingredient dictionary MISSING: ${DICT} — STOP (do not validate against the wrong dictionary).`], warnings, gates, summary: {} };
  }
  if (!fs.existsSync(ACTIVE) || !fs.existsSync(WRAPPER)) {
    return { ok: false, errors: [`Active 200 dataset/wrapper missing (${ACTIVE} / ${WRAPPER}) — run staging first.`], warnings, gates, summary: {} };
  }

  const recipes = JSON.parse(fs.readFileSync(ACTIVE, 'utf8'));
  const wrapper = JSON.parse(fs.readFileSync(WRAPPER, 'utf8'));
  const dict = JSON.parse(fs.readFileSync(DICT, 'utf8'));

  const dictById = new Map(dict.map((d) => [String(d.ingredientId), d]));
  const dictCodes = new Set(dict.map((d) => String(d.code)));
  const dictIdCode = new Set(dict.map((d) => `${d.ingredientId}::${d.code}`));

  fail('mainArrayExists', Array.isArray(recipes), 'main recipes array missing');
  fail('wrapperExists', wrapper && typeof wrapper === 'object', 'wrapper missing');
  fail('recipeCount200', Array.isArray(recipes) && recipes.length === 200, `recipeCount != 200 (got ${recipes?.length})`);
  fail('wrapperRecipeCount200', wrapper.recipeCount === 200 && wrapper.meta?.recipeCount === 200, `wrapper/meta recipeCount != 200 (${wrapper.recipeCount}/${wrapper.meta?.recipeCount})`);

  // wrapper.recipes equals the main array (length + recipeId set)
  const arrIds = new Set((recipes || []).map((r) => String(r.recipeId)));
  const wrapIds = new Set(asArray(wrapper.recipes).map((r) => String(r.recipeId)));
  const sameSet = arrIds.size === wrapIds.size && [...arrIds].every((id) => wrapIds.has(id));
  fail('wrapperRecipesEqualsArray', asArray(wrapper.recipes).length === (recipes || []).length && sameSet, 'wrapper.recipes does not equal main array');

  // duplicates
  const dupCount = (vals) => { const seen = new Set(); let d = 0; for (const v of vals) { if (v == null || v === '') continue; if (seen.has(v)) d++; else seen.add(v); } return d; };
  const dupRecipeId = dupCount((recipes || []).map((r) => r.recipeId));
  const dupSlug = dupCount((recipes || []).map((r) => r.slug));
  const dupLegacy = dupCount((recipes || []).map((r) => r.legacyId).filter((x) => x != null));
  const dupTitleFa = dupCount((recipes || []).map((r) => text(r.title)));
  fail('duplicateRecipeId0', dupRecipeId === 0, `duplicate recipeId: ${dupRecipeId}`);
  fail('duplicateSlug0', dupSlug === 0, `duplicate slug: ${dupSlug}`);
  fail('duplicateLegacyId0', dupLegacy === 0, `duplicate legacyId: ${dupLegacy}`);
  fail('duplicateTitleFa0', dupTitleFa === 0, `duplicate title.fa: ${dupTitleFa}`);

  // phaseOneSequence
  const seqs = (recipes || []).map((r) => r.phaseOneSequence).filter((s) => Number.isFinite(Number(s))).map(Number);
  fail('phaseOneSequenceCount200', seqs.length === 200, `phaseOneSequence count != 200 (got ${seqs.length})`);
  const seqSet = new Set(seqs);
  const min = Math.min(...seqs), max = Math.max(...seqs);
  const missing = [];
  for (let i = min; i <= max; i++) if (!seqSet.has(i)) missing.push(i);
  const onlyAllowedMissing = missing.every((m) => ALLOWED_MISSING_SEQ.includes(m)) && ALLOWED_MISSING_SEQ.every((m) => missing.includes(m));
  fail('allowedMissingSeqOnly', onlyAllowedMissing, `missing sequences must be exactly ${ALLOWED_MISSING_SEQ.join(',')}; got ${missing.join(',')}`);
  fail('seq19NotFilled', !seqSet.has(FORBIDDEN_SEQ_FILL), 'sequence 19 must NOT be filled');

  // slugs
  const slugs = new Set((recipes || []).map((r) => r.slug));
  fail('khoreshKangarNotRevived', !slugs.has(FORBIDDEN_REVIVE_SLUG), 'khoresh-kangar must not be re-added');
  fail('removedRecipesAbsent', REMOVED_SLUGS.every((s) => !slugs.has(s)), `removed recipes must be absent: ${REMOVED_SLUGS.filter((s) => slugs.has(s)).join(',')}`);
  fail('replacementsPresent', REPLACEMENT_SLUGS.every((s) => slugs.has(s)), `replacements must be present: missing ${REPLACEMENT_SLUGS.filter((s) => !slugs.has(s)).join(',')}`);

  // unresolved ingredients + readyForImport
  let unresolved = 0, notReady = 0, medicalReady = 0, strictReady = 0;
  for (const r of recipes || []) {
    unresolved += asArray(r.unresolvedIngredients).length;
    if (r.quality?.readyForImport !== true) notReady++;
    if (r.quality?.readyForMedicalNutritionClaims === true) medicalReady++;
    if (r.quality?.readyForStrictDietPlanning === true) strictReady++;
  }
  fail('unresolvedIngredients0', unresolved === 0, `unresolved ingredients: ${unresolved}`);
  fail('readyForImportFalse0', notReady === 0, `readyForImport=false count: ${notReady}`);
  fail('noMedicalClaims', medicalReady === 0, `medical-nutrition-claim recipes: ${medicalReady}`);
  fail('noStrictDietPlanning', strictReady === 0, `strict-diet-planning recipes: ${strictReady}`);
  fail('nutritionPolicyNonMedical', wrapper.meta?.nutritionPolicy === 'estimated_not_medical' && wrapper.meta?.finalVerifiedNutrition === false && wrapper.meta?.strictDietOrMedicalUse === 'out_of_scope',
    `nutrition policy must be estimated_not_medical/out_of_scope (got ${wrapper.meta?.nutritionPolicy}/${wrapper.meta?.strictDietOrMedicalUse}/finalVerified=${wrapper.meta?.finalVerifiedNutrition})`);

  // ingredient integrity vs dictionary
  let lines = 0, invalidId = 0, invalidCode = 0, idCodeMismatch = 0, newIds = 0, missingLockedField = 0, stepNoInstruction = 0;
  const dsIngIds = new Set();
  for (const r of recipes || []) {
    for (const ing of asArray(r.ingredients)) {
      lines++;
      if (!ing.ingredientId || !ing.code || !ing.nameFa) missingLockedField++;
      if (!ing.ingredientId) { invalidId++; continue; }
      dsIngIds.add(String(ing.ingredientId));
      if (!dictById.has(String(ing.ingredientId))) { invalidId++; newIds++; continue; }
      if (!ing.code || !dictCodes.has(String(ing.code))) invalidCode++;
      if (ing.code && !dictIdCode.has(`${ing.ingredientId}::${ing.code}`)) idCodeMismatch++;
    }
    for (const st of asArray(r.steps)) if (!st.instruction || !String(st.instruction).trim()) stepNoInstruction++;
  }
  fail('invalidIngredientId0', invalidId === 0, `invalid ingredientId lines: ${invalidId}`);
  fail('invalidIngredientCode0', invalidCode === 0, `invalid ingredient code lines: ${invalidCode}`);
  fail('ingredientIdCodeMismatch0', idCodeMismatch === 0, `id/code mismatch lines: ${idCodeMismatch}`);
  fail('newIngredientIdsCreated0', newIds === 0 && (wrapper.meta?.newIngredientIdsCreated ?? 0) === 0, `new ingredient IDs: ${newIds}`);
  fail('ingredientLockedFieldsPresent', missingLockedField === 0, `ingredient lines missing locked fields (ingredientId/code/nameFa): ${missingLockedField}`);
  fail('stepsHaveInstruction', stepNoInstruction === 0, `steps without instruction: ${stepNoInstruction}`);

  // product-facing internal-term scan
  let internalHits = 0; const internalSamples = [];
  for (const r of recipes || []) {
    const productText = [
      text(r.title), text(r.summary), text(r.description),
      ...asArray(r.steps).map((s) => `${s.title || ''} ${s.instruction || ''} ${s.chefNote || ''}`),
      ...asArray(r.chefTips), ...asArray(r.servingSuggestions),
      ...asArray(r.faq).map((f) => `${text(f.q)} ${text(f.a)} ${f.question || ''} ${f.answer || ''}`),
    ].join(' \n ').toLowerCase();
    for (const term of INTERNAL_TERMS) {
      if (productText.includes(term)) { internalHits++; if (internalSamples.length < 5) internalSamples.push(`${r.slug}:${term}`); }
    }
  }
  fail('noProductFacingInternalTerms', internalHits === 0, `product-facing internal-term hits: ${internalHits} (${internalSamples.join(', ')})`);

  const summary = {
    recipeCount: (recipes || []).length,
    wrapperRecipeCount: wrapper.recipeCount,
    ingredientLines: lines,
    distinctIngredientIds: dsIngIds.size,
    dictionaryCount: dict.length,
    unresolved, notReady, dupRecipeId, dupSlug, dupLegacy, dupTitleFa,
    invalidId, invalidCode, idCodeMismatch, newIds, missingLockedField, stepNoInstruction,
    seqMin: min, seqMax: max, missingSeq: missing, internalHits,
  };
  return { ok: errors.length === 0, errors, warnings, gates, summary };
}

module.exports = { validate, ACTIVE, WRAPPER, DICT };

if (require.main === module) {
  const r = validate();
  console.log('=== PHASE_ONE_200 v0.6.1 VALIDATION ===');
  console.log('summary:', JSON.stringify(r.summary, null, 2));
  console.log('gates:', JSON.stringify(r.gates, null, 2));
  if (r.warnings.length) console.log('warnings:', r.warnings);
  if (r.ok) {
    console.log('RESULT: PASS');
    process.exit(0);
  } else {
    console.log('RESULT: FAIL');
    for (const e of r.errors) console.log(' -', e);
    process.exit(1);
  }
}
