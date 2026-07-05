import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../..');
const COPY_DIR = path.join(ROOT, 'docs/qa/recipes/copy-quality');
const BASE_AUDIT = path.join(COPY_DIR, 'full_recipe_copy_quality_audit_after_meze50.json');
const ALLOW_JSON = path.join(COPY_DIR, 'copy_uniqueness_allowed_repeats.json');
const OUT_JSON = path.join(COPY_DIR, 'full_recipe_copy_quality_audit_after_uniqueness_cleanup.json');
const OUT_MD = path.join(COPY_DIR, 'full_recipe_copy_quality_audit_after_uniqueness_cleanup.md');
const OUT_CSV = path.join(COPY_DIR, 'affected_recipe_inventory_after_uniqueness_cleanup.csv');
const REPEATED_CSV = path.join(COPY_DIR, 'repeated_phrases_ranked_after_uniqueness_cleanup.csv');

function csvEscape(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function main() {
  const audit = JSON.parse(fs.readFileSync(BASE_AUDIT, 'utf8'));
  const allowedRows = JSON.parse(fs.readFileSync(ALLOW_JSON, 'utf8')).allowed || [];
  const allowed = new Map<string, any>(allowedRows.map((row: any) => [row.phrase, row]));
  const repeated = (audit.findings || []).filter((finding: any) => finding.class === 'REPEATED_SENTENCE_ACROSS_DATASET');
  const unallowed = repeated.filter((finding: any) => !allowed.has(finding.exactBadText));
  const highUnallowed = unallowed.filter((finding: any) => finding.severity === 'HIGH');
  const mediumUnallowed = unallowed.filter((finding: any) => finding.severity === 'MEDIUM');
  const report = {
    generatedAt: new Date().toISOString(),
    recipeCount: audit.recipeCount,
    critical: audit.critical || 0,
    internalLeaks: (audit.findings || []).filter((finding: any) => finding.class === 'INTERNAL_LEAK').length,
    templateGarbage: (audit.findings || []).filter((finding: any) => finding.class === 'TEMPLATE_GARBAGE').length,
    repeatedBefore: repeated.length,
    highBefore: repeated.filter((finding: any) => finding.severity === 'HIGH').length,
    mediumBefore: repeated.filter((finding: any) => finding.severity === 'MEDIUM').length,
    allowedRepeatCount: allowedRows.length,
    unallowedRepeatedCount: unallowed.length,
    highAfterAllowlist: highUnallowed.length,
    mediumAfterAllowlist: mediumUnallowed.length,
    actionableRepeatedCopy: unallowed.length,
    ok: (audit.critical || 0) === 0 && highUnallowed.length === 0 && mediumUnallowed.length === 0,
    unallowed,
  };
  fs.writeFileSync(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUT_CSV, [
    'recipeId,slug,titleFa,sourceGroup,fieldPath,exactBadText,class,severity,recommendedRepairType,allowlistStatus',
    ...(audit.findings || []).map((finding: any) => [
      finding.recipeId,
      finding.slug,
      finding.titleFa,
      finding.sourceGroup,
      finding.fieldPath,
      finding.exactBadText,
      finding.class,
      finding.severity,
      finding.recommendedRepairType,
      allowed.has(finding.exactBadText) ? 'ALLOWLISTED' : 'UNALLOWLISTED',
    ].map(csvEscape).join(',')),
  ].join('\n'), 'utf8');
  fs.writeFileSync(REPEATED_CSV, [
    'severity,phrase,allowlistStatus,reason',
    ...repeated.map((finding: any) => [
      finding.severity,
      finding.exactBadText,
      allowed.has(finding.exactBadText) ? 'ALLOWLISTED' : 'UNALLOWLISTED',
      allowed.get(finding.exactBadText)?.reason || '',
    ].map(csvEscape).join(',')),
  ].join('\n'), 'utf8');
  fs.writeFileSync(OUT_MD, [
    '# Full Recipe Copy Quality Audit After Uniqueness Cleanup',
    '',
    `- generatedAt: ${report.generatedAt}`,
    `- recipes scanned: ${report.recipeCount}`,
    `- CRITICAL: ${report.critical}`,
    `- internal leaks: ${report.internalLeaks}`,
    `- template garbage: ${report.templateGarbage}`,
    `- repeated before allowlist: ${report.repeatedBefore}`,
    `- HIGH before: ${report.highBefore}`,
    `- MEDIUM before: ${report.mediumBefore}`,
    `- allowed repeated copy: ${report.allowedRepeatCount}`,
    `- HIGH after allowlist: ${report.highAfterAllowlist}`,
    `- unallowlisted MEDIUM after allowlist: ${report.mediumAfterAllowlist}`,
    `- actionable repeated copy remaining: ${report.actionableRepeatedCopy}`,
    `- verdict: ${report.ok ? 'PASS' : 'FAIL'}`,
    '',
  ].join('\n'), 'utf8');
  console.log(JSON.stringify({ ok: report.ok, critical: report.critical, highAfterAllowlist: report.highAfterAllowlist, mediumAfterAllowlist: report.mediumAfterAllowlist, allowedRepeatCount: report.allowedRepeatCount }, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main();
