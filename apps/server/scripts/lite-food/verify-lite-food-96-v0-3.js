const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const {
  ROOT,
  QA_DIR,
  SOURCE_TAG,
  EXPECTED_COMBINED_INGREDIENTS,
  EXPECTED_EXPANSION_INGREDIENTS,
  EXPECTED_LITE_RECIPES,
  parseAdminNote,
  loadLiteFoodData,
  validateIngredientExpansion,
  validateLiteFoodRecipes,
} = require('./lite-food-v0-3');

const fs = require('node:fs');
const QA_PATH = path.join(QA_DIR, 'lite_food_v0_3_post_import_verify.json');

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function main() {
  const ingredientValidation = validateIngredientExpansion();
  if (!ingredientValidation.ok) {
    console.log('RESULT: FAIL (ingredient validation failed)');
    for (const error of ingredientValidation.errors) console.log(' -', error);
    process.exit(1);
  }

  const { expansion, recipes } = loadLiteFoodData();
  const liteIds = recipes.map((recipe) => String(recipe.recipeId));
  const sampleSlugs = [
    'feta-walnut-and-honey-on-bread',
    'iced-matcha-latte',
    'cold-mortadella-and-cheese-sandwich',
  ];

  const prisma = new PrismaClient();
  const checks = [];
  const samples = [];
  const check = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail });
  try {
    const dbIngredients = await prisma.ingredient.findMany({ select: { id: true, code: true } });
    const recipeValidation = validateLiteFoodRecipes(dbIngredients);
    check('sourceDataValidAgainstDbIngredients', recipeValidation.ok, recipeValidation.ok ? '' : recipeValidation.errors.slice(0, 5).join(' | '));

    const ingredientCount = await prisma.ingredient.count();
    const expansionRows = await prisma.ingredient.findMany({
      where: { id: { in: expansion.map((ingredient) => String(ingredient.ingredientId)) } },
      select: { id: true, code: true, nameFa: true },
    });
    check('ingredientCountAtLeast1024', ingredientCount >= EXPECTED_COMBINED_INGREDIENTS, `ingredientCount=${ingredientCount}`);
    check('all16ExpansionIngredientsExist', expansionRows.length === EXPECTED_EXPANSION_INGREDIENTS, `expansionRows=${expansionRows.length}`);

    const liteRows = await prisma.recipe.findMany({
      where: { id: { in: liteIds } },
      select: {
        id: true,
        title: true,
        category: true,
        dishType: true,
        categories: true,
        adminNote: true,
        ingredients: { select: { ingredientId: true, name: true }, orderBy: { order: 'asc' } },
        searchTerms: { select: { term: true } },
      },
    });
    const tagged = liteRows.filter((row) => parseAdminNote(row.adminNote).source === SOURCE_TAG);
    check('all96LiteRecipeIdsExist', liteRows.length === EXPECTED_LITE_RECIPES, `liteRows=${liteRows.length}`);
    check('all96LiteRecipesTagged', tagged.length === EXPECTED_LITE_RECIPES, `tagged=${tagged.length}`);

    const nullIngredientLines = await prisma.recipeIngredient.count({
      where: { recipeId: { in: liteIds }, ingredientId: null },
    });
    check('allLiteIngredientLinesConnected', nullIngredientLines === 0, `nullIngredientLines=${nullIngredientLines}`);

    const dangling = await prisma.recipeIngredient.count({
      where: { recipeId: { in: liteIds }, ingredientId: { not: null }, ingredient: { is: null } },
    });
    check('noDanglingLiteIngredientRefs', dangling === 0, `dangling=${dangling}`);

    const categoryCount = await prisma.recipe.count({ where: { category: 'lite_food', id: { in: liteIds } } });
    check('categoryLiteFoodQueryable', categoryCount === EXPECTED_LITE_RECIPES, `categoryCount=${categoryCount}`);
    const activePublicCount = await prisma.recipe.count({
      where: { category: 'lite_food', id: { in: liteIds }, status: 'active', isPublic: true },
    });
    check('allLiteRecipesActiveAndPublic', activePublicCount === EXPECTED_LITE_RECIPES, `activePublicCount=${activePublicCount}`);

    let metadataFailures = 0;
    for (const row of tagged) {
      const note = parseAdminNote(row.adminNote);
      const dishType = parseJsonArray(row.dishType);
      const categories = parseJsonArray(row.categories);
      const searchTerms = new Set(row.searchTerms.map((term) => term.term));
      const lite = note.aiContext?.lite || note.lite || {};
      const sourceIngredientNames = row.ingredients.map((ingredient) => ingredient.name).filter(Boolean);
      const requiredTerms = [note.slug, lite.liteCategory, lite.uiGroup, row.title, ...sourceIngredientNames].filter(Boolean);
      const requiredTags = ['lite_food', lite.liteCategory, lite.uiGroup].filter(Boolean);
      const tagsOk = requiredTags.every((tag) => dishType.includes(tag) || categories.includes(tag));
      const searchOk = requiredTerms.every((term) => searchTerms.has(term));
      if (row.category !== 'lite_food' || !tagsOk || !searchOk || lite.contentType !== 'lite_food') metadataFailures++;
    }
    check('liteMetadataAndSearchTermsPreserved', metadataFailures === 0, `metadataFailures=${metadataFailures}`);

    for (const slug of sampleSlugs) {
      const row = tagged.find((recipe) => parseAdminNote(recipe.adminNote).slug === slug);
      samples.push({
        slug,
        id: row?.id || null,
        title: row?.title || null,
        ingredientIds: row?.ingredients.map((ingredient) => ingredient.ingredientId) || [],
        shoppingListCompatible: Boolean(row && row.ingredients.length > 0 && row.ingredients.every((ingredient) => ingredient.ingredientId)),
      });
    }
    check('sampleShoppingListExtractionCompatible', samples.every((sample) => sample.shoppingListCompatible), JSON.stringify(samples));

    const report = {
      schemaVersion: 1,
      source: SOURCE_TAG,
      generatedAt: new Date().toISOString(),
      ingredientCount,
      expansionRows: expansionRows.length,
      liteRows: liteRows.length,
      taggedLiteRows: tagged.length,
      categoryCount,
      activePublicCount,
      nullIngredientLines,
      danglingIngredientReferences: dangling,
      metadataFailures,
      samples,
      checks,
      ok: checks.every((item) => item.ok),
      destructiveOperationUsed: false,
    };
    fs.mkdirSync(QA_DIR, { recursive: true });
    fs.writeFileSync(QA_PATH, JSON.stringify(report, null, 2));

    console.log('=== LITE_FOOD v0.3 POST-IMPORT VERIFY ===');
    for (const item of checks) console.log(`  [${item.ok ? 'PASS' : 'FAIL'}] ${item.name} ${item.detail}`);
    console.log(`samples: ${JSON.stringify(samples)}`);
    console.log(`[report] ${path.relative(ROOT, QA_PATH)}`);
    console.log(`RESULT: ${report.ok ? 'PASS' : 'FAIL'}`);
    if (!report.ok) process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('VERIFY ERROR:', error.message);
    process.exit(1);
  });
}
