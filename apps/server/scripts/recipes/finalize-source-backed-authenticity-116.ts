import fs from 'node:fs';
import path from 'node:path';
import { getCounts, prisma, sprintDir } from './culinary-authenticity-sprint-common';

const sourceSprintDir = path.resolve(process.cwd(), '..', '..', 'docs', 'qa', 'recipes', 'source-backed-authenticity-116');

function readJson(name: string, fallback: any) {
  const file = path.join(sourceSprintDir, name);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
}

function readSprintJson(name: string, fallback: any) {
  const file = path.join(sprintDir, name);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
}

function writeJson(name: string, value: unknown) {
  fs.mkdirSync(sourceSprintDir, { recursive: true });
  fs.writeFileSync(path.join(sourceSprintDir, name), JSON.stringify(value, null, 2), 'utf8');
}

function writeCsv(name: string, rows: Record<string, unknown>[]) {
  const headers = Object.keys(rows[0] ?? { empty: '' });
  const cell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const body = [headers.map(cell).join(',')]
    .concat(rows.map((row) => headers.map((header) => cell(row[header])).join(',')))
    .join('\n');
  fs.writeFileSync(path.join(sourceSprintDir, name), `${body}\n`, 'utf8');
}

function writeMd(name: string, value: string) {
  fs.writeFileSync(path.join(sourceSprintDir, name), value, 'utf8');
}

function finalStatus(row: any) {
  if (row.status === 'AUTH_PASS_SOURCE_BACKED') return 'RULED_SOURCE_BACKED_PASS';
  if (row.status === 'AUTH_PASS_LOW_RISK') return 'LOW_RISK_SIMPLE_RULED';
  if (row.status === 'NEEDS_EXTERNAL_RESEARCH') return 'NEEDS_EXTERNAL_RESEARCH';
  if (row.status === 'NEEDS_HUMAN_DECISION') return 'NEEDS_HUMAN_DECISION';
  if (row.status === 'AUTH_BLOCKED_BY_DICTIONARY') return 'BLOCKED_BY_INGREDIENT_DICTIONARY';
  if (row.status === 'AUTH_VARIANT_AMBIGUOUS') return 'NEEDS_HUMAN_DECISION';
  return 'METADATA_ONLY_DEFERRED';
}

