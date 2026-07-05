import {
  assertLocalDatabase,
  getCounts,
  loadBlockers,
  loadRecipes,
  prisma,
  redactedDbUrl,
  rollbackEntry,
  writeJson,
  writeMd,
} from './resolve-authenticity-85-no-public-blockers-common';

async function main() {
  assertLocalDatabase();
  const generatedAt = new Date().toISOString();
  const blockers = loadBlockers();
  const ids = blockers.map((row) => row.recipeId);
  const countsBefore = await getCounts();
  const recipes = await loadRecipes(ids);
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const missing = blockers.filter((row) => !byId.has(row.recipeId));
  if (missing.length) throw new Error(`MISSING_BLOCKER_RECIPES:${missing.map((row) => row.recipeId).join(',')}`);

  const rollback = blockers.map((row) => rollbackEntry(byId.get(row.recipeId), row.slug));
  writeJson('rollback_85_before_resolution.json', {
    generatedAt,
    databaseUrl: redactedDbUrl(),
    countsBefore,
    entries: rollback,
  });
  writeJson('hide_unresolved_85_rollback.json', {
    generatedAt,
    databaseUrl: redactedDbUrl(),
    entries: rollback,
  });
  writeMd(
    'preflight_report.md',
    `# Resolve Authenticity 85 No Public Blockers Preflight

- generatedAt: ${generatedAt}
- DATABASE_URL guard: PASS local/dev (${redactedDbUrl()})
- recipe count: ${countsBefore.totalRecipes}
- active/public count: ${countsBefore.activePublic}
- draft/private count: ${countsBefore.draftPrivate}
- ingredient count: ${countsBefore.ingredientCount}
- Meze total: ${countsBefore.mezeTotal}
- Meze public: ${countsBefore.mezePublic}
- Meze non-draft: ${countsBefore.mezeNonDraft}
- blocker rows loaded: ${blockers.length}
- rollback snapshot: rollback_85_before_resolution.json
`,
  );

  const alreadyHidden = recipes.filter((recipe) => recipe.status !== 'active' || recipe.isPublic === false);
  const toHide = recipes.filter((recipe) => recipe.status === 'active' && recipe.isPublic === true);
  const beforePublic = await prisma.recipe.count({ where: { id: { in: ids }, status: 'active', isPublic: true } });

  await prisma.$transaction(async (tx) => {
    const updated = await tx.recipe.updateMany({
      where: { id: { in: toHide.map((recipe) => recipe.id) }, status: 'active', isPublic: true },
      data: { status: 'reviewOnly', isPublic: false },
    });
    if (updated.count !== toHide.length) throw new Error(`HIDE_UPDATE_COUNT_MISMATCH:${updated.count}/${toHide.length}`);
    const totalAfterInsideTx = await tx.recipe.count();
    if (totalAfterInsideTx !== countsBefore.totalRecipes) throw new Error(`RECIPE_COUNT_CHANGED_IN_TX:${countsBefore.totalRecipes}->${totalAfterInsideTx}`);
  });

  const countsAfter = await getCounts();
  const afterPublic = await prisma.recipe.count({ where: { id: { in: ids }, status: 'active', isPublic: true } });
  if (countsAfter.totalRecipes !== countsBefore.totalRecipes) throw new Error(`RECIPE_COUNT_CHANGED:${countsBefore.totalRecipes}->${countsAfter.totalRecipes}`);
  if (countsAfter.ingredientCount !== countsBefore.ingredientCount) throw new Error(`INGREDIENT_COUNT_CHANGED:${countsBefore.ingredientCount}->${countsAfter.ingredientCount}`);
  if (afterPublic !== 0) throw new Error(`UNRESOLVED_PUBLIC_BLOCKERS_REMAIN:${afterPublic}`);

  writeMd(
    'hide_unresolved_85_report.md',
    `# Hide Unresolved Authenticity Blockers 85 Report

- generatedAt: ${generatedAt}
- blocker recipes loaded: ${blockers.length}
- unresolved public before hide: ${beforePublic}
- hidden/unpublished in this run: ${toHide.length}
- already non-public before run: ${alreadyHidden.length}
- unresolved public after hide: ${afterPublic}
- recipe count: ${countsBefore.totalRecipes} -> ${countsAfter.totalRecipes}
- active/public count: ${countsBefore.activePublic} -> ${countsAfter.activePublic}
- draft/private count: ${countsBefore.draftPrivate} -> ${countsAfter.draftPrivate}
- ingredient count: ${countsBefore.ingredientCount} -> ${countsAfter.ingredientCount}
- visibility action: status=reviewOnly, isPublic=false
- data changed: visibility/status only
- deleted recipes: 0
- new ingredients: 0
- slug changes: 0

Launch public blocker risk is removed; hidden review queue remains.
`,
  );
  console.log(JSON.stringify({ ok: true, hidden: toHide.length, alreadyHidden: alreadyHidden.length, publicRemaining: afterPublic, countsBefore, countsAfter }, null, 2));
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
