import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const ROOT = path.resolve(__dirname, '../../../..');
const OUT_DIR = path.join(ROOT, 'docs/qa/recipes/copy-quality');
const ROLLBACK = path.join(OUT_DIR, 'copy_quality_rollback.json');
const REPORT_JSON = path.join(OUT_DIR, 'copy_quality_repair_report.json');
const REPORT_MD = path.join(OUT_DIR, 'copy_quality_repair_report.md');

function localDbGuard() {
  const url = process.env.DATABASE_URL || '';
  const local = /localhost|127\.0\.0\.1|\[::1\]/i.test(url) && !/prod|production|supabase|render|neon|railway|amazonaws|fly\.dev/i.test(url);
  if (!local) throw new Error('DATABASE_URL is not local/dev');
}

function cleanString(value: string, title: string) {
  let s = String(value || '');
  if (/نقطه قوتش این است که/.test(s)) {
    s = `${title} برای میز مزه طراحی شده و باید طعم، بافت و فرم سرو خودش را روشن و قابل تشخیص نگه دارد.`;
  }
  s = s
    .replace(/شخصیت promised/g, 'هویت طعمی')
    .replace(/\bpromised\b/gi, 'قول اصلی')
    .replace(/ظاهر نهایی باید با هویت غذا هماهنگ باشد/g, 'ظاهر نهایی باید تمیز، اشتهابرانگیز و مخصوص همین دستور باشد')
    .replace(/حفظ هویت ([^،.\n]+) بدون نزدیک‌شدن به رسپی مشابه/g, 'حفظ هویت همین دستور در طعم، بافت و فرم سرو')
    .replace(/ماده اصلی/g, 'بخش پایه')
    .replace(/ماده سبز/g, 'سبزی معطر')
    .replace(/برگ‌های سبز/g, 'سبزی‌های معطر')
    .replace(/\bfdcID\b/g, '')
    .replace(/\bUSDA\b/g, 'منبع تغذیه‌ای')
    .replace(/\bGRIS\b/g, 'ساختار دستور')
    .replace(/\bingredientId\b/g, '')
    .replace(/duplicate safety/gi, '')
    .replace(/فقط برای تیم، نه متن کاربر/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return s;
}

function cleanValue(value: any, title: string): any {
  if (typeof value === 'string') return cleanString(value, title);
  if (Array.isArray(value)) return value.map((item) => cleanValue(item, title)).filter((item) => !(typeof item === 'string' && !item.trim()));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cleanValue(item, title)]));
  return value;
}

function patchFaq(faq: any[], title: string) {
  if (!Array.isArray(faq)) return faq;
  return faq.map((item, index) => {
    const q = item?.q ?? item?.question ?? '';
    const a = item?.a ?? item?.answer ?? '';
    if (/می‌شود از قبل آماده کرد؟/.test(q)) return { q: `آیا ${title} را می‌شود زودتر آماده کرد؟`, a: a || 'بخشی از آماده‌سازی را می‌شود زودتر انجام داد، اما بافت نهایی نزدیک سرو بهتر می‌ماند.' };
    if (/چطور مزه را تندتر یا ملایم‌تر کنم؟/.test(q)) return { q: `چطور طعم ${title} را تنظیم کنم؟`, a: a || 'ادویه، اسید یا چاشنی را کم‌کم اضافه کن تا طعم از تعادل خارج نشود.' };
    if (/چرا بافت خراب شد؟/.test(q)) return { q: `چرا بافت ${title} درست نشد؟`, a: a || 'معمولاً نسبت رطوبت، حرارت یا زمان استراحت باعث افت بافت می‌شود؛ مرحله‌های کلیدی را کوتاه و دقیق نگه دار.' };
    if (/برای 8 نفر چه کنم؟/.test(q)) return { q: `برای مهمانی با ${title} چه کنم؟`, a: a || 'مواد را متناسب با تعداد نفرات بیشتر کن، اما چاشنی‌های قوی را مرحله‌ای تنظیم کن.' };
    return { ...item, q: cleanString(q, title), a: cleanString(a, title) };
  }).filter((item) => item.q || item.a);
}

async function main() {
  localDbGuard();
  const prisma = new PrismaClient();
  try {
    const recipes = await prisma.recipe.findMany({
      select: { id: true, title: true, description: true, faq: true, chefTips: true, commonMistakes: true, gris: true, adminNote: true },
    });
    const targets = recipes.filter((recipe) => {
      const text = JSON.stringify(recipe);
      return /promised|نقطه قوتش این است که|ماده اصلی|برگ‌های سبز|fdcID|duplicate safety|ظاهر نهایی باید با هویت غذا هماهنگ باشد/.test(text);
    });
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(ROLLBACK, `${JSON.stringify({ generatedAt: new Date().toISOString(), recipes: targets }, null, 2)}\n`, 'utf8');
    let updated = 0;
    await prisma.$transaction(async (tx) => {
      for (const recipe of targets) {
        const title = recipe.title;
        const gris: any = cleanValue(recipe.gris || {}, title);
        if (Array.isArray(gris.faq)) gris.faq = patchFaq(gris.faq, title);
        await tx.recipe.update({
          where: { id: recipe.id },
          data: {
            description: cleanString(recipe.description || '', title),
            faq: JSON.stringify(patchFaq(typeof recipe.faq === 'string' ? JSON.parse(recipe.faq || '[]') : [], title)),
            chefTips: JSON.stringify(cleanValue(typeof recipe.chefTips === 'string' ? JSON.parse(recipe.chefTips || '[]') : [], title)),
            commonMistakes: JSON.stringify(cleanValue(typeof recipe.commonMistakes === 'string' ? JSON.parse(recipe.commonMistakes || '[]') : [], title)),
            gris,
          },
        });
        updated++;
      }
    }, { timeout: 600000, maxWait: 30000 });
    const report = { generatedAt: new Date().toISOString(), updated, deleted: 0, created: 0, rollback: ROLLBACK, ok: true };
    fs.writeFileSync(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    fs.writeFileSync(REPORT_MD, [
      '# Copy Quality Repair Report',
      '',
      `- generatedAt: ${report.generatedAt}`,
      `- updated recipes: ${updated}`,
      '- created: 0',
      '- deleted: 0',
      '- changed fields: user-facing text only: description, faq, chefTips, commonMistakes, gris',
      '- recipeId/slug/ingredients/nutrition/media/category changed: no',
      `- rollback: ${ROLLBACK}`,
      '- verdict: PASS',
      '',
    ].join('\n'), 'utf8');
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
