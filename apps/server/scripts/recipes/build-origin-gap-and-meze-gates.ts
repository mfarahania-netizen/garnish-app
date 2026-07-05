import fs from 'node:fs';
import path from 'node:path';
import { activePublicRecipes, adminSlug, archiveDir, grisCompleteness, parseJson, prisma, recipeBlob, writeCsv, writeMd } from './culinary-authenticity-sprint-common';

function readMissingPlan() {
  const file = path.join(archiveDir, 'famous_iranian_missing_or_needs_split_v1.csv');
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).slice(1);
  return lines.map((line) => {
    const cells = line.match(/("([^"]|"")*"|[^,]*)/g)?.filter((x) => x !== ',') ?? [];
    return {
      titleFa: (cells[0] ?? '').replace(/^"|"$/g, '').replace(/""/g, '"'),
      region: (cells[1] ?? '').replace(/^"|"$/g, '').replace(/""/g, '"'),
      priority: (cells[2] ?? '').replace(/^"|"$/g, '').replace(/""/g, '"'),
      reason: (cells[3] ?? '').replace(/^"|"$/g, '').replace(/""/g, '"'),
    };
  }).filter((x) => x.titleFa);
}

async function main() {
  const active = await activePublicRecipes();
  const meze = await prisma.recipe.findMany({
    where: { id: { startsWith: 'meze50_' } },
    include: { ingredients: { include: { ingredient: true } }, steps: true, searchTerms: true },
    orderBy: { id: 'asc' },
  });
  const originRows = active.map((r) => {
    const admin = parseJson(r.adminNote, {});
    const needs = r.region === 'international' && !/Italian|French|Korean|Japanese|Turkish|Greek|American|Mexican|Thai|Chinese|Indian|Iran|persian/i.test(recipeBlob(r));
    return { recipeId: r.id, slug: adminSlug(r), title: r.title, region: r.region, source: admin.source ?? 'unknown', issue: needs ? 'international_country_region_weak' : r.region === 'persian' ? 'iranian_city_province_may_need_precision' : '' };
  }).filter((r) => r.issue);
  const missing = readMissingPlan().map((m) => ({
    titleFa: m.titleFa,
    titleEn: '',
    regionCity: m.region,
    whyImportant: m.reason,
    closestExistingRecipe: active.find((r) => r.title.includes(m.titleFa.split(' ')[0]))?.title ?? '',
    decision: /نسخه|تفکیک|split/i.test(m.reason) ? 'split_or_fix' : 'add',
    priority: m.priority || 'P2',
    ingredientFeasibilityRisk: 'needs dictionary check before import',
  }));
  const mezeGate = meze.map((r) => {
    const gris = grisCompleteness(r.gris);
    const unresolved = r.ingredients.filter((ri: any) => !ri.ingredientId || !ri.ingredient).length;
    const duplicatePublic = active.some((a) => adminSlug(a) === adminSlug(r));
    const copyResidue = /کنار دستت|مواد را طبق|شخصیت غذا|نشانهٔ درست/.test(recipeBlob(r));
    const status = unresolved ? 'NEEDS_INGREDIENT_FIX' : copyResidue ? 'NEEDS_COPY_POLISH' : !gris.ok ? 'NEEDS_AUTH_REVIEW' : duplicatePublic ? 'BLOCKED' : 'READY_TO_PUBLISH';
    return { recipeId: r.id, slug: adminSlug(r), title: r.title, ingredients: r.ingredients.length, steps: r.steps.length, grisComplete: gris.ok, unresolved, duplicatePublic, copyResidue, status };
  });
  writeCsv('origin_metadata_cleanup_queue_v1.csv', originRows);
  writeCsv('missing_famous_iranian_priority_plan_v1.csv', missing.length ? missing : [{ titleFa: '', titleEn: '', regionCity: '', whyImportant: '', closestExistingRecipe: '', decision: '', priority: '', ingredientFeasibilityRisk: '' }]);
  writeCsv('meze_50_publish_readiness_gate.csv', mezeGate);
  const mezeCounts = mezeGate.reduce((acc: Record<string, number>, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  writeMd('iranian_and_global_gap_report_v1.md', `# Iranian and Global Gap Report v1

- active/public recipes inspected: ${active.length}
- origin cleanup queue: ${originRows.length}
- missing/needs-split Iranian plan items: ${missing.length}

This report does not create new recipes. It is a prioritization plan for future import/split/fix work.
`);
  writeMd('meze_50_publish_readiness_gate.md', `# Meze 50 Publish Readiness Gate

- Meze rows inspected: ${meze.length}

| Status | Count |
|---|---:|
${Object.entries(mezeCounts).map(([k, v]) => `| ${k} | ${v} |`).join('\n')}

Hard rule: no Meze row was published in this sprint.
`);
  console.log(JSON.stringify({ ok: true, originIssues: originRows.length, missing: missing.length, mezeCounts }, null, 2));
}

main().finally(async () => prisma.$disconnect()).catch((err) => {
  console.error(err);
  process.exit(1);
});

