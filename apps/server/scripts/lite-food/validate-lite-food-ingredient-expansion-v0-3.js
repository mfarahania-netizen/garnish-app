const { validateIngredientExpansion } = require('./lite-food-v0-3');

function main() {
  const result = validateIngredientExpansion();
  console.log('=== LITE_FOOD v0.3 INGREDIENT EXPANSION VALIDATION ===');
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
}

if (require.main === module) main();

module.exports = { validateIngredientExpansion };
