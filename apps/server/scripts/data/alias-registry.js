const fs = require('node:fs');
const path = require('node:path');
const { loadIngredientDictionary } = require('./ingredient-dictionary');

// Canonical normalized alias registry produced by the phase-one data pipeline.
// Each entry: { language, normalized, ingredientIds: [string], fieldSources }.
const ROOT_DIR = path.resolve(__dirname, '../../../..');
const ALIAS_REGISTRY_PATH = path.join(
  ROOT_DIR,
  'data/ingredients/phase-one-final/Registry/normalized_alias_registry.json',
);

function loadAliasRegistry() {
  return JSON.parse(fs.readFileSync(ALIAS_REGISTRY_PATH, 'utf8'));
}

/** ingredientId -> sorted unique normalized aliases. */
function buildAliasesByIngredient() {
  const registry = loadAliasRegistry();
  const map = new Map();
  for (const entry of registry) {
    const alias = entry.normalized;
    if (!alias) continue;
    const ids = Array.isArray(entry.ingredientIds) ? entry.ingredientIds : [entry.ingredientIds];
    for (const id of ids) {
      if (!id) continue;
      const key = String(id);
      if (!map.has(key)) map.set(key, new Set());
      map.get(key).add(alias);
    }
  }
  const out = new Map();
  for (const [id, set] of map) out.set(id, [...set].sort());
  return out;
}

function validateAliasRegistry() {
  const registry = loadAliasRegistry();
  if (!Array.isArray(registry)) {
    return { ok: false, errors: ['alias registry must be an array.'], summary: { registryEntries: 0 } };
  }
  const errors = [];
  const dictIds = new Set(loadIngredientDictionary().map((i) => String(i.ingredientId)));
  let totalLinks = 0;
  let unknownRefs = 0;
  for (const entry of registry) {
    if (!entry.normalized) errors.push('alias entry missing normalized text.');
    const ids = Array.isArray(entry.ingredientIds) ? entry.ingredientIds : [entry.ingredientIds];
    for (const id of ids) {
      totalLinks += 1;
      if (!dictIds.has(String(id))) {
        unknownRefs += 1;
        if (unknownRefs <= 5) errors.push(`alias references unknown ingredientId ${id}.`);
      }
    }
  }
  const byIngredient = buildAliasesByIngredient();
  return {
    ok: errors.length === 0,
    errors,
    summary: {
      registryEntries: registry.length,
      ingredientsWithAliases: byIngredient.size,
      totalAliasLinks: totalLinks,
      unknownIngredientRefs: unknownRefs,
    },
  };
}

module.exports = {
  ALIAS_REGISTRY_PATH,
  loadAliasRegistry,
  buildAliasesByIngredient,
  validateAliasRegistry,
};
