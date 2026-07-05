import { assertLocalDatabase, evaluate, getCounts, loadRecipes, parseJson, patchGris, prisma, regressionStatus, textValues, writeJson, writeMd } from './batch02-iranian-trust-common';

const markerBySlug: Record<string, Array<{ label: string; ingredientId: string; code: string; amount: string; unit: string; note: string }>> = {
  'ash-dandooni': [{ label: 'برنج نیم‌دانه', ingredientId: 'ing_basmati_rice_raw', code: 'basmati_rice_raw', amount: '60', unit: 'گرم', note: 'تکمیل هویت چندغله آش دندونی' }],
  'ash-sabzi-shirazi': [
    { label: 'گوشت گوسفندی', ingredientId: 'ing_lamb_meat_raw', code: 'lamb_meat_raw', amount: '250', unit: 'گرم', note: 'پایه گوشتی و کشدار آش سبزی شیرازی' },
    { label: 'برنج نیم‌دانه', ingredientId: 'ing_basmati_rice_raw', code: 'basmati_rice_raw', amount: '80', unit: 'گرم', note: 'لعاب و بافت کشدار آش سبزی شیرازی' },
    { label: 'ترخون تازه', ingredientId: 'ing_tarragon_fresh', code: 'tarragon_fresh', amount: '1', unit: 'دسته کوچک', note: 'عطر مرکزی سبزی شیرازی' },
  ],
  'khoresh-havij-tabrizi': [{ label: 'زعفران', ingredientId: 'ing_saffron', code: 'saffron', amount: '0.25', unit: 'قاشق چای‌خوری', note: 'رنگ و عطر هویت ملس تبریزی' }],
};

function notes(marker: { label: string; ingredientId: string; code: string; note: string }) {
  return JSON.stringify({ line: marker.label, ingredientId: marker.ingredientId, code: marker.code, preparation: marker.note, optional: false, confidence: 0.98, resolverNote: 'batch02_existing_dictionary_marker_patch' });
}

