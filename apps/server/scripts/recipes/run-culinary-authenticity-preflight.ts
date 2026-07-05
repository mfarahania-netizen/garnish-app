import { activePublicRecipes, adminSlug, assertLocalDatabase, getCounts, prisma, writeJson, writeMd } from './culinary-authenticity-sprint-common';

async function main() {
  const dbUrl = assertLocalDatabase();
  const counts = await getCounts();
  const candidates = await activePublicRecipes();
  const meze = await prisma.recipe.findMany({
    where: { id: { startsWith: 'meze50_' } },
    include: { ingredients: { include: { ingredient: true } }, steps: true, searchTerms: true },
    orderBy: { id: 'asc' },
  });
  const snapshot = {
    generatedAt: new Date().toISOString(),
    databaseUrlMasked: dbUrl.replace(/:\/\/.*@/, '://***@'),
    productionTouched: false,
    counts,
    candidateRecipes: candidates
      .filter((r) => ['garnish_recipe_fa_104_7b4ced78', 'garnish_recipe_fa_170_44f0d2ad', 'garnish_recipe_global_143_135_2919e78e', 'garnish_lite_fa_079_999c19be', 'garnish_recipe_global_143_041_33abbd3b'].includes(r.id))
      .map((r) => ({ id: r.id, slug: adminSlug(r), title: r.title, status: r.status, isPublic: r.isPublic, ingredients: r.ingredients.length, steps: r.steps.length })),
    meze: meze.map((r) => ({ id: r.id, slug: adminSlug(r), title: r.title, status: r.status, isPublic: r.isPublic, ingredients: r.ingredients.length, steps: r.steps.length })),
  };
  writeJson('preflight_snapshot.json', snapshot);
  writeMd('preflight_report.md', `# Culinary Authenticity Sprint Preflight

- generatedAt: ${snapshot.generatedAt}
- DB guard: PASS, local/dev only
- production touched: no
- total recipes: ${counts.totalRecipes}
- active/public recipes: ${counts.activePublic}
- draft/private recipes: ${counts.draftPrivate}
- ingredient count: ${counts.ingredientCount}
- Meze 50 rows: ${counts.mezeTotal}
- Meze public rows: ${counts.mezePublic}
- Meze non-draft rows: ${counts.mezeNonDraft}

Verdict: PASS. The sprint may proceed on local/dev DB only.
`);
  console.log(JSON.stringify({ ok: true, counts }, null, 2));
}

main().finally(async () => prisma.$disconnect()).catch((err) => {
  console.error(err);
  process.exit(1);
});

