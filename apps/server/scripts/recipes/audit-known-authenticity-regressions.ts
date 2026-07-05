import { getCounts, grisCompleteness, loadRecipeById, prisma, recipeBlob, writeMd } from './culinary-authenticity-sprint-common';

function hasAll(blob: string, terms: string[]) {
  return terms.every((term) => blob.includes(term.toLowerCase()));
}

async function main() {
  const counts = await getCounts();
  const gamaj = await loadRecipeById('garnish_recipe_fa_104_7b4ced78');
  const qeymeh = await loadRecipeById('garnish_recipe_fa_170_44f0d2ad');
  if (!gamaj || !qeymeh) throw new Error('known_recipe_missing');
  const checks: Array<{ recipe: string; status: string; failures: string[] }> = [];
  const gamajBlob = recipeBlob(gamaj);
  const gamajFailures: string[] = [];
  if (/egg|تخم/.test(gamajBlob)) gamajFailures.push('egg text/ingredient/search term detected');
  if (!hasAll(gamajBlob, ['walnuts_raw', 'pomegranate_molasses', 'lamb_meat_raw'])) gamajFailures.push('Gilani walnut/pomegranate/chunked lamb identity incomplete');
  if (!grisCompleteness(gamaj.gris).ok) gamajFailures.push(`GRIS incomplete: ${grisCompleteness(gamaj.gris).missing.join(', ')}`);
  checks.push({ recipe: gamaj.title, status: gamajFailures.length ? 'FAIL' : 'PASS', failures: gamajFailures });

  const qeymehBlob = recipeBlob(qeymeh);
  const qeymehFailures: string[] = [];
  if (!hasAll(qeymehBlob, ['ground_lamb_raw', 'chickpea_flour', 'tomato_paste', 'potato_raw'])) qeymehFailures.push('ground meat/chickpea flour/tomato/potato identity incomplete');
  if (/split_pea|split peas|لپه/.test(qeymehBlob)) qeymehFailures.push('split pea/khoresh qeymeh marker detected');
  if (!grisCompleteness(qeymeh.gris).ok) qeymehFailures.push(`GRIS incomplete: ${grisCompleteness(qeymeh.gris).missing.join(', ')}`);
  checks.push({ recipe: qeymeh.title, status: qeymehFailures.length ? 'FAIL' : 'PASS', failures: qeymehFailures });

  const fail = checks.some((c) => c.status === 'FAIL');
  writeMd('known_regression_locks_report.md', `# Known Authenticity Regression Locks

- generatedAt: ${new Date().toISOString()}
- recipe count: ${counts.totalRecipes}
- ingredient count: ${counts.ingredientCount}

| Recipe | Status | Failures |
|---|---|---|
${checks.map((c) => `| ${c.recipe} | ${c.status} | ${c.failures.join(' ; ') || '-'} |`).join('\n')}

Final verdict: ${fail ? 'FAIL' : 'PASS'}
`);
  if (fail) throw new Error('known_regression_lock_failed');
  console.log(JSON.stringify({ ok: true, checks }, null, 2));
}

main().finally(async () => prisma.$disconnect()).catch((err) => {
  console.error(err);
  process.exit(1);
});

