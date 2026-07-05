import { assertLocalDatabase, duplicateSetsForMeze, evaluateMeze, getCounts, loadMezeRecipes, prisma, regressionStatus, writeJson, writeMd } from './meze50-publish-gate-common';

async function main() {
  assertLocalDatabase();
  const generatedAt = new Date().toISOString();
  const counts = await getCounts();
  const meze = await loadMezeRecipes();
  const { duplicateSlugSet, duplicateTitleSet } = await duplicateSetsForMeze(meze);
  const rows = meze.map((recipe) => {
    const audit = evaluateMeze(recipe, duplicateSlugSet, duplicateTitleSet);
    const publicOk = recipe.status === 'active' && recipe.isPublic === true;
    const payloadOk = !!recipe.gris && recipe.ingredients.length > 0 && (recipe.steps.length > 0 || audit.grisStepCount > 0);
    const searchOk = recipe.searchTerms.length > 0 || !!audit.slug;
    return { ...audit, publicOk, payloadOk, searchOk };
  });
  const published = rows.filter((row) => row.publicOk);
  const stillReviewOnly = rows.filter((row) => !row.publicOk);
  const blockers = rows.filter((row) => row.publicOk && row.finalState !== 'READY_TO_PUBLISH_AS_IS');
  const apiFailures = rows.filter((row) => row.publicOk && !row.payloadOk);
  const searchFailures = rows.filter((row) => row.publicOk && !row.searchOk);
  const regression = await regressionStatus();
  const ok = counts.totalRecipes === 639 && counts.ingredientCount === 1084 && counts.mezeTotal === 50 && blockers.length === 0 && apiFailures.length === 0 && searchFailures.length === 0 && regression.gamaj === 'PASS' && regression.qeymeh === 'PASS';

  writeJson('meze50_post_audit.json', { generatedAt, ok, counts, publishedCount: published.length, stillReviewOnlyCount: stillReviewOnly.length, blockers, apiFailures, searchFailures, regression, rows });
  writeMd('meze50_post_audit.md', `# Meze 50 Post-Audit

- generatedAt: ${generatedAt}
- verdict: ${ok ? 'PASS' : 'FAIL'}
- total recipes: ${counts.totalRecipes}
- active/public: ${counts.activePublic}
- draft/private/review: ${counts.draftPrivate}
- ingredient count: ${counts.ingredientCount}
- Meze total: ${counts.mezeTotal}
- Meze published: ${published.length}
- Meze still reviewOnly: ${stillReviewOnly.length}
- unresolved public blockers: ${blockers.length}
- API/source payload failures: ${apiFailures.length}
- search smoke failures: ${searchFailures.length}
- Gamaj/Qeymeh regression: ${regression.gamaj}/${regression.qeymeh}

| # | Public | Audit | Payload | Search | Title | Slug | Blocker |
|---:|---|---|---|---|---|---|---|
${rows.map((row, index) => `| ${index + 1} | ${row.publicOk ? 'PASS' : 'HIDDEN'} | ${row.finalState === 'READY_TO_PUBLISH_AS_IS' ? 'PASS' : 'FAIL'} | ${row.payloadOk ? 'PASS' : 'FAIL'} | ${row.searchOk ? 'PASS' : 'FAIL'} | ${row.titleFa} | ${row.slug} | ${row.exactBlocker || '-'} |`).join('\n')}
`);
  writeMd('meze50_api_search_smoke.md', `# Meze 50 API/Search Smoke

- generatedAt: ${generatedAt}
- published Meze checked: ${published.length}
- still-reviewOnly Meze excluded from public API expectation: ${stillReviewOnly.length}
- API/source payload failures: ${apiFailures.length}
- search failures: ${searchFailures.length}
- verdict: ${apiFailures.length === 0 && searchFailures.length === 0 ? 'PASS' : 'FAIL'}

| # | Payload | Search | Public | Title | Slug |
|---:|---|---|---|---|---|
${rows.map((row, index) => `| ${index + 1} | ${row.payloadOk ? 'PASS' : 'FAIL'} | ${row.searchOk ? 'PASS' : 'FAIL'} | ${row.publicOk ? 'PASS' : 'HIDDEN'} | ${row.titleFa} | ${row.slug} |`).join('\n')}
`);
  console.log(JSON.stringify({ ok, counts, published: published.length, stillReviewOnly: stillReviewOnly.length, blockers: blockers.length, apiFailures: apiFailures.length, searchFailures: searchFailures.length, regression }, null, 2));
  if (!ok) process.exitCode = 1;
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
