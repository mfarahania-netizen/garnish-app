const { validateIngredientDictionary } = require('./ingredient-dictionary');

const result = validateIngredientDictionary();
console.log(JSON.stringify(result.summary, null, 2));

if (!result.ok) {
  console.error('Ingredient dictionary validation failed:');
  for (const error of result.errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Ingredient dictionary validation passed.');

