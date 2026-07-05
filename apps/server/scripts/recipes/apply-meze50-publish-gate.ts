import { assertLocalDatabase, duplicateSetsForMeze, evaluateMeze, getCounts, loadMezeRecipes, prisma, regressionStatus, writeJson, writeMd } from './meze50-publish-gate-common';

async function main() {
  assertLocalDatabase();
  const generatedAt = new Date().toISOString();
  const countsBefore = await getCounts();
  const meze = await loadMezeRecipes();
  if (meze.length !== 50) throw new Error(`EXPECTED_MEZE50_FOUND_${meze.length}`);
  const { duplicateSlugSet, duplicateTitleSet } = await duplicateSetsForMeze(meze);
  const rows = meze.map((recipe) => evaluateMeze(recipe, duplicateSlugSet, duplicateTitleSet));
  const ready = rows.filter((row) => row.finalState === 'READY_TO_PUBLISH_AS_IS');
  const keep = rows.filter((row) => row.finalState !== 'READY_TO_PUBLISH_AS_IS');

  await prisma.$transaction(async (tx) => {
    if (ready.length) {
      await tx.recipe.updateMany({
        where: { id: { in: ready.map((row) => row.recipeId) } },
        data: { status: 'active', isPublic: true },
      });
    }
    if (keep.length) {
      await tx.recipe.updateMany({
        where: { id: { in: keep.map((row) => row.recipeId) } },
        data: { status: 'reviewOnly', isPublic: false },
      });
    }
    const [totalRecipes, ingredientCount] = await Promise.all([tx.recipe.count(), tx.ingredient.count()]);
    if (totalRecipes !== countsBefore.totalRecipes) throw new Error(`RECIPE_COUNT_CHANGED:${countsBefore.totalRecipes}->${totalRecipes}`);
    if (ingredientCount !== countsBefore.ingredientCount) throw new Error(`INGREDIENT_COUNT_CHANGED:${countsBefore.ingredientCount}->${ingredientCount}`);
  });

  const countsAfter = await getCounts();
  const regression = await regressionStatus();
  writeJson('meze50_publish_report.json', { generatedAt, countsBefore, countsAfter, published: ready.length, patched: 0, keepReviewOnly: keep.length, deletedRecipes: 0, newRecipes: 0, newIngredients: 0, regression, rows });
  writeMd('meze50_publish_report.md', `# Meze 50 Publish Report

- generatedAt: ${generatedAt}
- total recipe count: ${countsBefore.totalRecipes} -> ${countsAfter.totalRecipes}
- active/public count: ${countsBefore.activePublic} -> ${countsAfter.activePublic}
- draft/private/review count: ${countsBefore.draftPrivate} -> ${countsAfter.draftPrivate}
- ingredient count: ${countsBefore.ingredientCount} -> ${countsAfter.ingredientCount}
- Meze published count: ${ready.length}
- Meze still reviewOnly count: ${keep.length}
- patched Meze count: 0
- deleted recipes: 0
- new recipes: 0
- new ingredients: 0
- Gamaj/Qeymeh regression: ${regression.gamaj}/${regression.qeymeh}

| # | Final State | Title | Slug | Blocker |
|---:|---|---|---|---|
${rows.map((row, index) => `| ${index + 1} | ${row.finalState} | ${row.titleFa} | ${row.slug} | ${row.exactBlocker || '-'} |`).join('\n')}
`);
  console.log(JSON.stringify({ ok: true, published: ready.length, keepReviewOnly: keep.length, countsBefore, countsAfter, regression }, null, 2));
}

main().finally(async () => prisma.$disconnect()).catch((err) => {
  console.error(err);
  process.exit(1);
});
