import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const ROOT = path.resolve(__dirname, '../../../..');
const OUT_DIR = path.join(ROOT, 'docs/qa/recipes/copy-quality');
const MD = path.join(OUT_DIR, 'full_recipe_copy_quality_audit_after_meze50.md');
const JSON_OUT = path.join(OUT_DIR, 'full_recipe_copy_quality_audit_after_meze50.json');
const INVENTORY_CSV = path.join(OUT_DIR, 'affected_recipe_inventory_after_meze50.csv');
const REPEATED_CSV = path.join(OUT_DIR, 'repeated_phrases_ranked_after_meze50.csv');

const PATTERNS: Array<{ class: string; severity: string; re: RegExp; repairType: string }> = [
  { class: 'INTERNAL_LEAK', severity: 'CRITICAL', re: /\b(USDA|FSIS|fdcId|database|JSON|Codex|import|GRIS|ingredientId|source-backed)\b/i, repairType: 'SENTENCE_PATCH' },
  { class: 'INTERNAL_LEAK', severity: 'CRITICAL', re: /شناسه[‌ ]?دار|دیکشنری|پایگاه داده|دیتابیس/i, repairType: 'SENTENCE_PATCH' },
  { class: 'INTERNAL_LEAK', severity: 'CRITICAL', re: /duplicate safety|ÙÙ‚Ø· Ø¨Ø±Ø§ÛŒ ØªÛŒÙ…|Ù†Ù‡ Ù…ØªÙ† Ú©Ø§Ø±Ø¨Ø±|Ù‚ÙÙ„â€ŒØ´Ø¯Ù‡ Ø¨Ù‡ Ù…Ù†Ø¨Ø¹|Ù…ÙˆØªÙˆØ± ØªØºØ°ÛŒÙ‡/i, repairType: 'SENTENCE_PATCH' },
  { class: 'TEMPLATE_GARBAGE', severity: 'HIGH', re: /promised|Ø´Ø®ØµÛŒØª promised|Ø¸Ø§Ù‡Ø± Ù†Ù‡Ø§ÛŒÛŒ Ø¨Ø§ÛŒØ¯ Ø¨Ø§ Ù‡ÙˆÛŒØª ØºØ°Ø§ Ù‡Ù…Ø§Ù‡Ù†Ú¯ Ø¨Ø§Ø´Ø¯|Ù†Ù‚Ø·Ù‡ Ù‚ÙˆØªØ´ Ø§ÛŒÙ† Ø§Ø³Øª Ú©Ù‡|Ø­ÙØ¸ Ù‡ÙˆÛŒØª .* Ø¨Ø¯ÙˆÙ† Ù†Ø²Ø¯ÛŒÚ©â€ŒØ´Ø¯Ù†|Ø±ÙˆÛŒÙ‡ ÛŒØ§ Ø¯ÛŒÙ¾ Ø§Ø² ØºØ°Ø§ Ø¬Ø¯Ø§ Ù†Ø§ÛŒØ³ØªØ¯/i, repairType: 'SENTENCE_PATCH' },
  { class: 'TEMPLATE_GARBAGE', severity: 'HIGH', re: /Ø¨Ø§ .* Ú©Ø§Ø± Ú©Ù† Ùˆ Ø­Ø¯ÙˆØ¯|Ø­Ø¯ÙˆØ¯ \d+ Ø¯Ù‚ÛŒÙ‚Ù‡ Ø²Ù…Ø§Ù† Ø¨Ø¯Ù‡|Ù†Ø´Ø§Ù†Ù‡ Ø¯Ø±Ø³Øª Ø§ÛŒÙ† Ù…Ø±Ø­Ù„Ù‡|Ø¸Ø§Ù‡Ø± Ùˆ Ø¹Ø·Ø± Ù‡Ù…Ø§Ù† Ù…Ø§Ø¯Ù‡|Ù‡Ù…Ø§Ù† Ù…Ø§Ø¯Ù‡ Ø¯ÛŒØ¯Ù‡ Ø´ÙˆØ¯|Ù…Ø§Ø¯Ù‡ Ø§ØµÙ„ÛŒ|Ù…Ø§Ø¯Ù‡ Ø³Ø¨Ø²/i, repairType: 'SECTION_REWRITE' },
  { class: 'FIELD_DRIFT', severity: 'HIGH', re: /Ø¨Ø±Ú¯â€ŒÙ‡Ø§ÛŒ Ø³Ø¨Ø²|drink tool|duplicate safety notes/i, repairType: 'SENTENCE_PATCH' },
];

