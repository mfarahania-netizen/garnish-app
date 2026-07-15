/**
 * Apply the reviewed allergen-safety override manifest to the LOCAL Garnish DB.
 *
 * Dry-run by default. `--apply` updates only Ingredient.allergens, Ingredient.dietFlags and the matching fields
 * inside Ingredient.raw. The canonical import path applies the same function on every future import, so this is
 * a one-time live-data reconciliation rather than a second source of truth.
 */
const { PrismaClient } = require('@prisma/client');
const {
  ALLERGEN_SAFETY_OVERRIDES,
  applyAllergenSafetyOverride,
} = require('./ingredient-dictionary');

const prisma = new PrismaClient();
const isLocal = (host) => ['localhost', '127.0.0.1', '::1'].includes(host);
const stable = (value) => JSON.stringify(value);

async function main() {
  const apply = process.argv.includes('--apply');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  const parsed = new URL(url);
  if (!isLocal(parsed.hostname) || parsed.pathname.replace(/^\//, '') !== 'garnish_db') {
    throw new Error('SAFETY STOP: expected local garnish_db');
  }

  const rows = await prisma.ingredient.findMany({
    select: { id: true, allergens: true, dietFlags: true, raw: true },
  });
  const present = new Set(rows.map((row) => row.id));
  const missing = Object.keys(ALLERGEN_SAFETY_OVERRIDES.records).filter((id) => !present.has(id));
  if (missing.length) throw new Error(`Override ingredient(s) missing from DB: ${missing.join(', ')}`);

  const changes = [];
  for (const row of rows) {
    const raw = row.raw && typeof row.raw === 'object' && !Array.isArray(row.raw)
      ? { ...row.raw, ingredientId: row.id, allergens: row.allergens, dietFlags: row.dietFlags }
      : { ingredientId: row.id, allergens: row.allergens, dietFlags: row.dietFlags };
    const patched = applyAllergenSafetyOverride(raw);
    if (stable(row.allergens) === stable(patched.allergens) && stable(row.dietFlags) === stable(patched.dietFlags)) continue;
    changes.push({
      id: row.id,
      before: { allergens: row.allergens, dietFlags: row.dietFlags },
      after: { allergens: patched.allergens, dietFlags: patched.dietFlags },
      raw: row.raw && typeof row.raw === 'object' && !Array.isArray(row.raw) ? patched : null,
    });
  }

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    ingredientCount: rows.length,
    overrideCount: Object.keys(ALLERGEN_SAFETY_OVERRIDES.records).length,
    changeCount: changes.length,
    changedIds: changes.map((change) => change.id),
  }, null, 2));

  if (!apply) return;
  await prisma.$transaction(async (tx) => {
    for (const change of changes) {
      await tx.ingredient.update({
        where: { id: change.id },
        data: {
          allergens: change.after.allergens,
          dietFlags: change.after.dietFlags,
          ...(change.raw ? { raw: change.raw } : {}),
        },
      });
    }
  }, { timeout: 120000 });
  console.log(`[apply] reconciled ${changes.length} ingredient records.`);
}

main()
  .catch((error) => {
    console.error(error?.message || error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
