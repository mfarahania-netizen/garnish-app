import { assertLocalDatabase, evaluate, getCounts, loadRecipes, prisma, regressionStatus, rules, writeJson, writeMd } from './final-27-recipe-trust-common';

async function main() {
  assertLocalDatabase();
  const generatedAt = new Date().toISOString();
  const countsBefore = await getCounts();
  const loaded = await loadRecipes();
  const evaluated = loaded.map(({ rule, recipe }) => ({ rule, recipe, result: evaluate(rule, recipe) }));
  const missing = evaluated.filter((row) => !row.recipe);
  if (missing.length) throw new Error(`MISSING_FINAL27_RECIPES:${missing.map((row) => row.rule.slug).join(',')}`);
  const restore = evaluated.filter((row) => row.result.finalState === 'RESTORE_PUBLIC_AS_IS');
  const keep = evaluated.filter((row) => row.result.finalState !== 'RESTORE_PUBLIC_AS_IS');

  await prisma.$transaction(async (tx) => {
    if (restore.length) {
      await tx.recipe.updateMany({
        where: { id: { in: restore.map((row) => row.recipe.id) } },
        data: { status: 'active', isPublic: true },
      });
    }
    if (keep.length) {
      await tx.recipe.updateMany({
        where: { id: { in: keep.map((row) => row.recipe.id) } },
        data: { status: 'reviewOnly', isPublic: false },
      });
    }
    const [totalRecipes, ingredientCount] = await Promise.all([tx.recipe.count(), tx.ingredient.count()]);
    if (totalRecipes !== countsBefore.totalRecipes) throw new Error(`RECIPE_COUNT_CHANGED:${countsBefore.totalRecipes}->${totalRecipes}`);
    if (ingredientCount !== countsBefore.ingredientCount) throw new Error(`INGREDIENT_COUNT_CHANGED:${countsBefore.ingredientCount}->${ingredientCount}`);
  });

  const countsAfter = await getCounts();
  const regression = await regressionStatus();
  const rows = evaluated.map((row) => ({
    recipeId: row.recipe.id,
    slug: row.rule.slug,
    titleFa: row.recipe.title,
    finalState: row.result.finalState,
    exactBlocker: row.result.exactBlocker,
  }));
  writeJson('final27_apply_report.json', { generatedAt, countsBefore, countsAfter, restored: restore.length, patched: 0, renamedOrReframed: 0, stillReviewOnly: keep.length, deletedRecipes: 0, newIngredients: 0, regression, rows });
  writeMd('final27_apply_report.md', `# Final 27 Apply Report

- generatedAt: ${generatedAt}
- total recipe count: ${countsBefore.totalRecipes} -> ${countsAfter.totalRecipes}
- active/public count: ${countsBefore.activePublic} -> ${countsAfter.activePublic}
- draft/private/review count: ${countsBefore.draftPrivate} -> ${countsAfter.draftPrivate}
- ingredient count: ${countsBefore.ingredientCount} -> ${countsAfter.ingredientCount}
- restored count: ${restore.length}
- patched count: 0
- renamed/reframed count: 0
- still reviewOnly count: ${keep.length}
- deleted recipes: 0
- new ingredients: 0
- Meze public count: ${countsAfter.mezePublic}
- Gamaj/Qeymeh regression: ${regression.gamaj}/${regression.qeymeh}

| # | Final State | Title | Slug | Blocker |
|---:|---|---|---|---|
${rows.map((row, index) => `| ${index + 1} | ${row.finalState} | ${row.titleFa} | ${row.slug} | ${row.exactBlocker || '-'} |`).join('\n')}
`);
  console.log(JSON.stringify({ ok: true, restored: restore.length, stillReviewOnly: keep.length, countsBefore, countsAfter, regression }, null, 2));
}

main().finally(async () => prisma.$disconnect()).catch((err) => {
  console.error(err);
  process.exit(1);
});
