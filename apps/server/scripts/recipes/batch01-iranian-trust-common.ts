import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
export const outDir = path.resolve(process.cwd(), '..', '..', 'docs', 'qa', 'recipes', 'recipe-trust-batch01-iranian');

export type Rule = {
  slug: string;
  titleFa: string;
  must: string[][];
  anyOf?: string[][][];
  failIf?: RegExp[];
  decisionHint: string;
  exactBlocker: string;
};

export const rules: Rule[] = [
  { slug: 'abgoosht-ghanbid', titleFa: 'آبگوشت قنبید قم', decisionHint: 'RESTORE اگر DB مطابق باشد', must: [['lamb', 'گوشت', 'meat'], ['kohlrabi', 'قنبید', 'کلم قمری'], ['white_bean', 'لوبیا سفید'], ['wheat', 'گندم'], ['onion', 'پیاز'], ['tomato_paste', 'رب گوجه'], ['dried_lime', 'لیموعمانی', 'پودر لیموعمانی']], exactBlocker: 'نیازمند گوشت، قنبید/کلم قمری، لوبیا سفید، گندم، پیاز، رب گوجه و لیموعمانی است.' },
  { slug: 'abgoosht-matanjaneh-kermani', titleFa: 'آبگوشت متنجنه کرمانی', decisionHint: 'RESTORE/PATCH بسته به DB', must: [['lamb', 'گوشت', 'meat'], ['chickpea', 'نخود', 'pinto', 'لوبیا چیتی'], ['potato', 'سیب زمینی', 'سیب‌زمینی'], ['apricot', 'قیسی', 'برگه زردآلو'], ['quince', 'به'], ['walnut', 'گردو'], ['tomato_paste', 'رب گوجه'], ['dried_lime', 'لیموعمانی'], ['tarragon', 'ترخون', 'fenugreek', 'شنبلیله', 'parsley', 'جعفری']], exactBlocker: 'باید میوه خشک/به، گردو و سبزی معطر کرمانی داشته باشد؛ آبگوشت ساده قابل public نیست.' },
  { slug: 'abgoosht-kashk', titleFa: 'آبگوشت کشک', decisionHint: 'VARIANT-SENSITIVE', must: [['meat', 'گوشت', 'lamb'], ['chickpea', 'bean', 'lentil', 'نخود', 'لوبیا', 'عدس'], ['kashk', 'کشک'], ['mint', 'نعناع', 'onion', 'پیاز', 'garlic', 'سیر']], exactBlocker: 'variant-sensitive است؛ کشک، گوشت، حبوبات و طعم‌دهنده نعناع/پیاز/سیر باید روشن باشد و اگر بادمجان دارد عنوان/توضیح variant بخواهد.' },
  { slug: 'ash-e-anar', titleFa: 'آش انار', decisionHint: 'VARIANT-SENSITIVE', must: [['pomegranate', 'انار', 'رب انار', 'آب انار']], exactBlocker: 'انار/رب انار/آب انار باید عنصر مرکزی باشد.' },
  { slug: 'ash-e-jo', titleFa: 'آش جو', decisionHint: 'RESTORE اگر DB مطابق باشد', must: [['barley', 'جو'], ['chickpea', 'bean', 'lentil', 'نخود', 'لوبیا', 'عدس'], ['herb', 'سبزی'], ['kashk', 'کشک', 'mint', 'نعناع']], exactBlocker: 'بدون جو یا بدون منطق حبوبات/سبزی/کشک، آش جو قابل public نیست.' },
  { slug: 'ash-dandooni', titleFa: 'آش دندونی', decisionHint: 'RESTORE اگر DB مطابق باشد', must: [['wheat', 'گندم'], ['barley', 'جو'], ['rice', 'برنج'], ['chickpea', 'نخود'], ['bean', 'لوبیا'], ['lentil', 'عدس']], exactBlocker: 'هویت آش دندونی تنوع غله و حبوبات است؛ یک آش ساده کافی نیست.' },
  { slug: 'ash-doogh', titleFa: 'آش دوغ اردبیلی', decisionHint: 'RESTORE/PATCH', must: [['doogh', 'دوغ'], ['rice', 'برنج'], ['chickpea', 'نخود'], ['herb', 'سبزی', 'leek', 'تره', 'coriander', 'گشنیز'], ['garlic', 'سیر']], failIf: [/tomato_paste|رب گوجه/], exactBlocker: 'باید دوغ، برنج، نخود، سبزی و سیر داشته باشد و رب گوجه وارد هویت اصلی نشود.' },
  { slug: 'ash-sabzi-shirazi', titleFa: 'آش سبزی شیرازی', decisionHint: 'RESTORE اگر DB مطابق باشد', must: [['lamb', 'meat', 'گوشت'], ['rice', 'برنج'], ['chickpea', 'bean', 'lentil', 'نخود', 'لوبیا', 'عدس'], ['leek', 'تره'], ['tarragon', 'ترخون']], exactBlocker: 'آش سبزی شیرازی بدون گوشت، برنج، تره و ترخون کافی نیست.' },
  { slug: 'ash-sholeh-ghalamkar', titleFa: 'آش شله قلمکار', decisionHint: 'RESTORE اگر DB مطابق باشد', must: [['meat', 'گوشت'], ['wheat', 'bulgur', 'گندم', 'بلغور'], ['rice', 'برنج'], ['chickpea', 'bean', 'lentil', 'نخود', 'لوبیا', 'عدس'], ['herb', 'سبزی']], exactBlocker: 'باید سنگین، چندحبوبه/چندغله، گوشتی و با پخت طولانی باشد.' },
  { slug: 'albaloo-polo-ba-morgh', titleFa: 'آلبالو پلو با مرغ یا گوشت', decisionHint: 'RESTORE/PATCH', must: [['sour_cherry', 'آلبالو'], ['rice', 'برنج'], ['sugar', 'شکر'], ['saffron', 'زعفران'], ['chicken', 'مرغ', 'meatball', 'گوشت قلقلی', 'meat', 'گوشت']], exactBlocker: 'بدون آلبالو، برنج، تعادل ملس/شکر، زعفران و variant مرغ/گوشت قابل public نیست.' },
  { slug: 'anar-polo-shirazi', titleFa: 'انارپلو شیرازی', decisionHint: 'RESTORE اگر DB مطابق باشد', must: [['pomegranate', 'دانه انار', 'انار'], ['rice', 'برنج'], ['chicken', 'مرغ'], ['coriander', 'گشنیز'], ['pistachio', 'پسته', 'almond', 'بادام'], ['saffron', 'زعفران']], exactBlocker: 'انارپلو شیرازی باید دانه انار، مرغ، گشنیز، خلال پسته/بادام و زعفران داشته باشد.' },
  { slug: 'baghali-polo-ba-goosht', titleFa: 'باقالی پلو با گوشت', decisionHint: 'RESTORE اگر DB مطابق باشد', must: [['rice', 'برنج'], ['fava', 'broad_bean', 'baghali', 'باقالی'], ['dill', 'شوید'], ['meat', 'lamb', 'shank', 'neck', 'گوشت', 'ماهیچه', 'گردن']], exactBlocker: 'بدون باقالی یا شوید یا گوشت مجلسی، هویت باقالی‌پلو با گوشت ناقص است.' },
  { slug: 'boz-ghormeh-kermani', titleFa: 'بزقرمه کرمانی', decisionHint: 'RESTORE/PATCH', must: [['lamb', 'goat', 'meat', 'گوشت'], ['chickpea', 'نخود'], ['kashk', 'کشک'], ['garlic', 'سیر', 'onion', 'پیاز'], ['mint', 'نعناع', 'onion', 'پیازداغ']], failIf: [/tomato_stew|خورش گوجه/], exactBlocker: 'بزقرمه باید گوشت، نخود، کشک و سیر/پیاز/نعناع داشته باشد؛ خورش گوجه‌ای یا آبگوشت ساده نیست.' },
  { slug: 'tas-kabab', titleFa: 'تاس‌کباب', decisionHint: 'RESTORE اگر DB مطابق باشد', must: [['meat', 'گوشت'], ['onion', 'پیاز'], ['potato', 'سیب زمینی', 'سیب‌زمینی'], ['tomato', 'گوجه', 'carrot', 'هویج', 'quince', 'به'], ['braise', 'آرام', 'لایه', 'خوراک']], exactBlocker: 'تاس‌کباب خوراک لایه‌ای/آرام‌پز است، نه کباب سیخی یا کوفته.' },
  { slug: 'saffron-joojeh-kabab', titleFa: 'جوجه کباب زعفرانی', decisionHint: 'RESTORE اگر DB مطابق باشد', must: [['chicken', 'مرغ'], ['saffron', 'زعفران'], ['onion', 'پیاز'], ['lemon', 'آبلیمو', 'acid', 'اسید'], ['oil', 'butter', 'روغن', 'کره'], ['grill', 'skewer', 'کباب', 'سیخ']], exactBlocker: 'باید مرغ تکه‌ای، زعفران، پیاز، اسید، چربی و تکنیک کباب/سیخ داشته باشد.' },
  { slug: 'khoresh-aloo', titleFa: 'خورش آلو', decisionHint: 'RESTORE/PATCH', must: [['plum', 'prune', 'آلو'], ['meat', 'chicken', 'گوشت', 'مرغ'], ['onion', 'پیاز'], ['saffron', 'زعفران'], ['tomato_paste', 'رب گوجه', 'sweet-sour', 'ملس']], exactBlocker: 'بدون آلو/آلو بخارا خورش آلو نیست.' },
  { slug: 'khoresh-morgh-qeysi', titleFa: 'خورش مرغ قیسی', decisionHint: 'RESTORE/PATCH', must: [['chicken', 'مرغ'], ['apricot', 'qeysi', 'قیسی', 'برگه زردآلو'], ['plum', 'prune', 'آلو'], ['onion', 'پیاز'], ['saffron', 'زعفران'], ['sweet-sour', 'ملس']], exactBlocker: 'بدون قیسی/برگه زردآلو نباید public شود.' },
  { slug: 'khoresh-bademjan', titleFa: 'خورشت بادمجان', decisionHint: 'RESTORE اگر DB مطابق باشد', must: [['eggplant', 'بادمجان'], ['meat', 'chicken', 'گوشت', 'مرغ'], ['onion', 'پیاز'], ['tomato', 'tomato_paste', 'گوجه', 'رب گوجه']], exactBlocker: 'بدون بادمجان و تکنیک آماده‌سازی/سرخ‌کردن بادمجان، هویت خورشت بادمجان ناقص است.' },
  { slug: 'khoresh-rivas', titleFa: 'خورشت ریواس', decisionHint: 'RESTORE/PATCH', must: [['rhubarb', 'ریواس'], ['meat', 'گوشت'], ['onion', 'پیاز'], ['parsley', 'جعفری'], ['mint', 'نعناع'], ['sour', 'ترش']], exactBlocker: 'بدون ریواس، جعفری/نعناع و پروفایل ترش، خورشت ریواس قابل public نیست.' },
  { slug: 'khoresh-havij-tabrizi', titleFa: 'خورشت هویج تبریزی', decisionHint: 'RESTORE/PATCH', must: [['carrot', 'هویج'], ['meat', 'chicken', 'گوشت', 'مرغ'], ['plum', 'prune', 'آلو'], ['saffron', 'زعفران'], ['sweet-sour', 'ملس', 'ترش']], exactBlocker: 'بدون هویج، آلو و هویت ملس تبریزی، restore امن نیست.' },
];

