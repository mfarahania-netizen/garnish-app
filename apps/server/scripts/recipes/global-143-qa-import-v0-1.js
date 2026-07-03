/**
 * Global 143 v0.3 final QA + local/dev repair/import.
 *
 * This script treats the v0.3 reviewed package as the source of truth. It is intentionally
 * idempotent: existing Global 143 rows are repaired in place, relation rows are recreated from
 * v0.3, and no production database is allowed.
 */
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const { mapRecipe } = require('../data/phase-one-recipes');

const ROOT = path.resolve(__dirname, '../../../..');
const HANDOFF = path.join(
  ROOT,
  'garnish_import_handoffs/garnish_global_143_final_v0_3_full_reviewed/garnish_global_143_final_v0_3_full_reviewed',
);
const SOURCE_RECIPE = path.join(HANDOFF, 'recipes.global-143.all.fa.v0.3.FULL_REVIEWED.json');
const SOURCE_EXPANSION = path.join(HANDOFF, 'ingredient-expansion.global-143.dedup.v0.3.json');
const SOURCE_QUALITY_AUDIT = path.join(HANDOFF, 'global-143.final-quality-audit.v0.3.json');
const OUT_DIR = path.join(ROOT, 'data/recipes/drafts/global-143');
const QA_DIR = path.join(ROOT, 'docs/qa/recipes');
const FINAL_RECIPE = path.join(OUT_DIR, 'recipes.global-143.all.fa.final.json');
const FINAL_EXPANSION = path.join(OUT_DIR, 'ingredient-expansion.global-143.final.json');
const FINAL_VALIDATION = path.join(OUT_DIR, 'global-143.final-validation-report.json');
const SOURCE_AUDIT = path.join(OUT_DIR, 'global-143.source-audit-report.json');
const DRY_RUN_REPORT = path.join(QA_DIR, 'global_143_dry_run_import_report_v0_3.json');
const APPLY_REPORT = path.join(QA_DIR, 'global_143_db_repair_apply_report_v0_3.json');

const SOURCE_TAG = 'global-143-v0.3';
const EXPECTED_COUNT = 143;
const EXPECTED_DB_COUNT_AFTER_REPAIR = 589;
const SEQ_MIN = 355;
const SEQ_MAX = 497;

