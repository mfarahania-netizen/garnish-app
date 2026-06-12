const { PrismaClient } = require('@prisma/client');
const { buildAliasesByIngredient, validateAliasRegistry } = require('./alias-registry');

const prisma = new PrismaClient();

/**
 * Additive, idempotent: populate Ingredient.recipeInputAliases from the
 * normalized alias registry. Only existing ingredients are updated; ingredients
 * absent from the registry are left untouched.
 */
async function importAliases(tx = prisma) {
  const validation = validateAliasRegistry();
  if (!validation.ok) {
    const error = new Error('Alias import blocked: registry validation failed.');
    error.validationErrors = validation.errors;
    throw error;
  }

  const byIngredient = buildAliasesByIngredient();
  const existing = new Set(
    (await tx.ingredient.findMany({ select: { id: true } })).map((r) => r.id),
  );

  let updated = 0;
  let skippedMissing = 0;
  let totalAliases = 0;
  for (const [id, aliases] of byIngredient) {
    if (!existing.has(id)) {
      skippedMissing += 1;
      continue;
    }
    await tx.ingredient.update({
      where: { id },
      data: { recipeInputAliases: aliases },
    });
    updated += 1;
    totalAliases += aliases.length;
  }

  return {
    ingredientsWithAliases: byIngredient.size,
    updated,
    skippedMissing,
    totalAliases,
  };
}

async function main() {
  const result = await prisma.$transaction((tx) => importAliases(tx), { timeout: 120000 });
  console.log(JSON.stringify({ ...result, source: 'normalized_alias_registry' }, null, 2));
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

module.exports = { importAliases };
