import { assertLocalDatabase, evaluate, getCounts, loadRecipes, prisma, redactedDbUrl, regressionStatus, rollbackEntry, rules, writeJson, writeMd } from './batch02-iranian-trust-common';

async function main() {
  assertLocalDatabase();
  const generatedAt = new Date().toISOString();
  const counts = await getCounts();
  const loaded = await loadRecipes();
  const rows = loaded.map(({ rule, recipe }) => {
    const result = evaluate(rule, recipe);
    return { scope: rule.scope, recipeId: recipe?.id ?? null, slug: rule.slug, titleFa: recipe?.title ?? rule.titleFa, currentStatus: recipe?.status ?? null, currentIsPublic: recipe?.isPublic ?? null, classification: result.status, missingSignals: result.missing, exactBlocker: result.exactBlocker };
  });
  const statusCounts = rows.reduce((acc: Record<string, number>, row) => { const k = `${row.scope}_${row.classification}`; acc[k] = (acc[k] ?? 0) + 1; return acc; }, {});
  const rollback = loaded.filter((x) => x.recipe).map(({ rule, recipe }) => rollbackEntry(recipe, rule.slug));
  const regression = await regressionStatus();
  writeJson('batch02_rollback.json', { generatedAt, databaseUrl: redactedDbUrl(), countsBefore: counts, entries: rollback });
  writeJson('batch02_audit_before.json', { generatedAt, counts, statusCounts, regression, rows });
  writeMd('preflight.md', `# Batch 01 Fix3 + Batch 02 Preflight

- generatedAt: ${generatedAt}
- DATABASE_URL guard: PASS local/dev (${redactedDbUrl()})
- total recipe count: ${counts.totalRecipes}
- active/public count: ${counts.activePublic}
- draft/private/review count: ${counts.draftPrivate}
- ingredient count: ${counts.ingredientCount}
- Meze public count: ${counts.mezePublic}
- scope size: ${rules.length}
- rollback entries: ${rollback.length}
`);
  writeMd('batch02_audit_before.md', `# Batch 01 Fix3 + Batch 02 Audit Before Apply

- generatedAt: ${generatedAt}
- Scope A restore-ready before patch: ${rows.filter((r) => r.scope === 'A' && r.classification === 'RESTORE_PUBLIC_AS_IS').length}
- Scope A needs patch/review: ${rows.filter((r) => r.scope === 'A' && r.classification !== 'RESTORE_PUBLIC_AS_IS').length}
- Scope B restore-ready as-is: ${rows.filter((r) => r.scope === 'B' && r.classification === 'RESTORE_PUBLIC_AS_IS').length}
- Scope B keep reviewOnly: ${rows.filter((r) => r.scope === 'B' && r.classification !== 'RESTORE_PUBLIC_AS_IS').length}
- Gamaj Kabab regression: ${regression.gamaj}
- Qeymeh Rizeh regression: ${regression.qeymeh}

| # | Scope | State | Title | Slug | Blocker |
|---:|---|---|---|---|---|
${rows.map((row, i) => `| ${i + 1} | ${row.scope} | ${row.classification} | ${row.titleFa} | ${row.slug} | ${row.exactBlocker || '-'} |`).join('\n')}
`);
  console.log(JSON.stringify({ ok: true, statusCounts, regression }, null, 2));
}

main().finally(async () => prisma.$disconnect()).catch((err) => { console.error(err); process.exit(1); });