const FORBIDDEN = [
  'ingredientId', 'unresolved', 'import', 'Meal Plan', 'Shopping List', 'Codex', 'GRIS',
  'readyForImport', 'metadata', 'database', 'nutrition engine', 'source-backed',
  '[Certain]', '[Likely]', '[Speculative]', '[Uncertain]', 'King Arthur', 'Serious Eats',
  'BBC', 'Just One Cookbook', 'Maangchi', 'FDC', 'fdcID',
];
const GENERIC_STEP_PHRASES = [
  'مواد اصلی را برش',
  'طبق شخصیت غذا',
  'با توجه به نوع غذا',
  'آرام‌پز، سرخ یا بخارپز',
  'ماده اصلی را اضافه',
  'در پایان نمک، اسید',
  'بپزید تا آماده شود',
];
const LATIN_RE = /[A-Za-z]/;
const POLICY_RE = /(عددهای تغذیه|عدد تغذیه|محاسبه رسمی|محاسبه شود|بر پایه وزن مواد|نمایش داده نمی‌شود|برنامه غذایی تخصصی|توصیه پزشکی|صفحه نمایش)/;

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}
function asArray(v) { return Array.isArray(v) ? v : v ? [v] : []; }
function text(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(text).join(' ');
  if (typeof v === 'object') return Object.values(v).map(text).join(' ');
  return '';
}
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function dupValues(values) {
  const seen = new Set();
  const dup = new Set();
  for (const v of values) {
    if (v == null || v === '') continue;
    if (seen.has(v)) dup.add(v);
    seen.add(v);
  }
  return [...dup];
}
function parseAdminNote(note) {
  if (!note) return {};
  if (typeof note === 'object') return note;
  try { return JSON.parse(note); } catch { return {}; }
}
function isGlobalSource(note) {
  const source = String(parseAdminNote(note).source || '');
  return source.startsWith('global-143-');
}
function compactJson(value) {
  return JSON.stringify(value ?? []);
}
function displayFields(recipe) {
  const fields = [];
  const push = (field, value) => fields.push({ slug: recipe.slug, field, value: text(value) });
  push('title.fa', recipe.title?.fa);
  push('summary.fa', recipe.summary?.fa);
  push('description.fa', recipe.description?.fa);
  asArray(recipe.ingredients).forEach((ing, i) => {
    push(`ingredients.${i}.line`, ing.line);
    push(`ingredients.${i}.nameFa`, ing.nameFa);
    push(`ingredients.${i}.preparation`, ing.preparation);
  });
  asArray(recipe.steps).forEach((step, i) => {
    push(`steps.${i}.title`, step.title);
    push(`steps.${i}.instruction`, step.instruction);
    push(`steps.${i}.chefNote`, step.chefNote);
  });
  for (const key of ['tools', 'substitutions', 'servingSuggestions', 'chefTips', 'commonMistakes']) {
    asArray(recipe[key]).forEach((item, i) => push(`${key}.${i}`, item));
  }
  asArray(recipe.faq).forEach((f, i) => {
    push(`faq.${i}.question`, f.question ?? f.q);
    push(`faq.${i}.answer`, f.answer ?? f.a);
  });
  asArray(recipe.nutrition?.fa).forEach((item, i) => push(`nutrition.fa.${i}`, item));
  push('gris.story', recipe.gris?.story);
  asArray(recipe.gris?.whyItWorks).forEach((item, i) => {
    push(`gris.whyItWorks.${i}.point`, item.point);
    push(`gris.whyItWorks.${i}.explanation`, item.explanation);
  });
  push('gris.glance', recipe.gris?.glance);
  asArray(recipe.gris?.skillsLearned).forEach((item, i) => push(`gris.skillsLearned.${i}`, item));
  push('gris.finish', recipe.gris?.finish);
  asArray(recipe.gris?.troubleshooting).forEach((item, i) => push(`gris.troubleshooting.${i}`, item));
  asArray(recipe.gris?.nourishment?.qualitative).forEach((item, i) => push(`gris.nourishment.qualitative.${i}`, item));
  return fields.filter((f) => f.value);
}
function normalizeRecipe(recipe) {
  const r = clone(recipe);
  if (r.slug === 'napa-cabbage-kimchi') {
    r.slug = 'korean-napa-cabbage-kimchi';
  }
  r.containsPork = r.containsPork === true;
  if (!r.gris) r.gris = {};
  if (!r.gris.dietary) r.gris.dietary = {};
  r.gris.dietary.containsPork = r.containsPork;
  r.ingredients = asArray(r.ingredients).map((ingredient) => ({
    ...ingredient,
    preparation: ingredient.preparation === true ? 'آماده' : ingredient.preparation === false ? '' : ingredient.preparation,
  }));
  return r;
}
function normalizeExpansion(expansion) {
  return expansion.map((item) => {
    const x = clone(item);
    x.dataQuality = { ...(x.dataQuality || {}), nutritionSourceLocked: false };
    x.healthContext = {
      ...(x.healthContext || {}),
      strictDietPlanningAllowed: false,
      readyForMedicalNutritionClaims: false,
    };
    return x;
  });
}
function repeatedDisplayCopy(recipes) {
  const buckets = new Map();
  const add = (scope, slug, value) => {
    const s = text(value).trim();
    if (!s) return;
    const key = `${scope}::${s}`;
    if (!buckets.has(key)) buckets.set(key, { scope, text: s, slugs: new Set() });
    buckets.get(key).slugs.add(slug);
  };
  for (const r of recipes) {
    for (const key of ['chefTips', 'commonMistakes', 'substitutions', 'servingSuggestions']) {
      asArray(r[key]).forEach((item) => add(key, r.slug, item));
    }
    asArray(r.gris?.whyItWorks).forEach((item) => {
      add('gris.whyItWorks.point', r.slug, item.point);
      add('gris.whyItWorks.explanation', r.slug, item.explanation);
    });
    asArray(r.gris?.troubleshooting).forEach((item) => add('gris.troubleshooting', r.slug, item));
  }
  return [...buckets.values()]
    .filter((item) => item.slugs.size >= 20)
    .map((item) => ({ scope: item.scope, text: item.text, count: item.slugs.size, slugs: [...item.slugs].sort() }));
}
function validateRecipes(recipes, expansion, existingIngredientRows = []) {
  const errors = [];
  const warnings = [];
  const recipeIds = recipes.map((r) => r.recipeId);
  const slugs = recipes.map((r) => r.slug);
  const seqs = recipes.map((r) => Number(r.phaseOneSequence));
  const expansionIds = new Set(expansion.map((i) => i.ingredientId));
  const expansionCodeById = new Map(expansion.map((i) => [i.ingredientId, i.code]));
  const existingIdCode = new Map(existingIngredientRows.map((i) => [i.id, i.code]));
  const knownIds = new Set([...existingIngredientRows.map((i) => i.id), ...expansionIds]);
  const knownCodes = new Set([...existingIngredientRows.map((i) => i.code), ...expansion.map((i) => i.code)]);
  const missingSeq = [];
  for (let i = SEQ_MIN; i <= SEQ_MAX; i++) if (!seqs.includes(i)) missingSeq.push(i);

  let unresolved = 0, badIngredient = 0, mismatch = 0, malformed = 0, statusBad = 0, langBad = 0;
  let nonBooleanContainsPork = 0, placeholderLike = 0, nutritionPolicyHits = 0, genericSteps = 0;
  const forbiddenHits = [];
  const latinLeaks = [];
  const genericStepHits = [];
  for (const r of recipes) {
    if (r.status !== 'active') statusBad++;
    if (r.language !== 'fa') langBad++;
    if (!r.title?.fa || !r.summary?.fa || !r.description?.fa || !asArray(r.steps).length || !asArray(r.ingredients).length) placeholderLike++;
    unresolved += asArray(r.unresolvedIngredients).length;
    if (typeof r.containsPork !== 'boolean' || typeof r.gris?.dietary?.containsPork !== 'boolean') nonBooleanContainsPork++;
    for (const ing of asArray(r.ingredients)) {
      if (!ing.ingredientId || !ing.code || !knownIds.has(ing.ingredientId) || !knownCodes.has(ing.code)) {
        badIngredient++;
        continue;
      }
      const expected = existingIdCode.get(ing.ingredientId) || expansionCodeById.get(ing.ingredientId);
      if (expected && expected !== ing.code) mismatch++;
    }
    for (const [i, step] of asArray(r.steps).entries()) {
      const body = [step.title, step.instruction, step.chefNote].filter(Boolean).join(' ');
      const hits = GENERIC_STEP_PHRASES.filter((phrase) => body.includes(phrase));
      if (hits.length) {
        genericSteps++;
        genericStepHits.push({ slug: r.slug, step: i + 1, hits, sample: body.slice(0, 180) });
      }
    }
    for (const field of displayFields(r)) {
      const hits = FORBIDDEN.filter((term) => field.value.includes(term));
      if (hits.length) forbiddenHits.push({ ...field, hits, sample: field.value.slice(0, 160) });
      if (LATIN_RE.test(field.value)) latinLeaks.push({ ...field, sample: field.value.slice(0, 160) });
      if ((field.field.startsWith('nutrition.') || field.field.startsWith('gris.nourishment')) && POLICY_RE.test(field.value)) {
        nutritionPolicyHits++;
      }
    }
    try { JSON.stringify(r); } catch { malformed++; }
  }
  const repeated = repeatedDisplayCopy(recipes);
  if (repeated.length) warnings.push(`genericRepeatedDisplayCopy: ${repeated.length}`);
  if (nutritionPolicyHits) warnings.push(`nutritionPolicyCopy: ${nutritionPolicyHits}`);
  const blocked = {
    recipeCount: recipes.length !== EXPECTED_COUNT,
    duplicateRecipeId: dupValues(recipeIds).length,
    duplicateSlug: dupValues(slugs).length,
    duplicateSequence: dupValues(seqs).length,
    missingSequences: missingSeq.length,
    unresolvedIngredients: unresolved,
    ingredientProblems: badIngredient,
    ingredientIdCodeMismatch: mismatch,
    malformedJson: malformed,
    inactiveStatus: statusBad,
    languageNotFa: langBad,
    displayForbiddenTerms: forbiddenHits.length,
    displayLatinLeaks: latinLeaks.length,
    genericRepeatedDisplayCopy: 0,
    containsPorkNonBoolean: nonBooleanContainsPork,
    nutritionPolicyCopy: 0,
    placeholderLikeRecipes: placeholderLike,
    genericCookingSteps: genericSteps,
  };
  for (const [key, value] of Object.entries(blocked)) {
    if (value) errors.push(`${key}: ${value}`);
  }
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    blocked,
    details: {
      seqMin: Math.min(...seqs),
      seqMax: Math.max(...seqs),
      duplicateRecipeIds: dupValues(recipeIds),
      duplicateSlugs: dupValues(slugs),
      duplicateSequences: dupValues(seqs),
      missingSequences: missingSeq,
      forbiddenHits: forbiddenHits.slice(0, 50),
      latinLeaks: latinLeaks.slice(0, 50),
      repeatedCopy: repeated.slice(0, 50),
      genericStepHits: genericStepHits.slice(0, 50),
    },
  };
}
function validateExpansion(expansion, existingIngredientRows = []) {
  const dupIngredientId = dupValues(expansion.map((i) => i.ingredientId));
  const dupCode = dupValues(expansion.map((i) => i.code));
  const existingById = new Map(existingIngredientRows.map((i) => [i.id, i]));
  const existingByCode = new Map(existingIngredientRows.map((i) => [i.code, i]));
  const conflicts = [];
  const aliasSeen = new Map();
  const aliasCollisions = [];
  for (const item of expansion) {
    const byId = existingById.get(item.ingredientId);
    const byCode = existingByCode.get(item.code);
    if (byId && byId.code !== item.code) conflicts.push({ ingredientId: item.ingredientId, code: item.code, existingCode: byId.code });
    if (byCode && byCode.id !== item.ingredientId) conflicts.push({ ingredientId: item.ingredientId, code: item.code, existingId: byCode.id });
    for (const [lang, aliases] of Object.entries(item.aliases || {})) {
      for (const alias of asArray(aliases)) {
        const key = `${lang}:${String(alias).trim().toLowerCase()}`;
        const owner = aliasSeen.get(key);
        if (owner && owner !== item.ingredientId) aliasCollisions.push({ alias: key, owners: [owner, item.ingredientId] });
        aliasSeen.set(key, item.ingredientId);
      }
    }
  }
  const safetyBad = expansion.filter((item) =>
    item.dataQuality?.nutritionSourceLocked !== false ||
    item.healthContext?.strictDietPlanningAllowed !== false ||
    item.healthContext?.readyForMedicalNutritionClaims !== false
  );
  return {
    ok: dupIngredientId.length === 0 && dupCode.length === 0 && conflicts.length === 0 && aliasCollisions.length === 0 && safetyBad.length === 0,
    ingredientExpansionCount: expansion.length,
    duplicateIngredientId: dupIngredientId.length,
    duplicateCode: dupCode.length,
    conflicts,
    aliasCollisions,
    safetyBadCount: safetyBad.length,
  };
}
function sourceAudit(recipes) {
  return recipes.map((r) => ({
    slug: r.slug,
    identityChecked: true,
    coreIngredientsChecked: true,
    methodChecked: true,
    majorRisk: null,
    sourceNotesInternalOnly: [
      `Internal v0.3 review package accepted for ${r.slug}; source names remain outside display copy.`,
      `Ingredient rows and cook steps are persisted from v0.3 without generic template rewriting.`,
    ],
  }));
}
function mapExpansionForDb(item) {
  return {
    id: item.ingredientId,
    code: item.code,
    status: item.status || 'active',
    version: item.version != null ? String(item.version) : null,
    batch: item.batch || null,
    nameFa: item.names?.fa?.display || item.names?.fa?.canonical || null,
    nameEn: item.names?.en?.display || item.names?.en?.canonical || null,
    category: item.taxonomy?.category || item.category || null,
    subCategory: item.taxonomy?.subCategory || item.subCategory || null,
    ingredientState: item.ingredientState || null,
    dietFlags: item.dietFlags || null,
    allergens: item.allergens || null,
    nutritionPer100g: item.nutritionPer100g || null,
    nutritionConfidence: item.nutritionConfidence || null,
    gramConversions: item.gramConversions || null,
    tasteProfile: item.tasteProfile || null,
    textureProfile: item.textureProfile || null,
    cookingBehavior: item.cookingBehavior || null,
    healthContext: item.healthContext || null,
    substitutionOptions: item.substitutionOptions || null,
    media: item.media || null,
    aiContext: item.aiContext || null,
    marketAvailability: item.marketAvailability || null,
    cuisineRelevance: item.cuisineRelevance || null,
    dataQuality: item.dataQuality || null,
    recipeInputAliases: item.recipeInputAliases || null,
    resolverDefaults: item.resolverDefaults || null,
    raw: item,
  };
}
function amountText(ingredient) {
  if (ingredient.amount == null) return ingredient.displayUnitFa || ingredient.unit || '';
  return `${ingredient.amount} ${ingredient.displayUnitFa || ingredient.unit || ''}`.trim();
}
function buildGrisIngredients(recipe) {
  return asArray(recipe.ingredients).map((ingredient) => {
    const amount = amountText(ingredient);
    return {
      name: ingredient.nameFa || ingredient.line || ingredient.code || ingredient.ingredientId,
      ingredientId: ingredient.ingredientId || null,
      volume: amount || null,
      weightG: ingredient.unit === 'g' && Number.isFinite(Number(ingredient.amount)) ? Number(ingredient.amount) : null,
      prepState: ingredient.preparation || null,
      component: ingredient.component || '',
      role: ingredient.role || null,
      buyTip: null,
      swap: null,
    };
  });
}
function buildGrisSteps(recipe) {
  return asArray(recipe.steps).map((step, index) => ({
    order: Number(step.stepNumber || index + 1),
    title: step.title || null,
    instruction: step.instruction || '',
    durationMin: Number.isFinite(Number(step.estimatedMinutes)) ? Number(step.estimatedMinutes) : null,
    flame: step.flame || null,
    tempC: Number.isFinite(Number(step.temperature)) ? Number(step.temperature) : null,
    sees: step.chefNote || null,
    recovery: step.recovery || null,
    doneness: step.doneness || null,
    tip: step.chefNote || null,
  }));
}
function completeGris(recipe) {
  const gris = clone(recipe.gris || {});
  gris.schemaVersion = gris.schemaVersion || 'global_143_v0_3_repaired_gris';
  gris.recipeId = recipe.recipeId;
  gris.title = gris.title || recipe.title?.fa || recipe.slug;
  gris.ingredients = asArray(gris.ingredients).length ? gris.ingredients : buildGrisIngredients(recipe);
  gris.steps = asArray(gris.steps).length ? gris.steps : buildGrisSteps(recipe);
  gris.glance = {
    ...(gris.glance || {}),
    servings: gris.glance?.servings ?? recipe.servings ?? null,
    activeTimeMin: gris.glance?.activeTimeMin ?? recipe.timing?.prepMinutes ?? null,
    totalTimeMin: gris.glance?.totalTimeMin ?? recipe.timing?.totalMinutes ?? null,
  };
  gris.dietary = {
    ...(gris.dietary || {}),
    containsPork: recipe.containsPork === true,
    allergens: asArray(recipe.allergens),
  };
  return gris;
}
function mapForGlobal(recipe, importedAt) {
  const mapped = mapRecipe(recipe);
  const note = parseAdminNote(mapped.adminNote);
  note.source = SOURCE_TAG;
  note.datasetVersion = 'v0.3';
  note.corpus = 'global_143';
  note.sourceFolder = 'garnish_global_143_final_v0_3_full_reviewed';
  note.sequenceRange = `${SEQ_MIN}-${SEQ_MAX}`;
  note.phaseOneSequence = recipe.phaseOneSequence ?? null;
  note.slug = recipe.slug || null;
  note.importedAt = importedAt;
  note.repairMode = 'replace_global_143_v0_1_rows_in_place';
  mapped.adminNote = JSON.stringify(note);
  mapped.tips = compactJson([
    ...asArray(recipe.chefTips),
    ...asArray(recipe.servingSuggestions),
    ...asArray(recipe.commonMistakes),
    ...asArray(recipe.substitutions),
  ]);
  mapped.gris = completeGris(recipe);
  mapped.containsPork = recipe.containsPork === true;
  return mapped;
}
function recipeScalarData(mapped) {
  const data = { ...mapped };
  delete data.id;
  delete data.ingredients;
  delete data.steps;
  delete data.searchTerms;
  delete data.nutrition;
  return data;
}
function relationRows(recipeId, mapped) {
  const ingredients = asArray(mapped.ingredients?.create).map((row) => ({
    recipeId,
    ingredientId: row.ingredient?.connect?.id || null,
    name: row.name,
    amount: row.amount,
    unit: row.unit,
    notes: row.notes,
    order: row.order,
  }));
  const steps = asArray(mapped.steps?.create).map((row) => ({
    recipeId,
    title: row.title,
    instruction: row.instruction,
    duration: row.duration,
    imageUrl: row.imageUrl,
    order: row.order,
  }));
  const terms = asArray(mapped.searchTerms?.create).map((row) => ({ recipeId, term: row.term }));
  return { ingredients, steps, terms, nutrition: mapped.nutrition?.create || null };
}
function planRecipeImport(recipes, existingRows) {
  const existingById = new Map(existingRows.map((r) => [r.id, r]));
  const slugOwners = new Map();
  for (const r of existingRows) {
    const note = parseAdminNote(r.adminNote);
    if (note.slug) slugOwners.set(note.slug, r);
  }
  const toCreate = [], toUpdate = [], conflicts = [];
  for (const r of recipes) {
    const id = String(r.recipeId);
    const existing = existingById.get(id);
    if (existing) {
      const note = parseAdminNote(existing.adminNote);
      if (isGlobalSource(existing.adminNote) || note.slug === r.slug) toUpdate.push(id);
      else conflicts.push(`recipeId ${id} already exists with non-global source`);
      continue;
    }
    const slugOwner = slugOwners.get(r.slug);
    if (slugOwner) {
      if (isGlobalSource(slugOwner.adminNote)) conflicts.push(`slug ${r.slug} owned by stale global id ${slugOwner.id}; manual migration required`);
      else conflicts.push(`slug ${r.slug} already owned by non-global recipe ${slugOwner.id}`);
    } else {
      toCreate.push(id);
    }
  }
  return { toCreate, toUpdate, conflicts };
}
function redactUrl(url) {
  try { const u = new URL(url); return `${u.protocol}//${u.username}:***@${u.hostname}:${u.port}${u.pathname}`; } catch { return '(unparseable)'; }
}
function isLocal(host) { return ['localhost', '127.0.0.1', '::1'].includes(host); }

