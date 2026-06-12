const { PrismaClient } = require('@prisma/client');
const {
  loadIngredientDictionary,
  mapIngredient,
  validateIngredientDictionary,
} = require('./ingredient-dictionary');

const prisma = new PrismaClient();

function parseMetadata(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

async function importIngredients(tx = prisma) {
  const validation = validateIngredientDictionary();
  if (!validation.ok) {
    const error = new Error('Ingredient import blocked: dictionary validation failed.');
    error.validationErrors = validation.errors;
    throw error;
  }

  const rows = loadIngredientDictionary().map(mapIngredient);
  for (const row of rows) {
    await tx.ingredient.upsert({
      where: { id: row.id },
      update: row,
      create: row,
    });
  }

  return rows.length;
}

async function backfillRecipeIngredientLinks(tx = prisma) {
  const recipeIngredients = await tx.recipeIngredient.findMany({
    select: { id: true, notes: true, ingredientId: true },
  });
  let linked = 0;
  let missing = 0;

  for (const recipeIngredient of recipeIngredients) {
    const metadata = parseMetadata(recipeIngredient.notes);
    const ingredientId = recipeIngredient.ingredientId || metadata?.ingredientId;
    if (!ingredientId) {
      missing += 1;
      continue;
    }

    await tx.recipeIngredient.update({
      where: { id: recipeIngredient.id },
      data: { ingredientId },
    });
    linked += 1;
  }

  return { linked, missing, total: recipeIngredients.length };
}

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    const importedCount = await importIngredients(tx);
    const linkSummary = await backfillRecipeIngredientLinks(tx);
    return { importedCount, linkSummary };
  }, { timeout: 120000 });

  console.log(JSON.stringify({
    ...result,
    source: 'approved_ingredient_dictionary',
  }, null, 2));
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error.validationErrors || error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = {
  importIngredients,
  backfillRecipeIngredientLinks,
};

