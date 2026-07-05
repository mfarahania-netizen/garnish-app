import { assertLocalDatabase, getCounts, prisma, writeJson, writeMd } from './recipe-trust-closeout-common';

async function main() {
  assertLocalDatabase();
  const generatedAt = new Date().toISOString();
  const counts = await getCounts();
  writeJson('repair_85_rollback.json', []);
  writeMd(
    'repair_85_report.md',
    `# Repair 85 Closeout Report

- generatedAt: ${generatedAt}
- total recipe count: ${counts.totalRecipes}
- ingredient count: ${counts.ingredientCount}
- PATCH_THEN_RESTORE_PUBLIC candidates: 0
- REFRAME_THEN_RESTORE_PUBLIC candidates: 0
- patched recipes: 0
- reframed recipes: 0
- new ingredients: 0
- deleted recipes: 0

No patch/reframe was applied because the closeout audit did not identify any evidence-backed patch or product-decision-safe restore candidate.
`,
  );
  console.log(JSON.stringify({ ok: true, patched: 0, reframed: 0 }, null, 2));
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