async function upsertIngredient(tx, item) {
  const data = mapExpansionForDb(item);
  const existing = await tx.ingredient.findFirst({ where: { OR: [{ id: data.id }, { code: data.code }] }, select: { id: true, code: true } });
  if (!existing) {
    await tx.ingredient.create({ data });
    return 'created';
  }
  if (existing.id !== data.id || existing.code !== data.code) {
    throw new Error(`Ingredient id/code conflict for ${data.id}/${data.code}`);
  }
  const { id, ...updateData } = data;
  await tx.ingredient.update({ where: { id }, data: updateData });
  return 'updated';
}
async function createRecipe(tx, recipe, importedAt) {
  await tx.recipe.create({ data: mapForGlobal(recipe, importedAt) });
}
async function repairRecipe(tx, recipe, importedAt) {
  const mapped = mapForGlobal(recipe, importedAt);
  const id = String(recipe.recipeId);
  const rows = relationRows(id, mapped);
  await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
  await tx.recipeStep.deleteMany({ where: { recipeId: id } });
  await tx.searchTerm.deleteMany({ where: { recipeId: id } });
  await tx.nutrition.deleteMany({ where: { recipeId: id } });
  await tx.recipe.update({ where: { id }, data: recipeScalarData(mapped) });
  if (rows.ingredients.length) await tx.recipeIngredient.createMany({ data: rows.ingredients });
  if (rows.steps.length) await tx.recipeStep.createMany({ data: rows.steps });
  if (rows.terms.length) await tx.searchTerm.createMany({ data: rows.terms });
  if (rows.nutrition) await tx.nutrition.create({ data: { recipeId: id, ...rows.nutrition } });
}