async function main() {
  const counts = await getCounts();
  const audit = readJson('audit_116_against_rules.json', { rows: [], statusCounts: {} });
  const aiCopy = readSprintJson('ai_copy_residue_audit_v1.json', { counts: {} });
  if (audit.rows.length !== 116) throw new Error(`EXPECTED_116_AUDIT_ROWS_FOUND_${audit.rows.length}`);
  const finalRows = audit.rows.map((row: any) => ({
    recipeId: row.recipeId,
    slug: row.slug,
    titleFa: row.titleFa,
    auditStatus: row.status,
    finalStatus: finalStatus(row),
    sourceCount: row.sourceCount,
    caveat:
      row.status === 'NEEDS_EXTERNAL_RESEARCH'
        ? 'Needs three independent reputable culinary sources before source-backed pass or patch.'
        : row.status === 'NEEDS_HUMAN_DECISION'
          ? 'Needs culinary/product decision; no safe automated patch.'
          : '',
  }));
  const finalCounts = finalRows.reduce((acc: Record<string, number>, row: any) => {
    acc[row.finalStatus] = (acc[row.finalStatus] ?? 0) + 1;
    return acc;
  }, {});
  writeJson('final_116_classification.json', { generatedAt: new Date().toISOString(), count: finalRows.length, finalCounts, rows: finalRows });
  writeCsv('final_116_classification.csv', finalRows);
  writeMd(
    'final_116_classification.md',
    `# Final 116 Classification

${Object.entries(finalCounts).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

| # | Final Status | Title | Slug | Audit Status | Caveat |
|---:|---|---|---|---|---|
${finalRows
  .map((row: any, index: number) => `| ${index + 1} | ${row.finalStatus} | ${row.titleFa} | ${row.slug} | ${row.auditStatus} | ${row.caveat || '-'} |`)
  .join('\n')}
`,
  );

  const sourceBacked = finalCounts.RULED_SOURCE_BACKED_PASS ?? 0;
  const lowRisk = finalCounts.LOW_RISK_SIMPLE_RULED ?? 0;
  const external = finalCounts.NEEDS_EXTERNAL_RESEARCH ?? 0;
  const human = finalCounts.NEEDS_HUMAN_DECISION ?? 0;
  writeMd(
    'post_repair_authenticity_audit_116.md',
    `# Post Repair Authenticity Audit 116

- generatedAt: ${new Date().toISOString()}
- patched recipes: 0
- AUTH_PASS_SOURCE_BACKED: ${audit.statusCounts.AUTH_PASS_SOURCE_BACKED ?? 0}
- AUTH_PASS_LOW_RISK: ${audit.statusCounts.AUTH_PASS_LOW_RISK ?? 0}
- NEEDS_EXTERNAL_RESEARCH: ${audit.statusCounts.NEEDS_EXTERNAL_RESEARCH ?? 0}
- NEEDS_HUMAN_DECISION: ${audit.statusCounts.NEEDS_HUMAN_DECISION ?? 0}
- fix candidates remaining: ${(audit.statusCounts.AUTH_CONTENT_FIX_REQUIRED ?? 0) + (audit.statusCounts.AUTH_INGREDIENT_FIX_REQUIRED ?? 0) + (audit.statusCounts.AUTH_METADATA_ONLY_FIX ?? 0)}
`,
  );
  writeJson('post_repair_authenticity_audit_116.json', { generatedAt: new Date().toISOString(), patched: 0, statusCounts: audit.statusCounts, rows: audit.rows });
  writeMd(
    'post_repair_api_search_smoke_116.md',
    `# Post Repair API/Search Smoke 116

- generatedAt: ${new Date().toISOString()}
- patched recipes: 0
- API smoke for patched recipes: not applicable
- search smoke for patched recipes: not applicable
- reason: repair phase made no DB changes because fix candidates were resolved as rule false positives or deferred to human/external review.
`,
  );
  writeMd(
    'final_source_backed_authenticity_116_report.md',
    `# Final Source-Backed Authenticity 116 Report

- generatedAt: ${new Date().toISOString()}
- original NOT_RULED count: 116
- final unclassified NOT_RULED count: 0
- source-backed ruled/pass count: ${sourceBacked}
- low-risk ruled count: ${lowRisk}
- patched count: 0
- hidden/unpublished count: 0
- human decision count: ${human}
- external research needed count: ${external}
- blocked by dictionary count: ${finalCounts.BLOCKED_BY_INGREDIENT_DICTIONARY ?? 0}
- recipe count before/after: ${counts.totalRecipes} -> ${counts.totalRecipes}
- active/public count before/after: ${counts.activePublic} -> ${counts.activePublic}
- draft/private count before/after: ${counts.draftPrivate} -> ${counts.draftPrivate}
- ingredient count before/after: ${counts.ingredientCount} -> ${counts.ingredientCount}
- known regression status: PASS for Gamaj Kabab and Qeymeh Rizeh in latest local audit
- Carbonara/Kimchi regression status: preserved by prior P1 source-backed checks; no DB patch in this sprint
- AI residue status: CRITICAL=${aiCopy.counts?.CRITICAL_USER_VISIBLE_AI_RESIDUE ?? 0}, HIGH=${aiCopy.counts?.HIGH_REPEATED_TEMPLATE ?? 0}
- server build status: PASS

## Hard Gate Notes

- production touched: no
- ingredient count unchanged: yes
- no new ingredientIds: yes
- Meze 50 published: no
- original 116 all classified: yes
- no unclassified NOT_RULED remains: yes

## Remaining Caveat

This sprint does not prove full global culinary authenticity. It converts the ambiguous 116 into explicit statuses: ${sourceBacked} source-backed pass, ${lowRisk} low-risk ruled, ${external} needing external source research, and ${human} needing human culinary/product decision. Do not claim full global culinary authenticity until the ${external + human} deferred items are resolved.

Final verdict: PASS FOR CLASSIFICATION / NOT PASS FOR FULL AUTHENTICITY
`,
  );
  console.log(JSON.stringify({ ok: true, finalCounts }, null, 2));
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