const GENERIC_FAQ = [/Ù…ÛŒâ€ŒØ´ÙˆØ¯ Ø§Ø² Ù‚Ø¨Ù„ Ø¢Ù…Ø§Ø¯Ù‡ Ú©Ø±Ø¯ØŸ/, /Ú†Ø·ÙˆØ± Ù…Ø²Ù‡ Ø±Ø§ ØªÙ†Ø¯ØªØ± ÛŒØ§ Ù…Ù„Ø§ÛŒÙ…â€ŒØªØ± Ú©Ù†Ù…ØŸ/, /Ú†Ø±Ø§ Ø¨Ø§ÙØª Ø®Ø±Ø§Ø¨ Ø´Ø¯ØŸ/, /Ø¨Ø±Ø§ÛŒ 8 Ù†ÙØ± Ú†Ù‡ Ú©Ù†Ù…ØŸ/];

function asText(value: any): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(asText).join(' ');
  if (typeof value === 'object') return Object.values(value).map(asText).join(' ');
  return '';
}

function flatten(value: any, prefix = ''): Array<{ path: string; value: string }> {
  if (value == null) return [];
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return [{ path: prefix, value: String(value) }];
  if (Array.isArray(value)) return value.flatMap((item, index) => flatten(item, `${prefix}.${index}`));
  if (typeof value === 'object') return Object.entries(value).flatMap(([key, item]) => flatten(item, prefix ? `${prefix}.${key}` : key));
  return [];
}