export function ensureOutDir() {
  fs.mkdirSync(outDir, { recursive: true });
}

export function writeJson(name: string, value: unknown) {
  ensureOutDir();
  fs.writeFileSync(path.join(outDir, name), JSON.stringify(value, null, 2), 'utf8');
}

export function writeMd(name: string, value: string) {
  ensureOutDir();
  fs.writeFileSync(path.join(outDir, name), value, 'utf8');
}

export function writeCsv(name: string, rows: Record<string, unknown>[], headers?: string[]) {
  ensureOutDir();
  const cols = headers ?? Object.keys(rows[0] ?? { empty: '' });
  const cell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  fs.writeFileSync(path.join(outDir, name), [cols.map(cell).join(',')].concat(rows.map((r) => cols.map((c) => cell(r[c])).join(','))).join('\n') + '\n', 'utf8');
}

export function getDbUrl() {
  return process.env.DATABASE_URL ?? '';
}

export function redactedDbUrl() {
  return getDbUrl().replace(/:\/\/.*@/, '://***@');
}

export function assertLocalDatabase() {
  const url = getDbUrl();
  const lower = url.toLowerCase();
  const local = lower.includes('localhost') || lower.includes('127.0.0.1') || lower.includes('host.docker.internal');
  const dangerous = /(prod|production|neon|supabase|render|railway|amazonaws|rds|azure|cloudsql)/i.test(url);
  if (!local || dangerous) throw new Error(`DATABASE_URL_NOT_LOCAL_DEV:${redactedDbUrl()}`);
}

