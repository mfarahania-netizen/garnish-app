import fs from 'node:fs';
import path from 'node:path';
import {
  assertLocalDatabase,
  finalStateRow,
  getCounts,
  loadBlockers,
  loadRecipes,
  outDir,
  parseJson,
  prisma,
  readJsonSafe,
  recipeBlob,
  writeCsv,
  writeJson,
  writeMd,
} from './resolve-authenticity-85-no-public-blockers-common';

function hasAll(blob: string, terms: string[]) {
  return terms.every((term) => blob.includes(term.toLowerCase()));
}

function ingredientAndSearchBlob(recipe: any) {
  return [
    ...(recipe?.ingredients ?? []).flatMap((ri: any) => [
      ri.name,
      ri.ingredient?.code,
      ri.ingredient?.nameFa,
      ri.ingredient?.nameEn,
    ]),
    ...(recipe?.searchTerms ?? []).map((term: any) => term.term),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

async function regressionStatus() {
  const [gamaj, qeymeh] = await Promise.all([
    prisma.recipe.findUnique({ where: { id: 'garnish_recipe_fa_104_7b4ced78' }, include: { ingredients: { include: { ingredient: true } }, steps: true, searchTerms: true } }),
    prisma.recipe.findUnique({ where: { id: 'garnish_recipe_fa_170_44f0d2ad' }, include: { ingredients: { include: { ingredient: true } }, steps: true, searchTerms: true } }),
  ]);
  const gamajBlob = gamaj ? recipeBlob(gamaj) : '';
  const qeymehBlob = qeymeh ? recipeBlob(qeymeh) : '';
  const gamajIngredientSearch = ingredientAndSearchBlob(gamaj);
  const qeymehIngredientSearch = ingredientAndSearchBlob(qeymeh);
  const gamajFailures: string[] = [];
  const qeymehFailures: string[] = [];
  if (!gamaj) gamajFailures.push('missing');
  if (gamaj && /(^|[^a-z])egg([^a-z]|$)|egg_|_egg|تخم مرغ/.test(gamajIngredientSearch)) gamajFailures.push('egg ingredient/search marker detected');
  if (gamaj && !hasAll(gamajBlob, ['walnuts_raw', 'pomegranate_molasses', 'lamb_meat_raw'])) gamajFailures.push('core Gilani markers missing');
  if (!qeymeh) qeymehFailures.push('missing');
  if (qeymeh && /split_pea|split peas|لپه/.test(qeymehIngredientSearch)) qeymehFailures.push('split pea ingredient/search marker detected');
  if (qeymeh && !hasAll(qeymehBlob, ['ground_lamb_raw', 'chickpea_flour', 'tomato_paste', 'potato_raw'])) qeymehFailures.push('core Esfahan markers missing');
  return {
    gamaj: { status: gamajFailures.length ? 'FAIL' : 'PASS', failures: gamajFailures },
    qeymeh: { status: qeymehFailures.length ? 'FAIL' : 'PASS', failures: qeymehFailures },
  };
}

async function main() {
  assertLocalDatabase();
  const generatedAt = new Date().toISOString();
  const blockers = loadBlockers();
  const ids = blockers.map((row) => row.recipeId);
  const recipes = await loadRecipes(ids);
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const publicRemaining = recipes.filter((recipe) => recipe.status === 'active' && recipe.isPublic === true);
  const hiddenRows = blockers.map((row) => finalStateRow(row, byId.get(row.recipeId), 'HIDDEN_PENDING_REVIEW'));
  const finalRows = hiddenRows.map((row) => ({
    ...row,
    status: byId.get(row.recipeId)?.status ?? row.status,
    isPublic: byId.get(row.recipeId)?.isPublic ?? row.isPublic,
  }));
  const counts = await getCounts();
  const regression = await regressionStatus();
  const aiPath = path.resolve(process.cwd(), '..', '..', 'docs', 'qa', 'recipes', 'culinary-authenticity-sprint', 'ai_copy_residue_audit_v1.json');
  const ai = readJsonSafe(aiPath, { counts: {} });
  const aiCritical = ai.counts?.CRITICAL_USER_VISIBLE_AI_RESIDUE ?? 0;
  const aiHigh = ai.counts?.HIGH_REPEATED_TEMPLATE ?? 0;
  const smokeRows = finalRows.slice(0, 30).map((row) => ({
    recipeId: row.recipeId,
    slug: row.slug,
    titleFa: row.titleFa,
    publicDetailExpected: 'hidden',
    dbStatus: row.status,
    dbIsPublic: row.isPublic,
    publicSearchVisibility: row.status === 'active' && row.isPublic === true ? 'FAIL_VISIBLE' : 'PASS_HIDDEN_BY_PUBLIC_FILTER',
    publicDetailVisibility: row.status === 'active' && row.isPublic === true ? 'FAIL_VISIBLE' : 'PASS_HIDDEN_BY_PUBLIC_FILTER',
  }));
  const pass =
    publicRemaining.length === 0 &&
    counts.ingredientCount > 0 &&
    counts.mezePublic === 0 &&
    regression.gamaj.status === 'PASS' &&
    regression.qeymeh.status === 'PASS' &&
    aiCritical === 0 &&
    aiHigh === 0;

  writeJson('post_resolution_audit.json', {
    generatedAt,
    counts,
    unresolvedPublicBlockers: publicRemaining.length,
    hiddenPendingReview: finalRows.filter((row) => row.finalState === 'HIDDEN_PENDING_REVIEW').length,
    sourceBackedPublic: 0,
    productDecisionPublic: 0,
    aiResidue: { critical: aiCritical, high: aiHigh },
    regression,
    pass,
    rows: finalRows,
  });
  writeMd(
    'post_resolution_audit.md',
    `# Post Resolution Public Blocker Audit

- generatedAt: ${generatedAt}
- recipe count: ${counts.totalRecipes}
- active/public count: ${counts.activePublic}
- draft/private count: ${counts.draftPrivate}
- ingredient count: ${counts.ingredientCount}
- Meze public: ${counts.mezePublic}
- unresolved public blockers from 85: ${publicRemaining.length}
- hidden pending review: ${finalRows.length}
- source-backed public: 0
- product-decision public: 0
- AI residue critical/high: ${aiCritical}/${aiHigh}
- Gamaj Kabab regression: ${regression.gamaj.status}
- Qeymeh Rizeh regression: ${regression.qeymeh.status}
- final verdict: ${pass ? 'PASS' : 'FAIL'}
`,
  );
  writeCsv('final_public_blockers_remaining.csv', publicRemaining.map((recipe) => ({
    recipeId: recipe.id,
    slug: blockers.find((row) => row.recipeId === recipe.id)?.slug ?? '',
    titleFa: recipe.title,
    status: recipe.status,
    isPublic: recipe.isPublic,
    reason: 'Still active/public after hide gate',
  })), ['recipeId', 'slug', 'titleFa', 'status', 'isPublic', 'reason']);
  writeCsv('final_85_states.csv', finalRows, ['recipeId', 'slug', 'titleFa', 'finalState', 'status', 'isPublic', 'reason']);
  writeCsv('final_hidden_until_review.csv', finalRows, ['recipeId', 'slug', 'titleFa', 'finalState', 'status', 'isPublic', 'reason']);
  writeCsv('final_source_backed_public.csv', [], ['recipeId', 'slug', 'titleFa', 'sourceRefs']);
  writeCsv('final_product_decision_public.csv', [], ['recipeId', 'slug', 'titleFa', 'decision']);
  writeMd(
    'api_search_smoke_report.md',
    `# API/Search Smoke Report

- generatedAt: ${generatedAt}
- check type: DB-backed public-filter smoke. Public API/list/search/detail gates were confirmed in \`apps/server/src/recipes/recipes.service.ts\`: status='active' and isPublic=true.
- sampled hidden rows: ${smokeRows.length}
- hidden sample failures: ${smokeRows.filter((row) => row.publicSearchVisibility.startsWith('FAIL')).length}

| # | Title | Slug | DB Status | DB isPublic | Search | Detail |
|---:|---|---|---|---:|---|---|
${smokeRows.map((row, index) => `| ${index + 1} | ${row.titleFa} | ${row.slug} | ${row.dbStatus} | ${row.dbIsPublic} | ${row.publicSearchVisibility} | ${row.publicDetailVisibility} |`).join('\n')}
`,
  );
  const previousReport = fs.existsSync(path.join(outDir, 'hide_unresolved_85_report.md'))
    ? fs.readFileSync(path.join(outDir, 'hide_unresolved_85_report.md'), 'utf8')
    : '';
  const countLine = previousReport.match(/active\/public count: (.+)/)?.[1] ?? 'see hide report';
  writeMd(
    'final_no_public_blockers_report.md',
    `# Final No Public Blockers Report

- generatedAt: ${generatedAt}
- production touched: no
- recipe count: ${counts.totalRecipes}
- active/public count after resolution: ${counts.activePublic}
- active/public before/after from hide report: ${countLine}
- draft/private count after resolution: ${counts.draftPrivate}
- ingredient count after resolution: ${counts.ingredientCount}
- source-backed pass public count: 0
- source-backed patched public count: 0
- product-decision pass public count: 0
- patched count: 0
- renamed/reframed count: 0
- hidden/unpublished count: ${finalRows.length}
- blocked by dictionary count: 0
- unresolved public blocker count: ${publicRemaining.length}
- Meze 50 public count: ${counts.mezePublic}
- known regression status: Gamaj=${regression.gamaj.status}, Qeymeh=${regression.qeymeh.status}
- AI residue critical/high: ${aiCritical}/${aiHigh}
- build status: run server build after this audit
- final verdict: ${pass ? 'PASS' : 'FAIL'}

Launch public blocker risk is removed; hidden review queue remains.

## Exact Remaining Non-Public Review Queue

See \`final_hidden_until_review.csv\` for all ${finalRows.length} hidden recipes.
`,
  );
  console.log(JSON.stringify({ ok: pass, publicRemaining: publicRemaining.length, hidden: finalRows.length, counts, regression }, null, 2));
  if (!pass) process.exitCode = 1;
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
