import fs from 'node:fs';
import path from 'node:path';
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
  const counts = await getCounts();
  const loaded = await loadBatchRecipes();
  const rows = loaded.map(({ rule, recipe }) => {
    const result = evaluate(rule, recipe);
    const isPublic = recipe?.status === 'active' && recipe?.isPublic === true;
    const validPublic = isPublic && result.status === 'RESTORE_PUBLIC_AS_IS';
    const validReviewOnly = !isPublic && result.status !== 'RESTORE_PUBLIC_AS_IS';
    return {
      recipeId: recipe?.id ?? null,
      slug: rule.slug,
      titleFa: recipe?.title ?? rule.titleFa,
      expectedState: result.status,
      status: recipe?.status ?? null,
      isPublic: recipe?.isPublic ?? null,
      apiSearchVisibility: isPublic ? 'PUBLIC_VISIBLE' : 'HIDDEN_BY_PUBLIC_FILTER',
      pass: validPublic || validReviewOnly,
      exactBlocker: result.exactBlocker,
    };
  });
  const publicUnresolved = rows.filter((row) => row.isPublic && row.expectedState !== 'RESTORE_PUBLIC_AS_IS');
  const hiddenSafe = rows.filter((row) => !row.isPublic && row.expectedState === 'RESTORE_PUBLIC_AS_IS');
  const regression = await regressionStatus();
  const aiPath = path.resolve(process.cwd(), '..', '..', 'docs', 'qa', 'recipes', 'culinary-authenticity-sprint', 'ai_copy_residue_audit_v1.json');
  const ai = fs.existsSync(aiPath) ? JSON.parse(fs.readFileSync(aiPath, 'utf8')) : { counts: {} };
  const aiCritical = ai.counts?.CRITICAL_USER_VISIBLE_AI_RESIDUE ?? 0;
  const aiHigh = ai.counts?.HIGH_REPEATED_TEMPLATE ?? 0;
  const pass = publicUnresolved.length === 0 && hiddenSafe.length === 0 && regression.gamaj === 'PASS' && regression.qeymeh === 'PASS' && aiCritical === 0 && aiHigh === 0;
  writeJson('batch01_post_audit.json', { generatedAt, counts, restored: rows.filter((r) => r.isPublic).length, stillReviewOnly: rows.filter((r) => !r.isPublic).length, publicUnresolved, hiddenSafe, regression, aiResidue: { critical: aiCritical, high: aiHigh }, pass, rows });
  writeMd('batch01_post_audit.md', `# Batch 01 Post Audit

- generatedAt: ${generatedAt}
- total recipe count: ${counts.totalRecipes}
- active/public count: ${counts.activePublic}
- draft/private/review count: ${counts.draftPrivate}
- ingredient count: ${counts.ingredientCount}
- restored public in batch: ${rows.filter((r) => r.isPublic).length}
- still reviewOnly in batch: ${rows.filter((r) => !r.isPublic).length}
- public unresolved blockers in batch: ${publicUnresolved.length}
- safe-but-hidden in batch: ${hiddenSafe.length}
- Meze public: ${counts.mezePublic}
- Gamaj Kabab regression: ${regression.gamaj}
- Qeymeh Rizeh regression: ${regression.qeymeh}
- AI residue critical/high: ${aiCritical}/${aiHigh}
- final audit verdict: ${pass ? 'PASS' : 'FAIL'}

| # | Visibility | Expected | Title | Slug | Pass | Blocker |
|---:|---|---|---|---|---|---|
${rows.map((row, index) => `| ${index + 1} | ${row.apiSearchVisibility} | ${row.expectedState} | ${row.titleFa} | ${row.slug} | ${row.pass ? 'PASS' : 'FAIL'} | ${row.exactBlocker || '-'} |`).join('\n')}
`);
  writeMd('batch01_api_search_smoke.md', `# Batch 01 API/Search Smoke

- generatedAt: ${generatedAt}
- public API/search gate: status='active' and isPublic=true
- restored recipes visible: ${rows.filter((r) => r.isPublic).length}
- reviewOnly recipes hidden: ${rows.filter((r) => !r.isPublic).length}
- visibility failures: ${rows.filter((r) => !r.pass).length}
- status: ${rows.every((r) => r.pass) ? 'PASS' : 'FAIL'}
`);
  console.log(JSON.stringify({ ok: pass, restored: rows.filter((r) => r.isPublic).length, stillReviewOnly: rows.filter((r) => !r.isPublic).length, publicUnresolved: publicUnresolved.length, hiddenSafe: hiddenSafe.length, regression }, null, 2));
  if (!pass) process.exitCode = 1;
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
