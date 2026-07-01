const { PrismaClient } = require('@prisma/client');
const { validateIngredientExpansion, validateLiteFoodRecipes } = require('./lite-food-v0-3');

async function main() {
  const withDb = process.argv.includes('--db');
  const ingredientValidation = validateIngredientExpansion();
  if (!ingredientValidation.ok) {
    console.log('=== LITE_FOOD v0.3 RECIPE VALIDATION ===');
    console.log('RESULT: FAIL (ingredient expansion validation failed)');
    for (const error of ingredientValidation.errors) console.log(' -', error);
    process.exit(1);
  }

  let dbIngredients = null;
  let prisma = null;
  try {
    if (withDb) {
      prisma = new PrismaClient();
      dbIngredients = await prisma.ingredient.findMany({ select: { id: true, code: true } });
    }
    const result = validateLiteFoodRecipes(dbIngredients);
    console.log('=== LITE_FOOD v0.3 RECIPE VALIDATION ===');
    console.log(JSON.stringify(result.summary, null, 2));
    if (result.warnings.length) {
      console.log('warnings:');
      for (const warning of result.warnings) console.log(' -', warning);
    }
    if (!result.ok) {
      console.log('RESULT: FAIL');
      for (const error of result.errors) console.log(' -', error);
      process.exit(1);
    }
    console.log('RESULT: PASS');
  } finally {
    if (prisma) await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('VALIDATION ERROR:', error.message);
    process.exit(1);
  });
}

module.exports = { validateLiteFoodRecipes };
