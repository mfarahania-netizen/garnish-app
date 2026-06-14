/**
 * INTERNATIONAL_CORE_150 validator (v0.6.0) — DATA-RCP-I150 controlled dev import.
 *
 * Validates the international 150 draft-candidate package against the canonical 1008 Ingredient
 * Dictionary AND cross-checks the package's own final_import_readiness_report (the report is NOT
 * blindly trusted — every claimed count is recomputed from the parsed recipes and must match).
 *
 * Pure read-only. Plain JS (run via node) — mirrors the existing scripts/recipes/*.js importer pattern
 * (no new dependency; `tsx` is not installed). Exports validate() → { ok, errors, warnings, gates,
 * summary }. CLI: prints summary, exits 1 on failure.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../../..');
const PKG_DIR = path.join(ROOT, 'garnish_recipe_international_core_150_draft_candidate_v0_6_0');
const DICT = path.join(ROOT, 'data/ingredients/phase-one-final/Ingredient Dictionary/ingredients_verified_structure_resolver_ready_1008_only_recipe_resolver_alias_patch_00.json');

const MAIN_FILE = 'recipes.international.core-150.draft-candidate.v0.6.0.json';
const WRAPPER_FILE = 'recipes.international.core-150.draft-candidate.v0.6.0.wrapper.json';
const READINESS_FILE = 'final_import_readiness_report_international_core_150_v0.6.0.json';
const MANIFEST_FILE = 'international_core_150_merge_manifest_v0.6.0.json';

const REQUIRED_FILES = [
  MAIN_FILE,
  WRAPPER_FILE,
  MANIFEST_FILE,
  'international_core_150_batch_source_integrity_report_v0.6.0.json',
  'international_core_150_final_quota_report_v0.6.0.json',
  'duplicate_exclusion_report_against_v0.6.1_and_within_international_150_v0.6.0.json',
  'ingredient_resolver_report_international_core_150_v0.6.0.json',
  'allergen_consistency_report_international_core_150_v0.6.0.json',
  'diet_flag_consistency_report_international_core_150_v0.6.0.json',
  'template_copy_audit_report_international_core_150_v0.6.0.json',
  'internal_terms_audit_report_international_core_150_v0.6.0.json',
  'semantic_copy_audit_report_international_core_150_v0.6.0.json',
  'popularity_source_status_report_international_core_150_v0.6.0.json',
  READINESS_FILE,
];

const EXPECTED_COUNT = 150;
const SEQ_MIN = 205;
const SEQ_MAX = 354;
const FORBIDDEN_SLUG = 'lasagna-bolognese'; // rejected earlier; must never be reintroduced
const INTERNAL_TERMS = ['garnish', 'dictionary', 'ingredientid', 'resolver', 'unresolved', 'batch', 'phase', 'import', 'metadata'];

function text(v, fb = '') {
  if (v == null) return fb;
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return v.fa || v.en || fb;
  return String(v);
}
function asArray(v) { return Array.isArray(v) ? v : v ? [v] : []; }
function dupCount(vals) { const seen = new Set(); let d = 0; for (const v of vals) { if (v == null || v === '') continue; if (seen.has(v)) d++; else seen.add(v); } return d; }

function validate() {
  const errors = [];
  const warnings = [];
  const gates = {};
  const fail = (key, cond, msg) => { gates[key] = !!cond; if (!cond) errors.push(msg); };

  // ── presence (hard STOP) ──
  if (!fs.existsSync(DICT)) {
    return { ok: false, errors: [`Ingredient dictionary MISSING: ${DICT} — STOP.`], warnings, gates, summary: {} };
  }
  if (!fs.existsSync(PKG_DIR)) {
    return { ok: false, errors: [`Source folder MISSING: ${PKG_DIR} — STOP (BLOCKED).`], warnings, gates, summary: {} };
  }
  const missingFiles = REQUIRED_FILES.filter((f) => !fs.existsSync(path.join(PKG_DIR, f)));
  fail('allRequiredFilesPresent', missingFiles.length === 0, `missing package files: ${missingFiles.join(', ')}`);
  if (missingFiles.length) {
    return { ok: false, errors, warnings, gates, summary: { missingFiles } };
  }

  // ── parse ──
  let recipes, wrapper, readiness, manifest, dict;
  try { recipes = JSON.parse(fs.readFileSync(path.join(PKG_DIR, MAIN_FILE), 'utf8')); } catch (e) { errors.push(`main JSON invalid: ${e.message}`); }
  try { wrapper = JSON.parse(fs.readFileSync(path.join(PKG_DIR, WRAPPER_FILE), 'utf8')); } catch (e) { errors.push(`wrapper JSON invalid: ${e.message}`); }
  try { readiness = JSON.parse(fs.readFileSync(path.join(PKG_DIR, READINESS_FILE), 'utf8')); } catch (e) { errors.push(`readiness JSON invalid: ${e.message}`); }
  try { manifest = JSON.parse(fs.readFileSync(path.join(PKG_DIR, MANIFEST_FILE), 'utf8')); } catch (e) { errors.push(`manifest JSON invalid: ${e.message}`); }
  try { dict = JSON.parse(fs.readFileSync(DICT, 'utf8')); } catch (e) { errors.push(`dictionary JSON invalid: ${e.message}`); }
  if (errors.length) return { ok: false, errors, warnings, gates, summary: {} };

  const core = validatePackage({ recipes, wrapper, readiness, manifest, dict }, { errors, warnings, gates });
  return { ...core, recipes, wrapper, readiness };
}

/**
 * Pure validation core over already-parsed data (no file IO) — used by validate() and unit tests.
 */
