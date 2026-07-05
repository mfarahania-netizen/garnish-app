import { assertLocalDatabase, getCounts, prisma, writeJson, writeMd } from './resolve-authenticity-85-no-public-blockers-common';

async function main() {
  assertLocalDatabase();
  const generatedAt = new Date().toISOString();
  const counts = await getCounts();
  writeJson('repair_85_final_rollback.json', []);
  writeMd(
    'repair_85_final_report.md',
    `# Repair 85 Final Report

- generatedAt: ${generatedAt}
- DB total recipes: ${counts.totalRecipes}
- ingredient count: ${counts.ingredientCount}
- patch candidates with sufficient evidence: 0
- patched recipes: 0
- renamed/reframed recipes: 0
- new ingredients: 0
- recipe creates: 0
- recipe deletes: 0

No recipe content was patched because no item in the 85 has a three-source-backed or explicit product-decision public pass in the repository. The safe launch action is handled by the hide script.
`,
  );
  console.log(JSON.stringify({ ok: true, patched: 0, renamed: 0 }, null, 2));
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
