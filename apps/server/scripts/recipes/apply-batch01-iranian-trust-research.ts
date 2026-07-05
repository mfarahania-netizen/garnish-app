import {
  assertLocalDatabase,
  evaluate,
  getCounts,
  loadBatchRecipes,
  prisma,
  regressionStatus,
  writeJson,
  writeMd,
} from './batch01-iranian-trust-common';

async function main() {
  assertLocalDatabase();
  const generatedAt = new Date().toISOString();
  const countsBefore = await getCounts();
  const loaded = await loadBatchRecipes();
  const rows = loaded.map(({ rule, recipe }) => ({ rule, recipe, result: evaluate(rule, recipe) }));
  const restore = rows.filter((row) => row.recipe && row.result.status === 'RESTORE_PUBLIC_AS_IS');
  const keep = rows.filter((row) => !row.recipe || row.result.status !== 'RESTORE_PUBLIC_AS_IS');

  await prisma.$transaction(async (tx) => {
    if (restore.length) {
      const updated = await tx.recipe.updateMany({
        where: { id: { in: restore.map((row) => row.recipe.id) } },
        data: { status: 'active', isPublic: true },
      });
      if (updated.count !== restore.length) throw new Error(`RESTORE_COUNT_MISMATCH:${updated.count}/${restore.length}`);
    }
    if (keep.length) {
      const updatedKeep = await tx.recipe.updateMany({
        where: { id: { in: keep.filter((row) => row.recipe).map((row) => row.recipe.id) } },
        data: { status: 'reviewOnly', isPublic: false },
      });
      if (updatedKeep.count !== keep.filter((row) => row.recipe).length) throw new Error(`KEEP_COUNT_MISMATCH:${updatedKeep.count}/${keep.filter((row) => row.recipe).length}`);
    }
    const total = await tx.recipe.count();
    const ingredients = await tx.ingredient.count();
    if (total !== countsBefore.totalRecipes) throw new Error(`RECIPE_COUNT_CHANGED:${countsBefore.totalRecipes}->${total}`);
    if (ingredients !== countsBefore.ingredientCount) throw new Error(`INGREDIENT_COUNT_CHANGED:${countsBefore.ingredientCount}->${ingredients}`);
  });

  const countsAfter = await getCounts();
  const regression = await regressionStatus();
  const applyRows = rows.map((row) => ({
    recipeId: row.recipe?.id ?? null,
    slug: row.rule.slug,
    titleFa: row.recipe?.title ?? row.rule.titleFa,
    finalState: row.result.status,
    restored: row.result.status === 'RESTORE_PUBLIC_AS_IS',
    exactBlocker: row.result.exactBlocker,
  }));
  const publicUnresolved = await prisma.recipe.count({
    where: { id: { in: keep.filter((row) => row.recipe).map((row) => row.recipe.id) }, status: 'active', isPublic: true },
  });
  writeJson('batch01_apply_report.json', { generatedAt, countsBefore, countsAfter, restored: restore.length, patched: 0, reframed: 0, stillReviewOnly: keep.length, publicUnresolved, regression, rows: applyRows });
  writeMd('batch01_apply_report.md', `# Batch 01 Apply Report

- generatedAt: ${generatedAt}
- total recipe count: ${countsBefore.totalRecipes} -> ${countsAfter.totalRecipes}
- active/public count: ${countsBefore.activePublic} -> ${countsAfter.activePublic}
- draft/private/review count: ${countsBefore.draftPrivate} -> ${countsAfter.draftPrivate}
- ingredient count: ${countsBefore.ingredientCount} -> ${countsAfter.ingredientCount}
- restored as-is: ${restore.length}
- patched and restored: 0
- renamed/reframed and restored: 0
- still reviewOnly: ${keep.length}
- public unresolved blockers in batch: ${publicUnresolved}
- deleted recipes: 0
- new ingredients: 0
- Gamaj Kabab regression: ${regression.gamaj}
- Qeymeh Rizeh regression: ${regression.qeymeh}

| # | Final State | Title | Slug | Exact Blocker |
|---:|---|---|---|---|
${applyRows.map((row, index) => `| ${index + 1} | ${row.finalState} | ${row.titleFa} | ${row.slug} | ${row.exactBlocker || '-'} |`).join('\n')}
`);
  console.log(JSON.stringify({ ok: publicUnresolved === 0, restored: restore.length, stillReviewOnly: keep.length, countsBefore, countsAfter, regression }, null, 2));
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
