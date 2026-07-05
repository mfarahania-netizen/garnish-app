import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const ROOT = path.resolve(__dirname, '../../../..');
const OUT_DIR = path.join(ROOT, 'docs/qa/recipes/copy-quality');
const ROLLBACK = path.join(OUT_DIR, 'copy_quality_template_residue_rollback.json');
const REPORT_JSON = path.join(OUT_DIR, 'copy_quality_template_residue_repair_report.json');
const REPORT_MD = path.join(OUT_DIR, 'copy_quality_template_residue_repair_report.md');

const RESIDUE_RE = /(با\s+.{2,60}?\s+کار\s+کن\s+و\s+حدود\s+\d+\s+دقیقه\s+زمان\s+بده|ماده اصلی|نشانه[‌ ]?ی? درست این مرحله|ظاهر و عطر همان ماده|همان ماده دیده شود|شناسه[‌ ]?دار|دیکشنری|پایگاه داده|دیتابیس)/;

function localDbGuard() {
  const url = process.env.DATABASE_URL || '';
  const isLocal = /localhost|127\.0\.0\.1|\[::1\]/i.test(url);
  const looksProd = /prod|production|supabase|render|neon|railway|amazonaws|fly\.dev/i.test(url);
  if (!isLocal || looksProd) throw new Error('DATABASE_URL is not local/dev');
}

function cleanText(value: string) {
  return String(value || '')
    .replace(/^با\s+.{2,60}?\s+کار\s+کن\s+و\s+حدود\s+\d+\s+دقیقه\s+زمان\s+بده\.?\s*/g, '')
    .replace(/\s*نشانه[‌ ]?ی? درست این مرحله باید با ظاهر و عطر همان ماده دیده شود\.?/g, '')
    .replace(/\s*نشانه[‌ ]?ی? درست این مرحله باید باظاهر، عطر و بافت همین مرحله دیده شود\.?/g, ' ظاهر، عطر و بافت این مرحله باید روشن و قابل‌تشخیص باشد.')
    .replace(/\s*ظاهر و عطر همان ماده/g, 'ظاهر، عطر و بافت همین مرحله')
    .replace(/همان ماده دیده شود/g, 'نتیجه مرحله روشن باشد')
    .replace(/این آیتم با مواد شناسه[‌ ]?دار دیکشنری [۰-۹0-9]+تایی ساخته شده و برای برنامه غذایی، جستجو و لیست خرید قابل استفاده است/g, 'این آیتم با مواد قابل‌دسترس طراحی شده و برای برنامه غذایی، جستجو و لیست خرید آماده است')
    .replace(/مواد شناسه[‌ ]?دار دیکشنری [۰-۹0-9]+تایی/g, 'مواد قابل‌دسترس')
    .replace(/شناسه[‌ ]?دار/g, 'قابل‌ردیابی')
    .replace(/دیکشنری [۰-۹0-9]+تایی/g, 'فهرست مواد')
    .replace(/دیتابیس/g, 'اطلاعات فعلی')
    .replace(/پایگاه داده/g, 'اطلاعات فعلی')
    .replace(/ماده اصلی/g, 'بخش اصلی')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function cleanValue(value: any): any {
  if (typeof value === 'string') return cleanText(value);
  if (Array.isArray(value)) return value.map(cleanValue);
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [key, item] of Object.entries(value)) out[key] = cleanValue(item);
    if (typeof out.q === 'string' && typeof out.question === 'string') out.question = out.q;
    if (typeof out.a === 'string' && typeof out.answer === 'string') out.answer = out.a;
    return out;
  }
  return value;
}

function parseJsonArray(value: any) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function main() {
  localDbGuard();
  const prisma = new PrismaClient();
  try {
    const beforeCount = await prisma.recipe.count();
    const recipes = await prisma.recipe.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        faq: true,
        chefTips: true,
        commonMistakes: true,
        servingSuggestions: true,
        tips: true,
        substitutions: true,
        gris: true,
      },
    });
    const targets = recipes.filter((recipe) => RESIDUE_RE.test(JSON.stringify(recipe)));
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(ROLLBACK, `${JSON.stringify({ generatedAt: new Date().toISOString(), beforeCount, recipes: targets }, null, 2)}\n`, 'utf8');

    let updated = 0;
    await prisma.$transaction(async (tx) => {
      for (const recipe of targets) {
        await tx.recipe.update({
          where: { id: recipe.id },
          data: {
            description: cleanText(recipe.description || ''),
            faq: JSON.stringify(cleanValue(parseJsonArray(recipe.faq))),
            chefTips: JSON.stringify(cleanValue(parseJsonArray(recipe.chefTips))),
            commonMistakes: JSON.stringify(cleanValue(parseJsonArray(recipe.commonMistakes))),
            servingSuggestions: JSON.stringify(cleanValue(parseJsonArray(recipe.servingSuggestions))),
            tips: JSON.stringify(cleanValue(parseJsonArray(recipe.tips))),
            substitutions: JSON.stringify(cleanValue(parseJsonArray(recipe.substitutions))),
            gris: cleanValue(recipe.gris || {}),
          },
        });
        updated += 1;
      }
    }, { timeout: 600000, maxWait: 30000 });

    const afterCount = await prisma.recipe.count();
    const report = {
      generatedAt: new Date().toISOString(),
      beforeCount,
      afterCount,
      updated,
      created: 0,
      deleted: 0,
      rollback: ROLLBACK,
      ok: beforeCount === afterCount,
    };
    fs.writeFileSync(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    fs.writeFileSync(REPORT_MD, [
      '# Copy Quality Template Residue Repair Report',
      '',
      `- generatedAt: ${report.generatedAt}`,
      `- recipe count before: ${beforeCount}`,
      `- recipe count after: ${afterCount}`,
      `- updated recipes: ${updated}`,
      '- created: 0',
      '- deleted: 0',
      '- changed scope: user-facing text residue in description/faq/tips/substitutions/commonMistakes/servingSuggestions/gris only',
      `- rollback: ${ROLLBACK}`,
      `- verdict: ${report.ok ? 'PASS' : 'FAIL'}`,
      '',
    ].join('\n'), 'utf8');
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
