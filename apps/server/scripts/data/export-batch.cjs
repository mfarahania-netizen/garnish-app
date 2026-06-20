/**
 * EXPORT-BATCH (DEV) — pick the next N recipes that don't yet have GRIS and write their full source
 * (ingredients with real ids + steps) to docs/data-pilot/_grounding/<batch>.json for the authoring
 * pipeline. Iranian (fa_) recipes are prioritized, then by source-lock coverage + ingredient richness.
 *
 * Usage:  node export-batch.cjs <batch> <size>   e.g.  node export-batch.cjs batch-03 40
 */
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');

const ROOT = path.resolve(__dirname, '../../../..');

async function main() {
  const batch = process.argv[2] || 'batch-03';
  const size = parseInt(process.argv[3], 10) || 40;
  const prisma = new PrismaClient();
  try {
    const withGris = new Set((await prisma.$queryRawUnsafe('SELECT id FROM "Recipe" WHERE gris IS NOT NULL')).map((r) => r.id));
    const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/data-pilot/_grounding/recipes-index.json'), 'utf8'));
    const cand = idx
      .filter((r) => !withGris.has(r.id) && r.ingCount > 0)
      .map((r) => ({ ...r, lockPct: Math.round((r.locked / r.ingCount) * 100), fa: r.id.startsWith('garnish_recipe_fa_') }));
    cand.sort((a, b) => b.lockPct - a.lockPct || (b.fa ? 1 : 0) - (a.fa ? 1 : 0) || b.ingCount - a.ingCount);
    const ids = cand.slice(0, size).map((r) => r.id);

    const recs = await prisma.recipe.findMany({
      where: { id: { in: ids } },
      include: { ingredients: { include: { ingredient: { select: { id: true, nameFa: true, category: true } } } }, steps: { orderBy: { order: 'asc' } }, nutrition: true },
    });
    const byId = new Map(recs.map((r) => [r.id, r]));
    const out = ids.map((id) => byId.get(id)).filter(Boolean).map((r) => ({
      recipeId: r.id, title: r.title, categories: r.categories, mealType: r.mealType,
      servings: r.servings, cookingTime: r.cookingTime, difficulty: r.difficulty, description: r.description,
      ingredients: (r.ingredients || []).map((x) => ({ name: x.name, amount: x.amount, unit: x.unit, ingredientId: x.ingredientId || (x.ingredient && x.ingredient.id) || null, dictNameFa: (x.ingredient && x.ingredient.nameFa) || null, dictCategory: (x.ingredient && x.ingredient.category) || null })),
      steps: (r.steps || []).map((s) => s.instruction),
      nutrition: r.nutrition ? { calories: r.nutrition.calories, protein: r.nutrition.protein, carbs: r.nutrition.carbs, fat: r.nutrition.fat, fiber: r.nutrition.fiber } : null,
    }));
    fs.writeFileSync(path.join(ROOT, `docs/data-pilot/_grounding/${batch}.json`), JSON.stringify(out, null, 1));
    fs.mkdirSync(path.join(ROOT, `docs/data-pilot/_authored/${batch}`), { recursive: true });
    console.log(`${batch}: ${out.length} recipes (fa: ${out.filter((b) => b.recipeId.includes('_fa_')).length})`);
    // emit a JS array literal for the workflow recipe list
    const lines = out.map((b) => `  { recipeId: ${JSON.stringify(b.recipeId)}, title: ${JSON.stringify(b.title)} },`);
    fs.writeFileSync(path.join(ROOT, `docs/data-pilot/_grounding/${batch}.list.txt`), lines.join('\n'));
    console.log(`wrote ${batch}.list.txt (paste into the workflow recipes array)`);
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
