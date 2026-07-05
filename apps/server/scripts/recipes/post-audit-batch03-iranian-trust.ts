import {
  assertLocalDatabase,
  evaluate,
  getCounts,
  loadRecipes,
  prisma,
  recipeBlob,
  regressionStatus,
  rules,
  textValues,
  writeJson,
  writeMd,
} from './batch03-iranian-trust-common';

function hasMarker(recipe: any, code: string, ingredientId: string) {
  const blob = textValues(recipe?.ingredients?.map((ri: any) => [
    ri.ingredientId,
    ri.ingredient?.code,
    ri.name,
    ri.notes,
  ])).toLowerCase();
  return blob.includes(code.toLowerCase()) && blob.includes(ingredientId.toLowerCase());
}

async function main() {
  assertLocalDatabase();
  const generatedAt = new Date().toISOString();
  const counts = await getCounts();
  const loaded = await loadRecipes();
  const regression = await regressionStatus();
  const evaluated = loaded.map(({ rule, recipe }) => {
    const result = evaluate(rule, recipe);
    const publicOk = !!recipe && recipe.status === 'active' && recipe.isPublic === true;
    const baselineOk = result.status === 'RESTORE_PUBLIC_AS_IS';
    return {
      scope: rule.scope,
      recipeId: recipe?.id ?? null,
      slug: rule.slug,
      titleFa: recipe?.title ?? rule.titleFa,
      status: recipe?.status ?? null,
      isPublic: recipe?.isPublic ?? null,
      baselineOk,
      publicOk,
      exactBlocker: result.exactBlocker || '',
      missing: result.missing,
    };
  });

  const markerChecks = {
    'ghanbar-polo-shirazi': {
      walnuts: hasMarker(loaded.find((row) => row.rule.slug === 'ghanbar-polo-shirazi')?.recipe, 'walnuts_raw', 'ing_walnuts_raw'),
      pomegranateMolasses: hasMarker(loaded.find((row) => row.rule.slug === 'ghanbar-polo-shirazi')?.recipe, 'pomegranate_molasses', 'ing_pomegranate_molasses'),
    },
    vavishka: {
      egg: hasMarker(loaded.find((row) => row.rule.slug === 'vavishka')?.recipe, 'whole_egg_raw', 'ing_whole_egg_raw'),
    },
  };

  const apiPayloadRows = loaded.map(({ rule, recipe }) => ({
    slug: rule.slug,
    recipeId: recipe?.id ?? null,
    titleFa: recipe?.title ?? null,
    payloadOk: !!recipe && !!recipe.id && !!recipe.title && !!recipe.gris && Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0 && Array.isArray(recipe.steps),
    ingredientCount: recipe?.ingredients?.length ?? 0,
    stepCount: recipe?.steps?.length ?? 0,
    hasPublicVisibility: recipe?.status === 'active' && recipe?.isPublic === true,
  }));

  const searchRows = loaded.map(({ rule, recipe }) => {
    const slug = rule.slug.toLowerCase();
    const blob = recipe ? recipeBlob(recipe) : '';
    return {
      slug: rule.slug,
      titleFa: recipe?.title ?? rule.titleFa,
      searchable: !!recipe && blob.includes(slug.replace(/-/g, ' ')) || !!recipe && blob.includes(slug),
      publicVisible: recipe?.status === 'active' && recipe?.isPublic === true,
    };
  });

  const blockers = evaluated.filter((row) => !row.baselineOk || !row.publicOk);
  const apiFailures = apiPayloadRows.filter((row) => !row.payloadOk || !row.hasPublicVisibility);
  const searchFailures = searchRows.filter((row) => !row.searchable || !row.publicVisible);
  const markerFailures = [
    markerChecks['ghanbar-polo-shirazi'].walnuts,
    markerChecks['ghanbar-polo-shirazi'].pomegranateMolasses,
    markerChecks.vavishka.egg,
  ].filter(Boolean).length !== 3;
  const ok = blockers.length === 0 && apiFailures.length === 0 && searchFailures.length === 0 && !markerFailures && regression.gamaj === 'PASS' && regression.qeymeh === 'PASS';

  writeJson('batch03_post_audit.json', { generatedAt, ok, counts, regression, markerChecks, evaluated, apiPayloadRows, searchRows, blockers, apiFailures, searchFailures });
  writeMd('batch03_post_audit.md', `# Batch03 Post-Audit

- generatedAt: ${generatedAt}
- verdict: ${ok ? 'PASS' : 'FAIL'}
- total recipes: ${counts.totalRecipes}
- active/public: ${counts.activePublic}
- draft/private/review: ${counts.draftPrivate}
- ingredient count: ${counts.ingredientCount}
- evaluated recipes: ${evaluated.length}
- public restored: ${evaluated.filter((row) => row.publicOk).length}/${rules.length}
- unresolved blockers: ${blockers.length}
- API payload failures: ${apiFailures.length}
- search smoke failures: ${searchFailures.length}
- marker failures: ${markerFailures ? 'yes' : 'no'}
- Gamaj/Qeymeh regression: ${regression.gamaj}/${regression.qeymeh}

## Marker Checks

- ghanbar-polo-shirazi walnuts_raw / ing_walnuts_raw: ${markerChecks['ghanbar-polo-shirazi'].walnuts ? 'PASS' : 'FAIL'}
- ghanbar-polo-shirazi pomegranate_molasses / ing_pomegranate_molasses: ${markerChecks['ghanbar-polo-shirazi'].pomegranateMolasses ? 'PASS' : 'FAIL'}
- vavishka whole_egg_raw / ing_whole_egg_raw: ${markerChecks.vavishka.egg ? 'PASS' : 'FAIL'}

## Rows

| # | Scope | Public | Baseline | API payload | Search | Title | Slug | Blocker |
|---:|---|---|---|---|---|---|---|---|
${evaluated.map((row, index) => {
  const api = apiPayloadRows.find((item) => item.slug === row.slug);
  const search = searchRows.find((item) => item.slug === row.slug);
  return `| ${index + 1} | ${row.scope} | ${row.publicOk ? 'PASS' : 'FAIL'} | ${row.baselineOk ? 'PASS' : 'FAIL'} | ${api?.payloadOk ? 'PASS' : 'FAIL'} | ${search?.searchable ? 'PASS' : 'FAIL'} | ${row.titleFa} | ${row.slug} | ${row.exactBlocker || '-'} |`;
}).join('\n')}
`);

  writeMd('batch03_api_search_smoke.md', `# Batch03 API/Search Smoke

- generatedAt: ${generatedAt}
- API/source payload rows checked: ${apiPayloadRows.length}
- API/source payload failures: ${apiFailures.length}
- search smoke rows checked: ${searchRows.length}
- search smoke failures: ${searchFailures.length}

## API Payload Rows

| # | Payload | Public | Ingredients | Steps | Title | Slug |
|---:|---|---|---:|---:|---|---|
${apiPayloadRows.map((row, index) => `| ${index + 1} | ${row.payloadOk ? 'PASS' : 'FAIL'} | ${row.hasPublicVisibility ? 'PASS' : 'FAIL'} | ${row.ingredientCount} | ${row.stepCount} | ${row.titleFa} | ${row.slug} |`).join('\n')}

## Search Rows

| # | Searchable | Public | Title | Slug |
|---:|---|---|---|---|
${searchRows.map((row, index) => `| ${index + 1} | ${row.searchable ? 'PASS' : 'FAIL'} | ${row.publicVisible ? 'PASS' : 'FAIL'} | ${row.titleFa} | ${row.slug} |`).join('\n')}
`);

  console.log(JSON.stringify({ ok, counts, blockers: blockers.length, apiFailures: apiFailures.length, searchFailures: searchFailures.length, markerFailures, regression }, null, 2));
  if (!ok) process.exitCode = 1;
}

main().finally(async () => prisma.$disconnect()).catch((err) => {
  console.error(err);
  process.exit(1);
});
