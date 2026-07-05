import fs from 'node:fs';
import path from 'node:path';
import { activePublicRecipes, getCounts, recipeBlob, sprintDir, prisma, writeCsv, writeJson, writeMd } from './culinary-authenticity-sprint-common';

async function main() {
  const rulebookPath = path.join(sprintDir, 'culinary_authenticity_rulebook_v1.json');
  if (!fs.existsSync(rulebookPath)) throw new Error('rulebook_missing_run_build_first');
  const rules = JSON.parse(fs.readFileSync(rulebookPath, 'utf8')).rules;
  const byId = new Map(rules.map((r: any) => [r.recipeId, r]));
  const recipes = await activePublicRecipes();
  const rows = recipes.map((r) => {
    const rule: any = byId.get(r.id);
    const blob = recipeBlob(r);
    if (!rule || rule.ruleStatus === 'NEEDS_RESEARCH') {
      return { recipeId: r.id, title: r.title, status: 'NOT_RULED_NEEDS_RESEARCH', reason: rule?.notes ?? 'no rule', ruleStatus: rule?.ruleStatus ?? 'MISSING' };
    }
    const missing = (rule.requiredCoreIngredients ?? []).filter((x: string) => !blob.includes(x.toLowerCase()));
    const forbidden = (rule.forbiddenIngredients ?? []).filter((x: string) => blob.includes(x.toLowerCase()));
    const missingTech = (rule.requiredTechniques ?? []).filter((x: string) => {
      if (x === 'off_heat_emulsion') return !(blob.includes('حرارت بردار') || blob.includes('off heat') || blob.includes('دور از حرارت'));
      if (x === 'pasta_water_emulsion') return !(blob.includes('آب پاستا') || blob.includes('pasta water'));
      if (x === 'salting cabbage') return !(blob.includes('نمک') && blob.includes('کلم'));
      if (x === 'fermentation/resting') return !(blob.includes('تخمیر') || blob.includes('ferment') || blob.includes('دمای اتاق'));
      return false;
    });
    const status = forbidden.length ? 'AUTH_FAIL_PUBLIC_BLOCKER'
      : missing.length || missingTech.length ? 'AUTH_HIGH_RISK'
      : rule.ruleStatus.includes('SIMPLE') ? 'AUTH_MINOR_METADATA'
      : 'AUTH_PASS';
    return { recipeId: r.id, title: r.title, status, reason: [...missing.map((m: string) => `missing:${m}`), ...forbidden.map((f: string) => `forbidden:${f}`), ...missingTech.map((t: string) => `missingTechnique:${t}`)].join(' | '), ruleStatus: rule.ruleStatus };
  });
  const counts = rows.reduce((acc: Record<string, number>, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  writeJson('authenticity_audit_with_rulebook_v1.json', { generatedAt: new Date().toISOString(), counts: await getCounts(), statusCounts: counts, rows });
  writeCsv('authenticity_failures_public_blockers.csv', rows.filter((r) => r.status === 'AUTH_FAIL_PUBLIC_BLOCKER'));
  writeCsv('authenticity_review_queue.csv', rows.filter((r) => ['AUTH_HIGH_RISK', 'AUTH_REVIEW', 'NOT_RULED_NEEDS_RESEARCH'].includes(r.status)));
  writeMd('authenticity_audit_with_rulebook_v1.md', `# Authenticity Audit With Rulebook v1

| Status | Count |
|---|---:|
${Object.entries(counts).map(([k, v]) => `| ${k} | ${v} |`).join('\n')}

AUTH_FAIL_PUBLIC_BLOCKER must be 0 before launch. NOT_RULED_NEEDS_RESEARCH means full authenticity coverage is not complete.
`);
  console.log(JSON.stringify({ ok: true, counts }, null, 2));
}

main().finally(async () => prisma.$disconnect()).catch((err) => {
  console.error(err);
  process.exit(1);
});

