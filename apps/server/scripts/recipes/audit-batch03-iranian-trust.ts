import { assertLocalDatabase, evaluate, getCounts, loadRecipes, prisma, redactedDbUrl, regressionStatus, rollbackEntry, rules, writeJson, writeMd } from './batch03-iranian-trust-common';

async function main() {
  assertLocalDatabase();
  const generatedAt = new Date().toISOString();
  const counts = await getCounts();
  const loaded = await loadRecipes();
  const rows = loaded.map(({ rule, recipe }) => {
    const result = evaluate(rule, recipe);
    return { scope: rule.scope, recipeId: recipe?.id ?? null, slug: rule.slug, titleFa: recipe?.title ?? rule.titleFa, currentStatus: recipe?.status ?? null, currentIsPublic: recipe?.isPublic ?? null, classification: result.status, missingSignals: result.missing, exactBlocker: result.exactBlocker };
  });
  const rollback = loaded.filter((x) => x.recipe).map(({ rule, recipe }) => rollbackEntry(recipe, rule.slug));
  const regression = await regressionStatus();
  writeJson('batch03_rollback.json', { generatedAt, databaseUrl: redactedDbUrl(), countsBefore: counts, entries: rollback });
  writeJson('batch03_audit_before.json', { generatedAt, counts, regression, rows });
  writeMd('preflight.md', `# Batch03 Preflight

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
  writeMd('batch03_audit_before.md', `# Batch03 Audit Before Apply

- generatedAt: ${generatedAt}
- Scope A restore-ready before patch: ${rows.filter((r) => r.scope === 'A' && r.classification === 'RESTORE_PUBLIC_AS_IS').length}
- Scope A needs patch/review: ${rows.filter((r) => r.scope === 'A' && r.classification !== 'RESTORE_PUBLIC_AS_IS').length}
- Scope B restore-ready as-is: ${rows.filter((r) => r.scope === 'B' && r.classification === 'RESTORE_PUBLIC_AS_IS').length}
- Scope B keep reviewOnly: ${rows.filter((r) => r.scope === 'B' && r.classification !== 'RESTORE_PUBLIC_AS_IS').length}
- Gamaj/Qeymeh regression: ${regression.gamaj}/${regression.qeymeh}

| # | Scope | State | Title | Slug | Blocker |
|---:|---|---|---|---|---|
${rows.map((row, i) => `| ${i + 1} | ${row.scope} | ${row.classification} | ${row.titleFa} | ${row.slug} | ${row.exactBlocker || '-'} |`).join('\n')}
`);
  console.log(JSON.stringify({ ok: true, rows: rows.length, restoreReady: rows.filter((r) => r.classification === 'RESTORE_PUBLIC_AS_IS').length, regression }, null, 2));
}

main().finally(async () => prisma.$disconnect()).catch((err) => { console.error(err); process.exit(1); });
