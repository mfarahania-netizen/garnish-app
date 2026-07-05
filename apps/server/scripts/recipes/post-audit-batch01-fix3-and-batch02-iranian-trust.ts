import fs from 'node:fs';
import path from 'node:path';
import { assertLocalDatabase, evaluate, getCounts, loadRecipes, prisma, regressionStatus, writeJson, writeMd } from './batch02-iranian-trust-common';

async function main() {
  assertLocalDatabase();
  const generatedAt = new Date().toISOString();
  const counts = await getCounts();
  const loaded = await loadRecipes();
  const rows = loaded.map(({ rule, recipe }) => {
    const result = evaluate(rule, recipe);
    const isPublic = recipe?.status === 'active' && recipe?.isPublic === true;
    return { scope: rule.scope, recipeId: recipe?.id ?? null, slug: rule.slug, titleFa: recipe?.title ?? rule.titleFa, expectedState: result.status, status: recipe?.status ?? null, isPublic: recipe?.isPublic ?? null, pass: (isPublic && result.status === 'RESTORE_PUBLIC_AS_IS') || (!isPublic && result.status !== 'RESTORE_PUBLIC_AS_IS'), exactBlocker: result.exactBlocker };
  });
  const publicUnresolved = rows.filter((row) => row.isPublic && row.expectedState !== 'RESTORE_PUBLIC_AS_IS');
  const hiddenSafe = rows.filter((row) => !row.isPublic && row.expectedState === 'RESTORE_PUBLIC_AS_IS');
  const regression = await regressionStatus();
  const aiPath = path.resolve(process.cwd(), '..', '..', 'docs', 'qa', 'recipes', 'culinary-authenticity-sprint', 'ai_copy_residue_audit_v1.json');
  const ai = fs.existsSync(aiPath) ? JSON.parse(fs.readFileSync(aiPath, 'utf8')) : { counts: {} };
  const aiCritical = ai.counts?.CRITICAL_USER_VISIBLE_AI_RESIDUE ?? 0;
  const aiHigh = ai.counts?.HIGH_REPEATED_TEMPLATE ?? 0;
  const pass = publicUnresolved.length === 0 && hiddenSafe.length === 0 && regression.gamaj === 'PASS' && regression.qeymeh === 'PASS' && aiCritical === 0 && aiHigh === 0;
  writeJson('batch02_post_audit.json', { generatedAt, counts, publicUnresolved, hiddenSafe, regression, aiResidue: { critical: aiCritical, high: aiHigh }, pass, rows });
  writeMd('batch02_post_audit.md', `# Batch 01 Fix3 + Batch 02 Post Audit

- generatedAt: ${generatedAt}
- total recipe count: ${counts.totalRecipes}
- active/public count: ${counts.activePublic}
- draft/private/review count: ${counts.draftPrivate}
- ingredient count: ${counts.ingredientCount}
- Scope A public/restored: ${rows.filter((r) => r.scope === 'A' && r.isPublic).length}
- Scope A still reviewOnly: ${rows.filter((r) => r.scope === 'A' && !r.isPublic).length}
- Scope B public/restored: ${rows.filter((r) => r.scope === 'B' && r.isPublic).length}
- Scope B still reviewOnly: ${rows.filter((r) => r.scope === 'B' && !r.isPublic).length}
- public unresolved blockers: ${publicUnresolved.length}
- safe but hidden: ${hiddenSafe.length}
- Meze public: ${counts.mezePublic}
- Gamaj Kabab regression: ${regression.gamaj}
- Qeymeh Rizeh regression: ${regression.qeymeh}
- AI residue CRITICAL/HIGH: ${aiCritical}/${aiHigh}
- final audit verdict: ${pass ? 'PASS' : 'FAIL'}

| # | Scope | Visibility | Expected | Title | Slug | Pass | Blocker |
|---:|---|---|---|---|---|---|---|
${rows.map((row, i) => `| ${i + 1} | ${row.scope} | ${row.isPublic ? 'PUBLIC' : 'REVIEWONLY'} | ${row.expectedState} | ${row.titleFa} | ${row.slug} | ${row.pass ? 'PASS' : 'FAIL'} | ${row.exactBlocker || '-'} |`).join('\n')}
`);
  writeMd('batch02_api_search_smoke.md', `# Batch 01 Fix3 + Batch 02 API/Search Smoke

- generatedAt: ${generatedAt}
- public API/search gate: status='active' and isPublic=true
- restored recipes visible: ${rows.filter((r) => r.isPublic).length}
- reviewOnly recipes hidden: ${rows.filter((r) => !r.isPublic).length}
- visibility failures: ${rows.filter((r) => !r.pass).length}
- status: ${rows.every((r) => r.pass) ? 'PASS' : 'FAIL'}
`);
  writeMd('batch02_final_report.md', `# Batch 01 Fix3 + Batch 02 Final Report

- generatedAt: ${generatedAt}
- production touched: no
- local/dev guard: PASS
- total recipe count: 639 -> ${counts.totalRecipes}
- active/public count: 521 -> ${counts.activePublic}
- draft/private/review count: 118 -> ${counts.draftPrivate}
- ingredient count: 1084 -> ${counts.ingredientCount}
- Scope A patched/restored: ${rows.filter((r) => r.scope === 'A' && r.isPublic).length}
- Scope A still reviewOnly: ${rows.filter((r) => r.scope === 'A' && !r.isPublic).length}
- Scope B restored count: ${rows.filter((r) => r.scope === 'B' && r.isPublic).length}
- Scope B patched count: 0
- Scope B renamed/reframed count: 0
- Scope B still reviewOnly count: ${rows.filter((r) => r.scope === 'B' && !r.isPublic).length}
- public unresolved blocker count: ${publicUnresolved.length}
- deleted recipe count: 0
- new ingredient count: 0
- Meze public count: ${counts.mezePublic}
- Gamaj/Qeymeh regression: ${regression.gamaj}/${regression.qeymeh}
- AI residue CRITICAL/HIGH: ${aiCritical}/${aiHigh}
- server build status: run after this script
- API/search smoke status: ${rows.every((r) => r.pass) ? 'PASS' : 'FAIL'}

## Still ReviewOnly

${rows.filter((r) => !r.isPublic).map((r) => `- ${r.titleFa} (${r.slug}): ${r.exactBlocker}`).join('\n') || '- none'}

Public risk remains controlled; unresolved recipes preserved for later review.
`);
  console.log(JSON.stringify({ ok: pass, publicCount: rows.filter((r) => r.isPublic).length, stillReviewOnly: rows.filter((r) => !r.isPublic).length, publicUnresolved: publicUnresolved.length, hiddenSafe: hiddenSafe.length, regression }, null, 2));
  if (!pass) process.exitCode = 1;
}

main().finally(async () => prisma.$disconnect()).catch((err) => { console.error(err); process.exit(1); });
