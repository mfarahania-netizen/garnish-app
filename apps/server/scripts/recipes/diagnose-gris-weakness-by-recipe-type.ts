import { activePublicRecipes, grisCompleteness, isLiteOrSimple, prisma, writeCsv, writeMd } from './culinary-authenticity-sprint-common';

async function main() {
  const recipes = await activePublicRecipes();
  const rows = recipes.map((r) => {
    const simple = isLiteOrSimple(r);
    const gris = r.gris as any;
    const g = grisCompleteness(gris);
    const weakSteps = Array.isArray(gris?.steps) ? gris.steps.filter((s: any) => !s.instruction || String(s.instruction).length < 55 || !s.title).length : 0;
    const weakIngredients = Array.isArray(gris?.ingredients) ? gris.ingredients.filter((i: any) => !i.role || !i.component || !i.buyTip).length : 0;
    const classification = !g.ok ? 'INGREDIENT_METADATA_WEAK'
      : simple && (weakSteps || weakIngredients) ? 'ACCEPTABLE_SIMPLE_NON_COOKING'
      : weakSteps ? 'TRUE_WEAK_COOKED_RECIPE'
      : weakIngredients ? 'INGREDIENT_METADATA_WEAK'
      : 'FALSE_POSITIVE';
    return { recipeId: r.id, title: r.title, simple, weakSteps, weakIngredients, classification };
  }).filter((r) => r.classification !== 'FALSE_POSITIVE');
  const counts = rows.reduce((acc: Record<string, number>, r) => {
    acc[r.classification] = (acc[r.classification] ?? 0) + 1;
    return acc;
  }, {});
  writeCsv('gris_weakness_diagnosis_v1.csv', rows);
  writeMd('gris_weakness_diagnosis_v1.md', `# GRIS Weakness Diagnosis v1

| Classification | Count |
|---|---:|
${Object.entries(counts).map(([k, v]) => `| ${k} | ${v} |`).join('\n')}

No GRIS quality patch batch was applied in this diagnostic step. The next safe batch should target top TRUE_WEAK_COOKED_RECIPE items only.
`);
  console.log(JSON.stringify({ ok: true, counts }, null, 2));
}

main().finally(async () => prisma.$disconnect()).catch((err) => {
  console.error(err);
  process.exit(1);
});