async function main() {
  assertLocalDatabase();
  const generatedAt = new Date().toISOString();
  const countsBefore = await getCounts();
  let loaded = await loadRecipes();
  const usedMarkers: any[] = [];
  const patched: string[] = [];

  await prisma.$transaction(async (tx) => {
    for (const { rule, recipe } of loaded.filter((x) => x.rule.scope === 'A' && x.recipe)) {
      const markers = markerBySlug[rule.slug] ?? [];
      let gris = recipe.gris;
      let changed = false;
      for (const marker of markers) {
        const ingredient = await tx.ingredient.findUnique({ where: { id: marker.ingredientId }, select: { id: true, code: true, nameFa: true } });
        if (!ingredient || ingredient.code !== marker.code) throw new Error(`INGREDIENT_MARKER_NOT_SAFE:${rule.slug}:${marker.ingredientId}`);
        const blob = textValues(recipe.ingredients.map((ri: any) => [ri.ingredientId, ri.ingredient?.code, ri.name])).toLowerCase();
        if (!blob.includes(marker.code)) {
          const maxOrder = Math.max(-1, ...recipe.ingredients.map((ri: any) => ri.order ?? 0));
          await tx.recipeIngredient.create({ data: { recipeId: recipe.id, ingredientId: marker.ingredientId, name: marker.label, amount: marker.amount, unit: marker.unit, notes: notes(marker), order: maxOrder + 1 } });
          changed = true;
          usedMarkers.push({ slug: rule.slug, ingredientId: marker.ingredientId, code: marker.code, label: marker.label });
        }
        gris = patchGris(gris, marker);
      }
      if (markers.length) {
        await tx.recipe.update({ where: { id: recipe.id }, data: { gris } });
        const terms = [rule.slug, rule.titleFa, ...markers.map((m) => m.label), ...markers.map((m) => m.code)];
        for (const term of terms) {
          const existing = await tx.searchTerm.findFirst({ where: { recipeId: recipe.id, term } });
          if (!existing) await tx.searchTerm.create({ data: { recipeId: recipe.id, term } });
        }
        if (changed) await tx.recipeStep.create({ data: { recipeId: recipe.id, title: `تکمیل هویت ${rule.titleFa}`, instruction: markers.map((m) => `${m.label} برای ${m.note} وارد دستور می‌شود.`).join(' '), order: Math.max(-1, ...recipe.steps.map((s: any) => s.order ?? 0)) + 1 } });
        if (changed) patched.push(rule.slug);
      }
    }
  });

  loaded = await loadRecipes();
  const evaluated = loaded.map(({ rule, recipe }) => ({ rule, recipe, result: evaluate(rule, recipe) }));
  const restore = evaluated.filter((row) => row.recipe && row.result.status === 'RESTORE_PUBLIC_AS_IS');
  const keep = evaluated.filter((row) => !row.recipe || row.result.status !== 'RESTORE_PUBLIC_AS_IS');

  await prisma.$transaction(async (tx) => {
    const restoreIds = restore.map((row) => row.recipe.id);
    if (restoreIds.length) await tx.recipe.updateMany({ where: { id: { in: restoreIds } }, data: { status: 'active', isPublic: true } });
    const keepIds = keep.filter((row) => row.recipe).map((row) => row.recipe.id);
    if (keepIds.length) await tx.recipe.updateMany({ where: { id: { in: keepIds } }, data: { status: 'reviewOnly', isPublic: false } });
    const [total, ingredients] = await Promise.all([tx.recipe.count(), tx.ingredient.count()]);
    if (total !== countsBefore.totalRecipes) throw new Error(`RECIPE_COUNT_CHANGED:${countsBefore.totalRecipes}->${total}`);
    if (ingredients !== countsBefore.ingredientCount) throw new Error(`INGREDIENT_COUNT_CHANGED:${countsBefore.ingredientCount}->${ingredients}`);
  });

  const countsAfter = await getCounts();
  const regression = await regressionStatus();
  const rows = evaluated.map((row) => ({ scope: row.rule.scope, recipeId: row.recipe?.id ?? null, slug: row.rule.slug, titleFa: row.recipe?.title ?? row.rule.titleFa, finalState: row.result.status, exactBlocker: row.result.exactBlocker, patched: patched.includes(row.rule.slug) }));
  const publicUnresolved = rows.filter((row) => row.finalState !== 'RESTORE_PUBLIC_AS_IS' && restore.some((r) => r.rule.slug === row.slug)).length;
  writeJson('batch02_apply_report.json', { generatedAt, countsBefore, countsAfter, restored: restore.length, patched: patched.length, stillReviewOnly: keep.length, usedMarkers, regression, rows });
  writeMd('batch02_apply_report.md', `# Batch 01 Fix3 + Batch 02 Apply Report

- generatedAt: ${generatedAt}
- total recipe count: ${countsBefore.totalRecipes} -> ${countsAfter.totalRecipes}
- active/public count: ${countsBefore.activePublic} -> ${countsAfter.activePublic}
- draft/private/review count: ${countsBefore.draftPrivate} -> ${countsAfter.draftPrivate}
- ingredient count: ${countsBefore.ingredientCount} -> ${countsAfter.ingredientCount}
- Scope A patched/restored: ${rows.filter((r) => r.scope === 'A' && r.finalState === 'RESTORE_PUBLIC_AS_IS').length}
- Scope A still reviewOnly: ${rows.filter((r) => r.scope === 'A' && r.finalState !== 'RESTORE_PUBLIC_AS_IS').length}
- Scope B restored as-is: ${rows.filter((r) => r.scope === 'B' && r.finalState === 'RESTORE_PUBLIC_AS_IS').length}
- Scope B patched: 0
- Scope B renamed/reframed: 0
- Scope B still reviewOnly: ${rows.filter((r) => r.scope === 'B' && r.finalState !== 'RESTORE_PUBLIC_AS_IS').length}
- marker patches applied: ${patched.length}
- deleted recipes: 0
- new ingredients: 0
- Meze public: ${countsAfter.mezePublic}
- Gamaj Kabab regression: ${regression.gamaj}
- Qeymeh Rizeh regression: ${regression.qeymeh}

## Ingredient Markers Used

${usedMarkers.map((m) => `- ${m.slug}: ${m.label} (${m.ingredientId} / ${m.code})`).join('\n') || '- none'}

| # | Scope | Final State | Patched | Title | Slug | Blocker |
|---:|---|---|---|---|---|---|
${rows.map((row, i) => `| ${i + 1} | ${row.scope} | ${row.finalState} | ${row.patched ? 'yes' : 'no'} | ${row.titleFa} | ${row.slug} | ${row.exactBlocker || '-'} |`).join('\n')}
`);
  console.log(JSON.stringify({ ok: true, restored: restore.length, patched: patched.length, stillReviewOnly: keep.length, countsBefore, countsAfter, regression }, null, 2));
}

main().finally(async () => prisma.$disconnect()).catch((err) => { console.error(err); process.exit(1); });