function parseMaybeJson(value: any): any {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (!text || !/^[\[{]/.test(text)) return value;
  try {
    return JSON.parse(text);
  } catch {
    return value;
  }
}

function isNonDisplayPath(pathName: string) {
  return /(^|\.)(id|recipeId|ingredientId|code|slug|source|sourceGroup|sourceVersion|generatedAt|updatedAt|version|audit|repair|metadata|replacementCandidates|identityCritical|canRemove|optional|role|order)(\.|$)/i.test(pathName);
}

function isRepeatedNoise(sentence: string) {
  const s = sentence.trim();
  return /^ing_[a-z0-9_]+$/i.test(s)
    || /^gris_repair_/i.test(s)
    || /identity ingredient; no safe automatic replacement/i.test(s)
    || /^[\[\]{},":]+/.test(s)
    || /"(answer|question|q|a)"\s*:/.test(s);
}

function csvEscape(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function sourceGroup(recipe: any) {
  try {
    const note = JSON.parse(recipe.adminNote || '{}');
    return note.source || note.sourceGroup || recipe.category || '';
  } catch {
    return recipe.category || '';
  }
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const recipes = await prisma.recipe.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        adminNote: true,
        tips: true,
        faq: true,
        chefTips: true,
        commonMistakes: true,
        servingSuggestions: true,
        substitutions: true,
        gris: true,
        steps: { select: { title: true, instruction: true, order: true } },
      },
    });
    const findings: any[] = [];
    const sentenceBuckets = new Map<string, Set<string>>();
    const addSentence = (recipeId: string, sentence: string) => {
      const s = sentence.trim();
      if (s.length < 20) return;
      if (!sentenceBuckets.has(s)) sentenceBuckets.set(s, new Set());
      sentenceBuckets.get(s)!.add(recipeId);
    };

    for (const recipe of recipes) {
      const fields = [
        { path: 'title', value: recipe.title },
        { path: 'description', value: recipe.description || '' },
        ...flatten(recipe.gris, 'gris'),
        ...flatten(recipe.steps, 'steps'),
        ...flatten(parseMaybeJson(recipe.tips), 'tips'),
        ...flatten(parseMaybeJson(recipe.faq), 'faq'),
        ...flatten(parseMaybeJson(recipe.chefTips), 'chefTips'),
        ...flatten(parseMaybeJson(recipe.commonMistakes), 'commonMistakes'),
        ...flatten(parseMaybeJson(recipe.servingSuggestions), 'servingSuggestions'),
        ...flatten(parseMaybeJson(recipe.substitutions), 'substitutions'),
      ].filter((field) => !isNonDisplayPath(field.path));
      for (const field of fields) {
        const value = field.value;
        if (!value) continue;
        for (const pattern of PATTERNS) {
          const match = value.match(pattern.re);
          if (match) {
            findings.push({
              recipeId: recipe.id,
              slug: recipe.id,
              titleFa: recipe.title,
              sourceGroup: sourceGroup(recipe),
              fieldPath: field.path,
              exactBadText: match[0],
              class: pattern.class,
              severity: pattern.severity,
              recommendedRepairType: pattern.repairType,
            });
          }
        }
        for (const faq of GENERIC_FAQ) {
          const match = value.match(faq);
          if (match) findings.push({ recipeId: recipe.id, slug: recipe.id, titleFa: recipe.title, sourceGroup: sourceGroup(recipe), fieldPath: field.path, exactBadText: match[0], class: 'GENERIC_FAQ', severity: 'MEDIUM', recommendedRepairType: 'SENTENCE_PATCH' });
        }
        value.split(/[.!ØŸ\n]/).map((s) => s.trim()).filter((s) => s && !isRepeatedNoise(s)).forEach((s) => addSentence(recipe.id, s));
      }
    }

    const repeated = [...sentenceBuckets.entries()]
      .map(([sentence, ids]) => ({ sentence, count: ids.size, recipeIds: [...ids].sort() }))
      .filter((row) => row.count >= 5)
      .sort((a, b) => b.count - a.count || b.sentence.length - a.sentence.length);
    for (const row of repeated.slice(0, 500)) {
      if (/Ø§Ø·Ù„Ø§Ø¹Ø§Øª Ø¹Ù…ÙˆÙ…ÛŒ|ØªÙˆØµÛŒÙ‡ Ù¾Ø²Ø´Ú©ÛŒ/.test(row.sentence)) continue;
      findings.push({ recipeId: row.recipeIds[0], slug: row.recipeIds[0], titleFa: '', sourceGroup: 'dataset', fieldPath: 'dataset.repeated', exactBadText: row.sentence, class: 'REPEATED_SENTENCE_ACROSS_DATASET', severity: row.count >= 20 ? 'HIGH' : 'MEDIUM', recommendedRepairType: row.count > 100 ? 'FULL_GRIS_REVIEW' : 'SENTENCE_PATCH' });
    }

    const bySeverity = findings.reduce((acc: any, f) => {
      acc[f.severity] = (acc[f.severity] || 0) + 1;
      return acc;
    }, {});
    const report = {
      generatedAt: new Date().toISOString(),
      recipeCount: recipes.length,
      affectedCount: findings.length,
      critical: bySeverity.CRITICAL || 0,
      high: bySeverity.HIGH || 0,
      medium: bySeverity.MEDIUM || 0,
      findings,
      ok: (bySeverity.CRITICAL || 0) === 0,
    };
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(JSON_OUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    fs.writeFileSync(INVENTORY_CSV, [
      'recipeId,slug,titleFa,sourceGroup,fieldPath,exactBadText,class,severity,recommendedRepairType',
      ...findings.map((f) => [f.recipeId, f.slug, f.titleFa, f.sourceGroup, f.fieldPath, f.exactBadText, f.class, f.severity, f.recommendedRepairType].map(csvEscape).join(',')),
    ].join('\n'), 'utf8');
    fs.writeFileSync(REPEATED_CSV, [
      'count,sentence,recipeIds',
      ...repeated.map((r) => [r.count, r.sentence, r.recipeIds.join('|')].map(csvEscape).join(',')),
    ].join('\n'), 'utf8');
    fs.writeFileSync(MD, [
      '# Full Recipe Copy Quality Audit After Meze 50',
      '',
      `- generatedAt: ${report.generatedAt}`,
      `- recipes scanned: ${report.recipeCount}`,
      `- affected findings: ${report.affectedCount}`,
      `- CRITICAL: ${report.critical}`,
      `- HIGH: ${report.high}`,
      `- MEDIUM: ${report.medium}`,
      `- verdict: ${report.ok ? 'PASS' : 'FAIL'}`,
      '',
      '## Top Findings',
      findings.length ? findings.slice(0, 200).map((f) => `- [${f.severity}] ${f.recipeId} ${f.fieldPath}: ${f.class} => ${f.exactBadText}`).join('\n') : '- none',
      '',
    ].join('\n'), 'utf8');
    console.log(JSON.stringify({ ok: report.ok, affectedCount: report.affectedCount, critical: report.critical, high: report.high }, null, 2));
    if (!report.ok) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

