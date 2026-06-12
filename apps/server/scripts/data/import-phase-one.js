const { PrismaClient } = require('@prisma/client');
const { loadPhaseOneData, mapRecipe, validatePhaseOneData } = require('./phase-one-recipes');
const { importIngredients } = require('./import-ingredients');

const prisma = new PrismaClient();

async function main() {
  const validation = validatePhaseOneData();
  if (!validation.ok) {
    console.error('Import blocked: phase-one recipe validation failed.');
    for (const error of validation.errors) console.error(`- ${error}`);
    process.exit(1);
  }

  const { recipes } = loadPhaseOneData();
  const mappedRecipes = recipes.map(mapRecipe);

  await prisma.$transaction(async (tx) => {
    await importIngredients(tx);
    await tx.mealSlot.updateMany({
      where: { recipeId: { not: null } },
      data: { recipeId: null },
    });
    await tx.recipe.deleteMany({});

    for (const recipe of mappedRecipes) {
      await tx.recipe.create({ data: recipe });
    }
  }, { timeout: 120000 });

  const importedCount = await prisma.recipe.count();
  console.log(JSON.stringify({
    importedCount,
    ingredientDictionarySynced: true,
    source: 'data/recipes/active/recipes.fa.phase-one.json',
    version: 'v0.5.4',
    replacedLegacyRecipes: true,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