export async function getCounts() {
  const [totalRecipes, activePublic, draftPrivate, ingredientCount, mezePublic] = await Promise.all([
    prisma.recipe.count(),
    prisma.recipe.count({ where: { status: 'active', isPublic: true } }),
    prisma.recipe.count({ where: { NOT: { status: 'active', isPublic: true } } }),
    prisma.ingredient.count(),
    prisma.recipe.count({ where: { id: { startsWith: 'meze50_' }, status: 'active', isPublic: true } }),
  ]);
  return { totalRecipes, activePublic, draftPrivate, ingredientCount, mezePublic };
}

export function parseJson(value: unknown, fallback: any = null) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

export function textValues(value: unknown): string {
  const parts: string[] = [];
  const walk = (v: unknown) => {
    if (v == null) return;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') { parts.push(String(v)); return; }
    if (Array.isArray(v)) return v.forEach(walk);
    if (typeof v === 'object') Object.values(v as Record<string, unknown>).forEach(walk);
  };
  walk(value);
  return parts.join(' ');
}

export function recipeBlob(recipe: any) {
  return textValues({
    title: recipe?.title,
    description: recipe?.description,
    category: recipe?.category,
    region: recipe?.region,
    categories: parseJson(recipe?.categories, []),
    allergens: parseJson(recipe?.allergens, []),
    tips: parseJson(recipe?.tips, []),
    faq: parseJson(recipe?.faq, []),
    gris: recipe?.gris,
    ingredients: recipe?.ingredients?.map((ri: any) => ({ name: ri.name, amount: ri.amount, unit: ri.unit, notes: parseJson(ri.notes, ri.notes), code: ri.ingredient?.code, nameFa: ri.ingredient?.nameFa, nameEn: ri.ingredient?.nameEn })),
    steps: recipe?.steps?.map((s: any) => ({ title: s.title, instruction: s.instruction })),
    searchTerms: recipe?.searchTerms?.map((s: any) => s.term),
  }).toLowerCase().replace(/[‌\u200c]/g, ' ');
}

