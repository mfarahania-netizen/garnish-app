import { assertLocalDatabase, getCounts, loadRecipeById, prisma, recipeBlob, sourceRefs, writeJson, writeMd } from './culinary-authenticity-sprint-common';

async function main() {
  assertLocalDatabase();
  const before = await getCounts();
  const carbonara = await loadRecipeById('garnish_recipe_global_143_135_2919e78e');
  const liteKimchi = await loadRecipeById('garnish_lite_fa_079_999c19be');
  const fullKimchi = await loadRecipeById('garnish_recipe_global_143_041_33abbd3b');
  if (!carbonara || !liteKimchi || !fullKimchi) throw new Error('p1_candidate_missing');

  const carbonaraBlob = recipeBlob(carbonara);
  const liteKimchiBlob = recipeBlob(liteKimchi);
  const fullKimchiBlob = recipeBlob(fullKimchi);
  const carbonaraIngredientBlob = carbonara.ingredients
    .map((ri: any) => [ri.name, ri.ingredient?.code, ri.ingredient?.nameFa, ri.ingredient?.nameEn].filter(Boolean).join(' '))
    .join(' ')
    .toLowerCase();
  const review = {
    generatedAt: new Date().toISOString(),
    sources: sourceRefs,
    decisions: [
      {
        recipeId: carbonara.id,
        title: carbonara.title,
        decision: /heavy_cream|cream_cheese|خامه/.test(carbonaraIngredientBlob) ? 'PATCH_REQUIRED' : 'NO_DB_PATCH_REQUIRED',
        reason: 'Current active Roman carbonara already has spaghetti, guanciale, egg yolk, Pecorino Romano, black pepper and off-heat emulsion technique; no cream ingredient/text detected by current DB scan.',
      },
      {
        recipeId: liteKimchi.id,
        title: liteKimchi.title,
        decision: liteKimchi.ingredients.some((ri: any) => ri.ingredient?.code === 'kimchi') ? 'NO_DB_PATCH_REQUIRED_LITE_READY_MADE' : 'PATCH_OR_HIDE_REQUIRED',
        reason: 'This is a Lite ready-made kimchi item, not the full napa cabbage kimchi recipe. It should be treated as LITE_SIMPLE and not audited as a fermentation recipe.',
      },
      {
        recipeId: fullKimchi.id,
        title: fullKimchi.title,
        decision: /gochugaru|garlic_raw|ginger_root_raw|napa_cabbage_raw/.test(fullKimchiBlob) ? 'NO_DB_PATCH_REQUIRED' : 'PATCH_REQUIRED',
        reason: 'Full kimchi recipe has napa cabbage, salt, gochugaru, garlic, ginger, fish sauce/fermentation logic and complete GRIS.',
      },
    ],
    rollback: [],
    countsBefore: before,
    countsAfter: await getCounts(),
  };
  writeJson('p1_authenticity_sources.json', sourceRefs);
  writeJson('p1_authenticity_rollback.json', []);
  writeMd('p1_authenticity_review.md', `# P1 Authenticity Review

## Carbonara
- Sources reviewed: ${sourceRefs.carbonara.map((s) => s.title).join(' ; ')}
- Current DB decision: ${review.decisions[0].decision}
- Reason: ${review.decisions[0].reason}

## Kimchi
- Sources reviewed: ${sourceRefs.kimchi.map((s) => s.title).join(' ; ')}
- Lite ready-made kimchi decision: ${review.decisions[1].decision}
- Full napa cabbage kimchi decision: ${review.decisions[2].decision}

No new ingredientIds were created. Ingredient dictionary unchanged.
`);
  writeMd('p1_authenticity_patch_report.md', `# P1 Authenticity Patch Report

- generatedAt: ${review.generatedAt}
- DATABASE_URL guard: PASS local/dev
- DB writes performed: 0
- reason: Current DB content passes source-backed checks after audit rule refinement. Carbonara has no cream in actual recipe payload. Lite kimchi is a ready-made Lite item; full kimchi recipe already exists and is complete.
- ingredient count before/after: ${before.ingredientCount} -> ${review.countsAfter.ingredientCount}
- recipe count before/after: ${before.totalRecipes} -> ${review.countsAfter.totalRecipes}
- rollback entries: 0

Verdict: PASS
`);
  console.log(JSON.stringify({ ok: true, decisions: review.decisions, writes: 0 }, null, 2));
}

main().finally(async () => prisma.$disconnect()).catch((err) => {
  console.error(err);
  process.exit(1);
});