function validatePackage({ recipes, wrapper, readiness, manifest, dict }, acc) {
  const errors = acc?.errors || [];
  const warnings = acc?.warnings || [];
  const gates = acc?.gates || {};
  const fail = (key, cond, msg) => { gates[key] = !!cond; if (!cond) errors.push(msg); };

  fail('mainArrayValid', Array.isArray(recipes), 'main recipes is not an array');
  fail('wrapperValid', wrapper && typeof wrapper === 'object', 'wrapper invalid');
  fail('readinessValid', readiness && typeof readiness === 'object', 'readiness report invalid');
  fail('manifestValid', manifest && typeof manifest === 'object', 'manifest invalid');
  if (!Array.isArray(recipes)) return { ok: false, errors, warnings, gates, summary: {} };

  const dictById = new Map(dict.map((d) => [String(d.ingredientId), d]));
  const dictCodes = new Set(dict.map((d) => String(d.code)));
  const dictIdCode = new Set(dict.map((d) => `${d.ingredientId}::${d.code}`));

  // ── count / wrapper equality ──
  fail('recipeCount150', recipes.length === EXPECTED_COUNT, `recipeCount != ${EXPECTED_COUNT} (got ${recipes.length})`);
  fail('wrapperRecipeCount150', wrapper.recipeCount === EXPECTED_COUNT, `wrapper.recipeCount != ${EXPECTED_COUNT} (got ${wrapper.recipeCount})`);
  const arrIds = (recipes).map((r) => String(r.recipeId));
  const wrapArr = asArray(wrapper.recipes);
  const arrIdSet = new Set(arrIds);
  const wrapIdSet = new Set(wrapArr.map((r) => String(r.recipeId)));
  const wrapperEquals = wrapArr.length === recipes.length && arrIdSet.size === wrapIdSet.size && [...arrIdSet].every((id) => wrapIdSet.has(id));
  fail('wrapperRecipesEqualsArray', wrapperEquals, 'wrapper.recipes does not equal main array');

  // ── sequence (205..354 fully contiguous) ──
  const seqs = recipes.map((r) => Number(r.phaseOneSequence)).filter((n) => Number.isFinite(n));
  fail('sequenceCount150', seqs.length === EXPECTED_COUNT, `phaseOneSequence count != ${EXPECTED_COUNT} (got ${seqs.length})`);
  const seqSet = new Set(seqs);
  const seqMin = seqs.length ? Math.min(...seqs) : null;
  const seqMax = seqs.length ? Math.max(...seqs) : null;
  fail('sequenceRangeExact', seqMin === SEQ_MIN && seqMax === SEQ_MAX, `sequence range must be [${SEQ_MIN},${SEQ_MAX}]; got [${seqMin},${seqMax}]`);
  const missingSeq = [];
  for (let i = SEQ_MIN; i <= SEQ_MAX; i++) if (!seqSet.has(i)) missingSeq.push(i);
  fail('sequenceContiguous', missingSeq.length === 0, `missing/non-contiguous sequences: ${missingSeq.slice(0, 20).join(',')}`);
  fail('sequenceNoDuplicate', dupCount(seqs) === 0, `duplicate sequence numbers: ${dupCount(seqs)}`);

  // ── identity duplicates within 150 ──
  const dupRecipeId = dupCount(recipes.map((r) => r.recipeId));
  const dupSlug = dupCount(recipes.map((r) => r.slug));
  const dupLegacy = dupCount(recipes.map((r) => r.legacyId).filter((x) => x != null));
  const dupTitleFa = dupCount(recipes.map((r) => text(r.title)));
  fail('duplicateRecipeId0', dupRecipeId === 0, `duplicate recipeId within 150: ${dupRecipeId}`);
  fail('duplicateSlug0', dupSlug === 0, `duplicate slug within 150: ${dupSlug}`);
  fail('duplicateLegacyId0', dupLegacy === 0, `duplicate legacyId within 150: ${dupLegacy}`);
  fail('duplicateTitleFa0', dupTitleFa === 0, `duplicate title.fa within 150: ${dupTitleFa}`);
  const slugSet = new Set(recipes.map((r) => r.slug));
  fail('forbiddenSlugAbsent', !slugSet.has(FORBIDDEN_SLUG), `forbidden slug present: ${FORBIDDEN_SLUG}`);

  // ── per-recipe required fields + ingredient integrity + steps + flags ──
  let lines = 0, invalidId = 0, invalidCode = 0, idCodeMismatch = 0, newIds = 0, missingLockedField = 0;
  let unresolved = 0, notReady = 0, medicalReady = 0, strictReady = 0, stepNoInstruction = 0, missingTitleFa = 0, noIngredients = 0;
  const dsIngIds = new Set();
  for (const r of recipes) {
    if (!r.recipeId) errors.push(`recipe missing recipeId: ${r.slug || 'unknown'}`);
    if (!r.slug) errors.push(`recipe ${r.recipeId} missing slug`);
    if (!text(r.title)) missingTitleFa++;
    if (!Array.isArray(r.ingredients) || r.ingredients.length === 0) noIngredients++;
    unresolved += asArray(r.unresolvedIngredients).length;
    if (r.quality?.readyForImport !== true) notReady++;
    if (r.quality?.readyForMedicalNutritionClaims === true) medicalReady++;
    if (r.quality?.readyForStrictDietPlanning === true) strictReady++;
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
  fail('titleFaPresent', missingTitleFa === 0, `recipes missing title.fa: ${missingTitleFa}`);
  fail('ingredientsPresent', noIngredients === 0, `recipes with no ingredients: ${noIngredients}`);
  fail('invalidIngredientId0', invalidId === 0, `invalid ingredientId lines: ${invalidId}`);
  fail('invalidIngredientCode0', invalidCode === 0, `invalid ingredient code lines: ${invalidCode}`);
  fail('ingredientIdCodeMismatch0', idCodeMismatch === 0, `id/code mismatch lines: ${idCodeMismatch}`);
  fail('newIngredientIdsCreated0', newIds === 0, `new ingredient IDs required: ${newIds}`);
  fail('ingredientLockedFieldsPresent', missingLockedField === 0, `ingredient lines missing ingredientId/code/nameFa: ${missingLockedField}`);
  fail('unresolvedIngredients0', unresolved === 0, `unresolved ingredients: ${unresolved}`);
  fail('stepsHaveInstruction', stepNoInstruction === 0, `steps without instruction: ${stepNoInstruction}`);
  fail('readyForImportAll150', notReady === 0, `readyForImport=false count: ${notReady}`);
  fail('noMedicalClaims', medicalReady === 0, `medical-nutrition-claim recipes: ${medicalReady}`);
  fail('noStrictDietPlanning', strictReady === 0, `strict-diet-planning recipes: ${strictReady}`);

  // ── product-facing internal-term scan ──
  let internalHits = 0; const internalSamples = [];
  for (const r of recipes) {
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

  // ── readiness report cross-check (recompute reality; report must NOT contradict) ──
  const claim = readiness || {};
  const xcheck = (key, claimVal, realVal) => fail(`report_${key}`, claimVal === realVal, `readiness report ${key}=${claimVal} contradicts parsed ${realVal}`);
  xcheck('recipeCount', claim.recipeCount, recipes.length);
  // cross-check the report's claimed range against the PARSED range (not against constants), so a report
  // that echoes [205,354] while the data drifted would still be caught.
  fail('report_sequenceRange', Array.isArray(claim.sequenceRange) && claim.sequenceRange[0] === seqMin && claim.sequenceRange[1] === seqMax, `readiness sequenceRange ${JSON.stringify(claim.sequenceRange)} != parsed [${seqMin},${seqMax}]`);
  xcheck('sequenceContiguous', claim.sequenceContiguous, missingSeq.length === 0);
  xcheck('duplicateRecipeId', claim.duplicateRecipeId, dupRecipeId);
  xcheck('duplicateSlug', claim.duplicateSlug, dupSlug);
  xcheck('duplicateLegacyId', claim.duplicateLegacyId, dupLegacy);
  xcheck('duplicateTitleFa', claim.duplicateTitleFa, dupTitleFa);
  xcheck('invalidIngredientId', claim.invalidIngredientId, invalidId);
  xcheck('invalidIngredientCode', claim.invalidIngredientCode, invalidCode);
  xcheck('ingredientIdCodeMismatch', claim.ingredientIdCodeMismatch, idCodeMismatch);
  xcheck('newIngredientIdsCreated', claim.newIngredientIdsCreated, newIds);
  xcheck('unresolvedIngredientCount', claim.unresolvedIngredientCount, unresolved);
  xcheck('readyForImportTrueCount', claim.readyForImportTrueCount, recipes.length - notReady);
  xcheck('readyForImportFalseCount', claim.readyForImportFalseCount, notReady);
  xcheck('readyForMedicalNutritionClaimsTrueCount', claim.readyForMedicalNutritionClaimsTrueCount, medicalReady);
  xcheck('readyForStrictDietPlanningTrueCount', claim.readyForStrictDietPlanningTrueCount, strictReady);
  xcheck('wrapperRecipesEqualsArray', claim.wrapperRecipesEqualsArray, wrapperEquals);
  fail('report_finalQuotaMatchesTarget150', claim.finalQuotaMatchesTarget150 === true, 'readiness finalQuotaMatchesTarget150 != true');
  fail('report_nutritionPolicyNonMedical', claim.nutritionPolicy === 'estimated_not_medical', `readiness nutritionPolicy != estimated_not_medical (${claim.nutritionPolicy})`);
  fail('report_medicalNutritionClaimHits0', (claim.medicalNutritionClaimHits ?? 0) === 0, `readiness medicalNutritionClaimHits != 0`);

  // ── manifest sanity ──
  fail('manifest_recipeCount150', manifest.recipeCount === EXPECTED_COUNT, `manifest.recipeCount != ${EXPECTED_COUNT} (${manifest.recipeCount})`);

  const summary = {
    recipeCount: recipes.length,
    wrapperRecipeCount: wrapper.recipeCount,
    seqMin, seqMax, missingSeqCount: missingSeq.length,
    ingredientLines: lines, distinctIngredientIds: dsIngIds.size, dictionaryCount: dict.length,
    dupRecipeId, dupSlug, dupLegacy, dupTitleFa,
    invalidId, invalidCode, idCodeMismatch, newIds, missingLockedField,
    unresolved, notReady, medicalReady, strictReady, stepNoInstruction, internalHits,
    forbiddenSlugPresent: slugSet.has(FORBIDDEN_SLUG),
  };
  return { ok: errors.length === 0, errors, warnings, gates, summary };
}

module.exports = { validate, validatePackage, PKG_DIR, DICT, MAIN_FILE, WRAPPER_FILE, REQUIRED_FILES, EXPECTED_COUNT, SEQ_MIN, SEQ_MAX, FORBIDDEN_SLUG };

if (require.main === module) {
  const r = validate();
  console.log('=== INTERNATIONAL_CORE_150 v0.6.0 VALIDATION ===');
  console.log('summary:', JSON.stringify(r.summary, null, 2));
  if (r.warnings.length) console.log('warnings:', r.warnings);
  if (r.ok) { console.log('RESULT: PASS'); process.exit(0); }
  console.log('RESULT: FAIL');
  for (const e of r.errors) console.log(' -', e);
  process.exit(1);
}