export async function loadBatchRecipes() {
  const all = await prisma.recipe.findMany({
    include: {
      ingredients: { orderBy: { order: 'asc' }, include: { ingredient: true } },
      steps: { orderBy: { order: 'asc' } },
      searchTerms: true,
      nutrition: true,
    },
  });
  const bySlug = new Map<string, any>();
  for (const recipe of all) {
    const adminSlug = parseJson(recipe.adminNote, {})?.slug;
    if (adminSlug) bySlug.set(adminSlug, recipe);
  }
  return rules.map((rule) => ({ rule, recipe: bySlug.get(rule.slug) }));
}

function matchesAny(blob: string, terms: string[]) {
  return terms.some((term) => blob.includes(term.toLowerCase()));
}

export function evaluate(rule: Rule, recipe: any) {
  if (!recipe) return { status: 'KEEP_REVIEWONLY_WITH_EXACT_REASON', missing: ['recipe not found by slug'], forbidden: [], exactBlocker: 'رسپی با slug موردنظر پیدا نشد.' };
  const blob = recipeBlob(recipe);
  const missing = rule.must.filter((group) => !matchesAny(blob, group)).map((group) => group.join(' / '));
  const forbidden = (rule.failIf ?? []).filter((re) => re.test(blob)).map((re) => String(re));
  const status = missing.length === 0 && forbidden.length === 0 ? 'RESTORE_PUBLIC_AS_IS' : 'KEEP_REVIEWONLY_WITH_EXACT_REASON';
  return {
    status,
    missing,
    forbidden,
    exactBlocker: status === 'RESTORE_PUBLIC_AS_IS' ? '' : `${rule.exactBlocker} Missing/failed signals: ${missing.concat(forbidden).join(' ; ')}`,
  };
}

export function rollbackEntry(recipe: any, slug: string) {
  return {
    recipeId: recipe.id,
    slug,
    titleFa: recipe.title,
    status: recipe.status,
    isPublic: recipe.isPublic,
    adminNote: recipe.adminNote,
    updatedAt: recipe.updatedAt,
  };
}

export async function regressionStatus() {
  const [gamaj, qeymeh] = await Promise.all([
    prisma.recipe.findUnique({ where: { id: 'garnish_recipe_fa_104_7b4ced78' }, include: { ingredients: { include: { ingredient: true } }, searchTerms: true } }),
    prisma.recipe.findUnique({ where: { id: 'garnish_recipe_fa_170_44f0d2ad' }, include: { ingredients: { include: { ingredient: true } }, searchTerms: true } }),
  ]);
  const ingBlob = (r: any) => textValues([...(r?.ingredients ?? []).flatMap((ri: any) => [ri.name, ri.ingredient?.code, ri.ingredient?.nameFa, ri.ingredient?.nameEn]), ...(r?.searchTerms ?? []).map((t: any) => t.term)]).toLowerCase();
  const gamajFail = !gamaj || /(^|[^a-z])egg([^a-z]|$)|egg_|_egg|تخم مرغ/.test(ingBlob(gamaj));
  const qeymehFail = !qeymeh || /split_pea|split peas|لپه/.test(ingBlob(qeymeh));
  return { gamaj: gamajFail ? 'FAIL' : 'PASS', qeymeh: qeymehFail ? 'FAIL' : 'PASS' };
}
