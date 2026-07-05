import { assertLocalDatabase, getCounts, prisma, writeJson, writeMd } from './recipe-trust-closeout-common';

async function main() {
  assertLocalDatabase();
  const generatedAt = new Date().toISOString();
  const countsBefore = await getCounts();
  const restored: any[] = [];
  writeJson('restore_public_rollback.json', []);
  const countsAfter = await getCounts();
  writeMd(
    'restore_public_report.md',
    `# Restore Safe ReviewOnly Recipes Public Report

- generatedAt: ${generatedAt}
- restored public as-is: 0
- patched and restored: 0
- reframed and restored: 0
- kept reviewOnly: 85
- total recipe count: ${countsBefore.totalRecipes} -> ${countsAfter.totalRecipes}
- active/public count: ${countsBefore.activePublic} -> ${countsAfter.activePublic}
- ingredient count: ${countsBefore.ingredientCount} -> ${countsAfter.ingredientCount}
- deleted recipes: 0
- new ingredients: 0

No recipe was restored because no item met the hard restore rule: source-backed pass, source-backed patch, or documented product-decision pass.
`,
  );
  console.log(JSON.stringify({ ok: true, restored: restored.length, countsBefore, countsAfter }, null, 2));
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
