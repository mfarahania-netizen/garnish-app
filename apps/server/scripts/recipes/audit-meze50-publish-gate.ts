import { assertLocalDatabase, duplicateSetsForMeze, evaluateMeze, getCounts, loadMezeRecipes, redactedDbUrl, rollbackEntry, writeCsv, writeJson, writeMd } from './meze50-publish-gate-common';

async function main() {
  assertLocalDatabase();
  const generatedAt = new Date().toISOString();
  const counts = await getCounts();
  const meze = await loadMezeRecipes();
  if (meze.length !== 50) throw new Error(`EXPECTED_MEZE50_FOUND_${meze.length}`);
  const statusDistribution = meze.reduce((acc: Record<string, number>, row) => {
    const key = `${row.status}/${row.isPublic}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const { duplicateSlugSet, duplicateTitleSet } = await duplicateSetsForMeze(meze);
  const rows = meze.map((recipe) => evaluateMeze(recipe, duplicateSlugSet, duplicateTitleSet));
  const ready = rows.filter((row) => row.finalState === 'READY_TO_PUBLISH_AS_IS');
  const keep = rows.filter((row) => row.finalState !== 'READY_TO_PUBLISH_AS_IS');
  const patchRequired: any[] = [];

  writeJson('meze50_rollback_before_publish.json', { generatedAt, databaseUrl: redactedDbUrl(), counts, entries: meze.map(rollbackEntry) });
  writeMd('preflight.md', `# Meze 50 Publish Gate Preflight

- generatedAt: ${generatedAt}
- DATABASE_URL guard: PASS local/dev (${redactedDbUrl()})
- total recipe count: ${counts.totalRecipes}
- active/public count: ${counts.activePublic}
- draft/private/review count: ${counts.draftPrivate}
- ingredient count: ${counts.ingredientCount}
- Meze recipe count: ${counts.mezeTotal}
- Meze public count: ${counts.mezePublic}
- Meze status/isPublic distribution: ${JSON.stringify(statusDistribution)}
- rollback: meze50_rollback_before_publish.json
`);
  writeJson('meze50_audit_before.json', { generatedAt, counts, statusDistribution, readyCount: ready.length, patchRequiredCount: patchRequired.length, keepReviewOnlyCount: keep.length, rows });
  writeMd('meze50_audit_before.md', `# Meze 50 Audit Before Publish

- generatedAt: ${generatedAt}
- ready to publish as-is: ${ready.length}
- patch then publish: ${patchRequired.length}
- keep reviewOnly: ${keep.length}

| # | Final State | Title | Slug | Ingredients | Steps | GRIS ingredients | GRIS steps | Blocker |
|---:|---|---|---|---:|---:|---:|---:|---|
${rows.map((row, index) => `| ${index + 1} | ${row.finalState} | ${row.titleFa} | ${row.slug} | ${row.ingredientCount} | ${row.stepCount} | ${row.grisIngredientCount} | ${row.grisStepCount} | ${row.exactBlocker || '-'} |`).join('\n')}
`);
  writeCsv('meze50_patch_required.csv', patchRequired, ['recipeId', 'slug', 'titleFa', 'patchType', 'reason']);
  writeCsv('meze50_keep_reviewonly.csv', keep, ['recipeId', 'slug', 'titleFa', 'finalState', 'exactBlocker']);
  console.log(JSON.stringify({ ok: true, rows: rows.length, ready: ready.length, keep: keep.length, counts, statusDistribution }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
