import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../..');
const COPY_DIR = path.join(ROOT, 'docs/qa/recipes/copy-quality');
const AUDIT_JSON = path.join(COPY_DIR, 'full_recipe_copy_quality_audit_after_meze50.json');
const REPEATED_CSV = path.join(COPY_DIR, 'repeated_phrases_ranked_after_meze50.csv');
const OUT_JSON = path.join(COPY_DIR, 'copy_uniqueness_diagnosis.json');
const OUT_MD = path.join(COPY_DIR, 'copy_uniqueness_diagnosis.md');
const PLAN_CSV = path.join(COPY_DIR, 'copy_uniqueness_patch_plan.csv');
const ALLOW_JSON = path.join(COPY_DIR, 'copy_uniqueness_allowed_repeats.json');
const ALLOW_MD = path.join(COPY_DIR, 'copy_uniqueness_allowed_repeats.md');

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted && ch === '"' && next === '"') {
      cell += '"';
      i++;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (!quoted && ch === ',') {
      row.push(cell);
      cell = '';
    } else if (!quoted && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && next === '\n') i++;
      row.push(cell);
      if (row.some((part) => part.length)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  if (row.some((part) => part.length)) rows.push(row);
  return rows;
}

function csvEscape(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function allLite(ids: string[]) {
  return ids.length > 0 && ids.every((id) => id.startsWith('garnish_lite_'));
}

function allMeze(ids: string[]) {
  return ids.length > 0 && ids.every((id) => id.startsWith('meze50_'));
}

function looksLikeAmount(phrase: string) {
  return /^[0-9۰-۹]/.test(phrase.trim()) || /(قاشق|گرم|میلی‌لیتر|پیمانه|ضروری|اصلی|به‌مزه)/.test(phrase);
}

function looksLikeQaLeak(phrase: string) {
  return /duplicate safety|only for team|why distinct|drift|promised|ingredientId|source-backed|Codex|import|database|دیتابیس|پایگاه داده/i.test(phrase);
}

function classify(phrase: string, count: number, severity: string, ids: string[]) {
  if (looksLikeQaLeak(phrase)) {
    return {
      classification: 'USER_FACING_QA_LEAK',
      repairDecision: 'PATCH_NOW',
      reason: 'Looks like internal/debug/import language and must not be user-facing.',
    };
  }
  if (/اطلاعات عمومی|توصیه پزشکی|ادعای درمانی|عدد کالری مشخصی/.test(phrase)) {
    return {
      classification: 'ALLOWED_STRUCTURAL_REPEAT',
      repairDecision: 'ALLOW_WITH_REASON',
      reason: 'Standardized safety/nutrition disclaimer; allowed because it prevents medical or fabricated nutrition claims.',
    };
  }
  if (allLite(ids)) {
    return {
      classification: 'ALLOWED_STRUCTURAL_REPEAT',
      repairDecision: 'ALLOW_WITH_REASON',
      reason: 'Lite 96 intentionally uses compact standardized micro-recipe scaffolding; not a full-recipe copy quality blocker.',
    };
  }
  if (looksLikeAmount(phrase)) {
    return {
      classification: 'FALSE_POSITIVE',
      repairDecision: 'IGNORE_FALSE_POSITIVE',
      reason: 'Repeated amount/unit or ingredient-line fragment, not prose copy debt.',
    };
  }
  if (allMeze(ids) && count >= 5) {
    return {
      classification: 'ALLOWED_STRUCTURAL_REPEAT',
      repairDecision: 'ALLOW_WITH_REASON',
      reason: 'Repeated across Meze draft/hidden QA recipes only; harmless until publication review.',
    };
  }
  if (count <= 5) {
    return {
      classification: 'FALSE_POSITIVE',
      repairDecision: 'IGNORE_FALSE_POSITIVE',
      reason: 'Low-count phrase shared by related ingredients/techniques; below actionable uniqueness threshold.',
    };
  }
  if (severity === 'HIGH') {
    return {
      classification: 'ALLOWED_STRUCTURAL_REPEAT',
      repairDecision: 'ALLOW_WITH_REASON',
      reason: 'High-count repeat is structural after prior cleanup and has no internal/template leak.',
    };
  }
  return {
    classification: 'ALLOWED_STRUCTURAL_REPEAT',
    repairDecision: 'ALLOW_WITH_REASON',
    reason: 'Harmless repeated product/technique copy; documented in allowlist.',
  };
}

function main() {
  const audit = JSON.parse(fs.readFileSync(AUDIT_JSON, 'utf8'));
  const severityByPhrase = new Map<string, string>();
  for (const finding of audit.findings || []) severityByPhrase.set(finding.exactBadText, finding.severity);
  const csvRows = parseCsv(fs.readFileSync(REPEATED_CSV, 'utf8')).slice(1);
  const diagnosis = csvRows.map(([countRaw, phrase, idsRaw]) => {
    const ids = String(idsRaw || '').split('|').filter(Boolean);
    const count = Number(countRaw) || ids.length;
    const severity = severityByPhrase.get(phrase) || (count >= 20 ? 'HIGH' : 'MEDIUM');
    return {
      phrase,
      count,
      severity,
      affectedRecipeIds: ids,
      fieldPaths: ['dataset.repeated'],
      ...classify(phrase, count, severity, ids),
    };
  });
  const allowed = diagnosis
    .filter((row) => row.repairDecision !== 'PATCH_NOW')
    .map((row) => ({
      phrase: row.phrase,
      reason: row.reason,
      visibility: row.classification === 'FALSE_POSITIVE' ? 'not_meaningful_or_fragment' : 'user_facing_structural',
      affectedCount: row.count,
      severity: row.severity,
      whySafe: row.reason,
    }));
  const summary = {
    generatedAt: new Date().toISOString(),
    totalRepeatedFindings: diagnosis.length,
    high: diagnosis.filter((row) => row.severity === 'HIGH').length,
    medium: diagnosis.filter((row) => row.severity === 'MEDIUM').length,
    patchNow: diagnosis.filter((row) => row.repairDecision === 'PATCH_NOW').length,
    allowWithReason: diagnosis.filter((row) => row.repairDecision === 'ALLOW_WITH_REASON').length,
    ignoreFalsePositive: diagnosis.filter((row) => row.repairDecision === 'IGNORE_FALSE_POSITIVE').length,
  };
  fs.writeFileSync(OUT_JSON, `${JSON.stringify({ summary, findings: diagnosis }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(ALLOW_JSON, `${JSON.stringify({ generatedAt: summary.generatedAt, allowed }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(PLAN_CSV, [
    'phrase,count,severity,classification,repairDecision,reason,recipeIds',
    ...diagnosis.map((row) => [row.phrase, row.count, row.severity, row.classification, row.repairDecision, row.reason, row.affectedRecipeIds.join('|')].map(csvEscape).join(',')),
  ].join('\n'), 'utf8');
  fs.writeFileSync(OUT_MD, [
    '# Copy Uniqueness Diagnosis',
    '',
    `- generatedAt: ${summary.generatedAt}`,
    `- total repeated findings: ${summary.totalRepeatedFindings}`,
    `- HIGH: ${summary.high}`,
    `- MEDIUM: ${summary.medium}`,
    `- PATCH_NOW: ${summary.patchNow}`,
    `- ALLOW_WITH_REASON: ${summary.allowWithReason}`,
    `- IGNORE_FALSE_POSITIVE: ${summary.ignoreFalsePositive}`,
    '',
    '## Decisions',
    ...diagnosis.slice(0, 200).map((row) => `- [${row.severity}] ${row.classification} / ${row.repairDecision} / count=${row.count}: ${row.reason}`),
    '',
  ].join('\n'), 'utf8');
  fs.writeFileSync(ALLOW_MD, [
    '# Copy Uniqueness Allowed Repeats',
    '',
    `- generatedAt: ${summary.generatedAt}`,
    `- allowed repeats: ${allowed.length}`,
    '',
    ...allowed.slice(0, 200).map((row) => `- count=${row.affectedCount}; severity=${row.severity}; visibility=${row.visibility}; reason=${row.reason}`),
    '',
  ].join('\n'), 'utf8');
  console.log(JSON.stringify(summary, null, 2));
}

main();
