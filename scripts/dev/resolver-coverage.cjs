/**
 * E11 acceptance verification against the REAL database (dev-only, read-only).
 * Builds the resolver index from DB ingredients (aliases/names/codes) using the
 * same validated normalization, then reports coverage + alias spot-checks.
 * Run from apps/server: node ../../scripts/dev/resolver-coverage.cjs
 */
const path = require('node:path');
const { PrismaClient } = require(path.join(process.cwd(), 'node_modules/@prisma/client'));

// Same validated normalization as apps/server/src/ingredients/ingredient-normalize.ts.
function normalize(input) {
  if (input == null) return '';
  return String(input)
    .normalize('NFKC')
    .replace(/[ً-ْٰ]/g, '')
    .replace(/ـ/g, '')
    .replace(/[​-‏‪-‮]/g, '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[أإ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const prisma = new PrismaClient();

(async () => {
  const ingredients = await prisma.ingredient.findMany({
    select: { id: true, nameFa: true, nameEn: true, code: true, recipeInputAliases: true },
  });

  const alias = new Map();
  const name = new Map();
  for (const ing of ingredients) {
    const aliases = Array.isArray(ing.recipeInputAliases) ? ing.recipeInputAliases : [];
    for (const a of aliases) {
      const k = normalize(a);
      if (k && !alias.has(k)) alias.set(k, ing.id);
    }
    for (const nm of [ing.nameFa, ing.nameEn]) {
      if (!nm) continue;
      const k = normalize(nm);
      if (k && !name.has(k)) name.set(k, ing.id);
    }
  }

  const resolve = (t) => {
    const k = normalize(t);
    if (!k) return null;
    return alias.get(k) || name.get(k) || null;
  };

  // Coverage over the ingredient names themselves (every ingredient must resolve).
  let nameHit = 0;
  for (const ing of ingredients) {
    if (ing.nameFa && resolve(ing.nameFa) === ing.id) nameHit++;
  }

  // Spot-check 5 real aliases.
  const spot = ['اجوین', 'اخطبوط', 'آب انگور', 'نمک', 'روغن زیتون'].map((a) => ({
    alias: a,
    resolvedTo: resolve(a),
  }));

  console.log(
    JSON.stringify(
      {
        ingredientsLoaded: ingredients.length,
        aliasKeys: alias.size,
        nameKeys: name.size,
        nameSelfCoveragePct: +((nameHit / ingredients.length) * 100).toFixed(2),
        aliasSpotChecks: spot,
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e.message);
  await prisma.$disconnect();
  process.exit(1);
});