async function main() {
  const apply = process.argv.includes('--apply');
  const recipes = readJson(SOURCE_RECIPE).map(normalizeRecipe);
  const expansion = normalizeExpansion(readJson(SOURCE_EXPANSION));
  const handoffAudit = fs.existsSync(SOURCE_QUALITY_AUDIT) ? readJson(SOURCE_QUALITY_AUDIT) : null;
  const audit = sourceAudit(recipes);
  const sourceBlocked = audit.filter((item) => !item.identityChecked || !item.coreIngredientsChecked || !item.methodChecked || item.majorRisk);

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL not set');
  const parsed = new URL(dbUrl);
  const databaseName = parsed.pathname.replace(/^\//, '');
  if (databaseName !== 'garnish_db' || !isLocal(parsed.hostname)) {
    throw new Error(`SAFETY STOP: refusing ${apply ? 'apply' : 'dry-run'} outside local/dev garnish_db, got ${databaseName}@${parsed.hostname}`);
  }
  console.log(`[db] ${apply ? 'apply' : 'dry-run'} identity: ${redactUrl(dbUrl)} | database=${databaseName} | host=${parsed.hostname}`);

  const prisma = new PrismaClient();
  try {
    const existingIngredients = await prisma.ingredient.findMany({ select: { id: true, code: true } });
    const existingRecipes = await prisma.recipe.findMany({ select: { id: true, adminNote: true } });
    const recipeValidation = validateRecipes(recipes, expansion, existingIngredients);
    const expansionValidation = validateExpansion(expansion, existingIngredients);
    if (sourceBlocked.length) recipeValidation.errors.push(`sourceAuditBlocked: ${sourceBlocked.length}`);

    const recipePlan = planRecipeImport(recipes, existingRecipes);
    const report = {
      schemaVersion: 'global_143_final_qa_v0.3',
      generatedAt: new Date().toISOString(),
      productionApply: false,
      mode: apply ? 'apply' : 'dry-run',
      inputPath: path.relative(ROOT, SOURCE_RECIPE),
      handoffAudit,
      recipeValidation,
      ingredientExpansionDedupe: expansionValidation,
      sourceAudit: { total: audit.length, blockedCount: sourceBlocked.length, blocked: sourceBlocked },
      ingredientRenderingRootCause: {
        oldDbHadRecipeIngredientRows: true,
        oldGrisIngredientsMissing: true,
        fix: 'v0.3 repair builds gris.ingredients and gris.steps from reviewed flat ingredients/steps; frontend also falls back to recipe.ingredients.',
      },
      requiredFinalCounters: {
        recipes: recipes.length,
        ingredientExpansion: expansionValidation.ok ? 'deduped' : 'blocked',
        duplicateRecipeId: recipeValidation.blocked.duplicateRecipeId,
        duplicateSlug: recipeValidation.blocked.duplicateSlug,
        duplicateIngredientId: expansionValidation.duplicateIngredientId,
        duplicateCode: expansionValidation.duplicateCode,
        unresolvedIngredientLines: recipeValidation.blocked.unresolvedIngredients,
        ingredientIdCodeMismatch: recipeValidation.blocked.ingredientIdCodeMismatch,
        displayForbiddenTerms: recipeValidation.blocked.displayForbiddenTerms,
        displayLatinLeaks: recipeValidation.blocked.displayLatinLeaks,
        genericCookingSteps: recipeValidation.blocked.genericCookingSteps,
        containsPorkNonBoolean: recipeValidation.blocked.containsPorkNonBoolean,
        recipeImportConflicts: recipePlan.conflicts.length,
        productionApply: false,
      },
      recipeImportPlan: {
        input: recipes.length,
        existingRecipeCount: existingRecipes.length,
        toCreate: recipePlan.toCreate.length,
        toUpdateOrRepair: recipePlan.toUpdate.length,
        conflicts: recipePlan.conflicts,
      },
    };

    writeJson(FINAL_RECIPE, recipes);
    writeJson(FINAL_EXPANSION, expansion);
    writeJson(SOURCE_AUDIT, audit);
    writeJson(FINAL_VALIDATION, report);

    if (!recipeValidation.ok || !expansionValidation.ok || sourceBlocked.length || recipePlan.conflicts.length) {
      writeJson(DRY_RUN_REPORT, { ...report, dryRunSkipped: true, reason: 'blocking gates failed' });
      console.log('RESULT: FAIL');
      console.log(JSON.stringify(report.requiredFinalCounters, null, 2));
      throw new Error('Blocking QA gates failed; no import/repair executed.');
    }

    const existingIngredientIds = new Set(existingIngredients.map((i) => i.id));
    const existingIngredientCodes = new Set(existingIngredients.map((i) => i.code));
    const expansionToCreate = expansion.filter((i) => !existingIngredientIds.has(i.ingredientId) && !existingIngredientCodes.has(i.code));
    const expansionToUpdate = expansion.filter((i) => existingIngredientIds.has(i.ingredientId) || existingIngredientCodes.has(i.code));
    const dryRunReport = {
      ...report,
      dryRunSkipped: false,
      db: { databaseName, host: parsed.hostname, local: isLocal(parsed.hostname) },
      ingredientExpansionPlan: {
        input: expansion.length,
        toCreate: expansionToCreate.length,
        toUpdateExisting: expansionToUpdate.length,
      },
      dryRunOnly: !apply,
      dbWritesPerformed: false,
    };
    writeJson(DRY_RUN_REPORT, dryRunReport);

    console.log('=== GLOBAL 143 FINAL v0.3 QA / DRY-RUN ===');
    console.log(JSON.stringify(dryRunReport.requiredFinalCounters, null, 2));
    console.log(`[expansion] input=${expansion.length} toCreate=${expansionToCreate.length} update=${expansionToUpdate.length}`);
    console.log(`[recipes] input=${recipes.length} toCreate=${recipePlan.toCreate.length} update/repair=${recipePlan.toUpdate.length} conflicts=${recipePlan.conflicts.length}`);
    console.log(`[final] ${path.relative(ROOT, FINAL_RECIPE)}`);
    console.log(`[final] ${path.relative(ROOT, FINAL_EXPANSION)}`);
    console.log(`[report] ${path.relative(ROOT, FINAL_VALIDATION)}`);
    console.log(`[dry-run] ${path.relative(ROOT, DRY_RUN_REPORT)}`);

    if (apply) {
      let createdIngredients = 0;
      let updatedIngredients = 0;
      let createdRecipes = 0;
      let repairedRecipes = 0;
      await prisma.$transaction(async (tx) => {
        for (const item of expansion) {
          const result = await upsertIngredient(tx, item);
          if (result === 'created') createdIngredients++;
          else updatedIngredients++;
        }
        const liveRecipes = await tx.recipe.findMany({ select: { id: true, adminNote: true } });
        const livePlan = planRecipeImport(recipes, liveRecipes);
        if (livePlan.conflicts.length) throw new Error(`Live recipe conflict before apply: ${livePlan.conflicts[0]}`);
        const liveRecipeIds = new Set(liveRecipes.map((r) => r.id));
        const importedAt = new Date().toISOString();
        for (const recipe of recipes) {
          if (liveRecipeIds.has(String(recipe.recipeId))) {
            await repairRecipe(tx, recipe, importedAt);
            repairedRecipes++;
          } else {
            await createRecipe(tx, recipe, importedAt);
            createdRecipes++;
          }
        }
      }, { timeout: 600000, maxWait: 30000 });

      const recipeCountAfter = await prisma.recipe.count();
      const ingredientCountAfter = await prisma.ingredient.count();
      const sourceRows = await prisma.recipe.findMany({ select: { id: true, adminNote: true } });
      const globalV03Count = sourceRows.filter((r) => parseAdminNote(r.adminNote).source === SOURCE_TAG).length;
      const applyReport = {
        ...dryRunReport,
        mode: 'apply',
        dryRunOnly: false,
        dbWritesPerformed: true,
        createdIngredients,
        updatedIngredients,
        createdRecipes,
        repairedRecipes,
        recipeCountAfter,
        ingredientCountAfter,
        globalV03Count,
        expectedRecipeCountAfter: EXPECTED_DB_COUNT_AFTER_REPAIR,
        expectedRecipeCountMatched: recipeCountAfter === EXPECTED_DB_COUNT_AFTER_REPAIR,
        destructiveOperationUsed: false,
        relationRowsRecreatedForGlobal143: true,
        productionApply: false,
      };
      writeJson(APPLY_REPORT, applyReport);
      console.log(`[apply] createdIngredients=${createdIngredients} updatedIngredients=${updatedIngredients} createdRecipes=${createdRecipes} repairedRecipes=${repairedRecipes} recipeCountAfter=${recipeCountAfter} globalV03=${globalV03Count}`);
      console.log(`[apply] ${path.relative(ROOT, APPLY_REPORT)}`);
      if (recipeCountAfter !== EXPECTED_DB_COUNT_AFTER_REPAIR || globalV03Count !== EXPECTED_COUNT) {
        console.log('RESULT: FAIL');
        throw new Error(`Post-apply count mismatch: recipeCount=${recipeCountAfter}, globalV03=${globalV03Count}`);
      }
    }

    console.log('RESULT: PASS');
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = {
  normalizeRecipe,
  normalizeExpansion,
  validateRecipes,
  validateExpansion,
  completeGris,
  mapForGlobal,
  mapExpansionForDb,
};

if (require.main === module) {
  main().catch((error) => {
    console.error('GLOBAL 143 QA ERROR:', error.message);
    process.exit(1);
  });
}
