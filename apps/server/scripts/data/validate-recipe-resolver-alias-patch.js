/**
 * Validation for the Recipe Resolver Alias Patch 00 ingredient dictionary.
 *
 * Verifies the ACTIVE array file against the expected safety metrics by computing them
 * from the real data, and independently checks identity/nutrition integrity by diffing
 * against the archived previous dictionary. Cross-references the package validation report.
 *
 * This validates only; it never mutates data. Exits non-zero (and prints FAIL lines) if any
 * check does not match expectation, so callers can stop. No new ingredients, no nutrition edits.
 *
 * Run: node apps/server/scripts/data/validate-recipe-resolver-alias-patch.js
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../../..');
const DICT_DIR = path.join(ROOT, 'data/ingredients/phase-one-final/Ingredient Dictionary');
const ARCHIVE_DIR = path.join(
  ROOT,
  'data/ingredients/phase-one-final/archive/previous-before-recipe-resolver-alias-patch-00',
);
const VALIDATION_REPORT = path.join(
  ROOT,
  'data/ingredients/phase-one-final/Validation Report/validation_report_recipe_resolver_alias_patch_00.json',
);

const ACTIVE_ARRAY = path.join(
  DICT_DIR,
  'ingredients_verified_structure_resolver_ready_1008_only_recipe_resolver_alias_patch_00.json',
);
const ACTIVE_WRAPPER = path.join(
  DICT_DIR,
  'ingredient_dictionary_verified_structure_resolver_ready_1008_recipe_resolver_alias_patch_00.json',
);
const OLD_ARRAY = path.join(
  ARCHIVE_DIR,
  'ingredients_verified_structure_resolver_ready_1000_only_closeout_patch_02_1.json',
);

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const EXPECTED = {
  ingredientCount: 1008,
  duplicateIngredientId: 0,
  duplicateCode: 0,
  duplicateAliasOrRecipeAliasAcrossIngredients: 0,
  duplicateCommonTyposAcrossIngredients: 0,
  commonTypoAliasCollisionCount: 0,
  missingRecipeInputAliasesFaCount: 0,
  readyForRecipeImportTrueCount: 1008,
  readyForGeneralRecommendationTrueCount: 1008,
  readyForMealPlannerMvpTrueCount: 1008,
  readyForStrictDietPlanningTrueCount: 0,
  readyForMedicalNutritionClaimsTrueCount: 0,
  productionNutritionLock: false,
  newIngredientIdsCreated: 0,
  nutritionChanged: false,
};

const LANGS = ['fa', 'en', 'ar', 'tr', 'fr', 'de', 'es', 'it', 'ru', 'zh'];
const norm = (s) => (typeof s === 'string' ? s.trim() : '');

function perLanguageDuplicateAliases(arr) {
  // native per-language metric: an alias string appearing under >1 distinct ingredient WITHIN one language
  let dup = 0;
  for (const lang of LANGS) {
    const map = new Map();
    for (const ing of arr) {
      const fromRecipe = (ing.recipeInputAliases && ing.recipeInputAliases[lang]) || [];
      const fromAliases = lang === 'fa' && Array.isArray(ing.aliases) ? ing.aliases : [];
      for (const a of [...fromRecipe, ...fromAliases]) {
        const k = norm(a);
        if (!k) continue;
        if (!map.has(k)) map.set(k, new Set());
        map.get(k).add(String(ing.ingredientId));
      }
    }
    for (const ids of map.values()) if (ids.size > 1) dup += 1;
  }
  return dup;
}

function commonTypoMetrics(arr) {
  let dupTypos = 0;
  let typoAliasCollision = 0;
  for (const lang of LANGS) {
    const typoMap = new Map();
    const aliasOwner = new Map();
    for (const ing of arr) {
      const id = String(ing.ingredientId);
      const aliases = [
        ...(((ing.recipeInputAliases && ing.recipeInputAliases[lang]) || [])),
        ...(lang === 'fa' && Array.isArray(ing.aliases) ? ing.aliases : []),
      ];
      for (const a of aliases) {
        const k = norm(a);
        if (k && !aliasOwner.has(k)) aliasOwner.set(k, id);
      }
      const typos = (ing.commonTypos && (Array.isArray(ing.commonTypos) ? ing.commonTypos : ing.commonTypos[lang])) || [];
      for (const t of Array.isArray(typos) ? typos : []) {
        const k = norm(t);
        if (!k) continue;
        if (!typoMap.has(k)) typoMap.set(k, new Set());
        typoMap.get(k).add(id);
      }
    }
    for (const ids of typoMap.values()) if (ids.size > 1) dupTypos += 1;
    for (const [typo, ids] of typoMap.entries()) {
      const owner = aliasOwner.get(typo);
      if (owner && ![...ids].every((i) => i === owner)) typoAliasCollision += 1;
    }
  }
  return { dupTypos, typoAliasCollision };
}

function run() {
  const arr = readJson(ACTIVE_ARRAY);
  const wrapper = readJson(ACTIVE_WRAPPER);
  const fails = [];
  const computed = {};

  if (!Array.isArray(arr)) {
    console.error('FAIL: active dictionary is not an array.');
    process.exit(1);
  }

  computed.ingredientCount = arr.length;

  const ids = new Map();
  const codes = new Map();
  let missingFa = 0;
  const ready = {
    readyForRecipeImportTrueCount: 0,
    readyForGeneralRecommendationTrueCount: 0,
    readyForMealPlannerMvpTrueCount: 0,
    readyForStrictDietPlanningTrueCount: 0,
    readyForMedicalNutritionClaimsTrueCount: 0,
  };
  let sourceFoodIdLockedCount = 0;
  for (const ing of arr) {
    const id = String(ing.ingredientId);
    ids.set(id, (ids.get(id) || 0) + 1);
    codes.set(String(ing.code), (codes.get(String(ing.code)) || 0) + 1);
    const dq = ing.dataQuality || {};
    if (dq.readyForRecipeImport === true) ready.readyForRecipeImportTrueCount += 1;
    if (dq.readyForGeneralRecommendation === true) ready.readyForGeneralRecommendationTrueCount += 1;
    if (dq.readyForMealPlannerMvp === true) ready.readyForMealPlannerMvpTrueCount += 1;
    if (dq.readyForStrictDietPlanning === true) ready.readyForStrictDietPlanningTrueCount += 1;
    if (dq.readyForMedicalNutritionClaims === true) ready.readyForMedicalNutritionClaimsTrueCount += 1;
    if (dq.nutritionSourceLocked === true || dq.sourceFoodIdLocked === true) sourceFoodIdLockedCount += 1;
    const fa = ing.recipeInputAliases && ing.recipeInputAliases.fa;
    if (!Array.isArray(fa) || fa.length === 0) missingFa += 1;
  }
  computed.duplicateIngredientId = [...ids.values()].filter((c) => c > 1).length;
  computed.duplicateCode = [...codes.values()].filter((c) => c > 1).length;
  computed.missingRecipeInputAliasesFaCount = missingFa;
  Object.assign(computed, ready);
  computed.duplicateAliasOrRecipeAliasAcrossIngredients = perLanguageDuplicateAliases(arr);
  const typo = commonTypoMetrics(arr);
  computed.duplicateCommonTyposAcrossIngredients = typo.dupTypos;
  computed.commonTypoAliasCollisionCount = typo.typoAliasCollision;
  computed.productionNutritionLock =
    (wrapper.dictionaryStatus && wrapper.dictionaryStatus.productionNutritionLock) ?? null;

  // Identity / nutrition integrity vs the archived previous dictionary
  let oldArr = null;
  try {
    oldArr = readJson(OLD_ARRAY);
  } catch {
    console.warn('NOTE: archived previous dictionary not readable; id/nutrition diff skipped.');
  }
  if (Array.isArray(oldArr)) {
    const oldIds = new Set(oldArr.map((i) => String(i.ingredientId)));
    const oldNut = new Map(oldArr.map((i) => [String(i.ingredientId), JSON.stringify(i.nutritionPer100g ?? null)]));
    let newIds = 0;
    let nutritionChangedCount = 0;
    for (const ing of arr) {
      const id = String(ing.ingredientId);
      if (!oldIds.has(id)) newIds += 1;
      else if (oldNut.get(id) !== JSON.stringify(ing.nutritionPer100g ?? null)) nutritionChangedCount += 1;
    }
    computed.ingredientCountBefore = oldArr.length;
    computed.newIngredientIdsCreated = newIds;
    computed.nutritionChanged = nutritionChangedCount > 0;
    computed.nutritionChangedCount = nutritionChangedCount;
    computed.sourceFoodIdLockedCountBefore = oldArr.filter(
      (i) => (i.dataQuality || {}).nutritionSourceLocked === true || (i.dataQuality || {}).sourceFoodIdLocked === true,
    ).length;
  }
  computed.sourceFoodIdLockedCount = sourceFoodIdLockedCount;

  // Assertions vs EXPECTED
  for (const [k, exp] of Object.entries(EXPECTED)) {
    if (computed[k] !== exp) fails.push(`${k}: expected ${exp}, got ${computed[k]}`);
  }
  if (
    computed.ingredientCountBefore !== undefined &&
    computed.sourceFoodIdLockedCountBefore !== undefined &&
    computed.sourceFoodIdLockedCount !== computed.sourceFoodIdLockedCountBefore
  ) {
    fails.push(
      `sourceFoodIdLockedCount changed: before ${computed.sourceFoodIdLockedCountBefore}, after ${computed.sourceFoodIdLockedCount}`,
    );
  }

  // Cross-reference the package's own validation report (informational)
  let report = {};
  try {
    report = readJson(VALIDATION_REPORT);
  } catch {
    /* report optional */
  }

  console.log('=== computed-from-real-data ===');
  console.log(JSON.stringify(computed, null, 1));
  console.log('=== package validation_report (cross-ref) ===');
  console.log(
    JSON.stringify(
      {
        ingredientCount: report.ingredientCount,
        newIngredientIdsCreated: report.newIngredientIdsCreated,
        nutritionChanged: report.nutritionChanged,
        duplicateAliasOrRecipeAliasAcrossIngredients: report.duplicateAliasOrRecipeAliasAcrossIngredients,
        commonTypoAliasCollisionCount: report.commonTypoAliasCollisionCount,
        productionNutritionLock: report.productionNutritionLock,
      },
      null,
      1,
    ),
  );

  if (fails.length) {
    console.error('\nVALIDATION FAILED:');
    for (const f of fails) console.error('  - ' + f);
    process.exit(1);
  }
  console.log('\nVALIDATION PASSED: active dictionary matches all expected safety metrics.');
}

run();
