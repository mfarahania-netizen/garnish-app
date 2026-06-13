import { readFile } from 'node:fs/promises';
import path from 'node:path';

const INGREDIENT_DICTIONARY_PATH = path.resolve(
  process.cwd(),
  'data/ingredients/phase-one-final/Ingredient Dictionary/ingredients_verified_structure_resolver_ready_1008_only_recipe_resolver_alias_patch_00.json',
);

async function main() {
  const raw = await readFile(INGREDIENT_DICTIONARY_PATH, 'utf8');
  const ingredients = JSON.parse(raw);

  if (!Array.isArray(ingredients)) {
    throw new Error('Ingredient import file must be an array-only JSON file.');
  }

  console.log(`Loaded ${ingredients.length} ingredients from approved dictionary.`);

  // The production importer lives in:
  // apps/server/scripts/data/import-ingredients.js
  // This placeholder stays as a documented root-level entry point for the
  // approved dictionary path. Do not import Nutrition Source Layer, Registry,
  // Validation Report, or Recipe Ingredient Mapping as ingredient records.
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
