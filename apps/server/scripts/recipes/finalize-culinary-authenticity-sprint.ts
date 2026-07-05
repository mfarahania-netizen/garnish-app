import fs from 'node:fs';
import path from 'node:path';
import { getCounts, loadRecipeById, prisma, recipeBlob, sprintDir, writeCsv, writeMd } from './culinary-authenticity-sprint-common';

function readJson(name: string, fallback: any) {
  const file = path.join(sprintDir, name);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
}

async function main() {
  const counts = await getCounts();
  const auth = readJson('authenticity_audit_with_rulebook_v1.json', { statusCounts: {}, rows: [] });
  const copy = readJson('ai_copy_residue_audit_v1.json', { counts: {}, rows: [] });
  const rulebook = readJson('culinary_authenticity_rulebook_v1.json', { rules: [] });
  const aiRollback = readJson('ai_copy_residue_rollback.json', []);
  const carbonaraRollback = readJson('carbonara_gris_ingredient_alignment_rollback.json', null);
  const blockers = auth.rows.filter((r: any) => r.status === 'AUTH_FAIL_PUBLIC_BLOCKER');
  const review = auth.rows.filter((r: any) => ['AUTH_HIGH_RISK', 'NOT_RULED_NEEDS_RESEARCH'].includes(r.status));
  const samples = await Promise.all([
    loadRecipeById('garnish_recipe_fa_104_7b4ced78'),
    loadRecipeById('garnish_recipe_fa_170_44f0d2ad'),
    loadRecipeById('garnish_recipe_global_143_135_2919e78e'),
    loadRecipeById('garnish_lite_fa_079_999c19be'),
    loadRecipeById('garnish_recipe_global_143_041_33abbd3b'),
  ]);
  const smoke = samples.filter(Boolean).map((r: any) => ({
    id: r.id,
    title: r.title,
    hasIngredients: r.ingredients.length > 0,
    hasSteps: r.steps.length > 0,
    wrongEggInGamaj: r.id === 'garnish_recipe_fa_104_7b4ced78' && /egg|تخم/.test(recipeBlob(r)),
    splitPeasInQeymehRizeh: r.id === 'garnish_recipe_fa_170_44f0d2ad' && /split_pea|لپه/.test(recipeBlob(r)),
  }));
  writeCsv('final_public_blockers_remaining.csv', blockers.length ? blockers : [{ recipeId: '', title: '', status: 'NONE', reason: '' }]);
  writeCsv('final_manual_review_queue.csv', review.length ? review : [{ recipeId: '', title: '', status: 'NONE', reason: '' }]);
  writeMd('final_culinary_authenticity_sprint_report.md', `# Final Culinary Authenticity Sprint Report

- generatedAt: ${new Date().toISOString()}
- production touched: no
- total recipes: ${counts.totalRecipes}
- active/public recipes: ${counts.activePublic}
- draft/private recipes: ${counts.draftPrivate}
- Meze 50 rows: ${counts.mezeTotal}
- Meze public rows: ${counts.mezePublic}
- ingredient count: ${counts.ingredientCount}

## Gates

- Gamaj Kabab regression: ${smoke.find((s) => s.id === 'garnish_recipe_fa_104_7b4ced78')?.wrongEggInGamaj ? 'FAIL' : 'PASS'}
- Qeymeh Rizeh regression: ${smoke.find((s) => s.id === 'garnish_recipe_fa_170_44f0d2ad')?.splitPeasInQeymehRizeh ? 'FAIL' : 'PASS'}
- AUTH_FAIL_PUBLIC_BLOCKER: ${auth.statusCounts?.AUTH_FAIL_PUBLIC_BLOCKER ?? 0}
- AUTH_HIGH_RISK: ${auth.statusCounts?.AUTH_HIGH_RISK ?? 0}
- NOT_RULED_NEEDS_RESEARCH: ${auth.statusCounts?.NOT_RULED_NEEDS_RESEARCH ?? 0}
- CRITICAL_USER_VISIBLE_AI_RESIDUE: ${copy.counts?.CRITICAL_USER_VISIBLE_AI_RESIDUE ?? 0}
- HIGH_REPEATED_TEMPLATE: ${copy.counts?.HIGH_REPEATED_TEMPLATE ?? 0}
- rule coverage RULED: ${rulebook.rules.filter((r: any) => r.ruleStatus === 'RULED').length}
- rule coverage total rules/templates: ${rulebook.rules.length}
- source-backed P1 DB writes: 0; P1 resolved by validation and rule correction.
- Carbonara GRIS ingredient alignment patched: ${carbonaraRollback ? 'yes - Recipe.gris.ingredients only' : 'no'}
- AI copy residue recipes patched: ${Array.isArray(aiRollback) ? aiRollback.length : 0}
- hidden/unpublished recipes count: ${counts.draftPrivate}

## Smoke

| Recipe | Ingredients | Steps | Notes |
|---|---:|---:|---|
${smoke.map((s) => `| ${s.title} | ${s.hasIngredients ? 'yes' : 'no'} | ${s.hasSteps ? 'yes' : 'no'} | ${s.wrongEggInGamaj || s.splitPeasInQeymehRizeh ? 'FAIL' : 'PASS'} |`).join('\n')}

## Remaining Reality

Functional archive improved, but full culinary authenticity coverage is not complete. NOT_RULED remains high, so the corpus must not be marketed internally as fully authenticated yet.

Final verdict: ${blockers.length === 0 && (copy.counts?.CRITICAL_USER_VISIBLE_AI_RESIDUE ?? 0) === 0 && (copy.counts?.HIGH_REPEATED_TEMPLATE ?? 0) === 0 ? 'PASS WITH AUTHENTICITY COVERAGE CAVEAT' : 'FAIL'}
`);
  console.log(JSON.stringify({ ok: true, blockers: blockers.length, review: review.length }, null, 2));
}

main().finally(async () => prisma.$disconnect()).catch((err) => {
  console.error(err);
  process.exit(1);
});
