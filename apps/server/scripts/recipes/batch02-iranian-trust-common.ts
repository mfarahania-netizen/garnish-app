import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
export const outDir = path.resolve(process.cwd(), '..', '..', 'docs', 'qa', 'recipes', 'recipe-trust-batch02-iranian');

export type Rule = { scope: 'A' | 'B'; slug: string; titleFa: string; must: string[][]; exactBlocker: string };

export const rules: Rule[] = [
  { scope: 'A', slug: 'ash-dandooni', titleFa: 'آش دندونی', must: [['wheat', 'گندم'], ['barley', 'جو'], ['rice', 'برنج'], ['chickpea', 'نخود'], ['bean', 'لوبیا'], ['lentil', 'عدس'], ['onion', 'پیاز']], exactBlocker: 'آش دندونی باید مخلوط غله و حبوبات شامل گندم، جو، برنج، نخود، لوبیا، عدس و پیاز داشته باشد.' },
  { scope: 'A', slug: 'ash-sabzi-shirazi', titleFa: 'آش سبزی شیرازی', must: [['lamb', 'meat', 'گوشت'], ['rice', 'برنج'], ['chickpea', 'bean', 'lentil', 'نخود', 'لوبیا', 'عدس'], ['leek', 'تره'], ['tarragon', 'ترخون'], ['onion', 'پیاز']], exactBlocker: 'آش سبزی شیرازی باید گوشت، برنج، حبوبات، تره، ترخون و پیاز داشته باشد.' },
  { scope: 'A', slug: 'khoresh-havij-tabrizi', titleFa: 'خورشت هویج تبریزی', must: [['carrot', 'هویج'], ['meat', 'chicken', 'گوشت', 'مرغ'], ['plum', 'prune', 'آلو'], ['saffron', 'زعفران'], ['onion', 'پیاز'], ['tomato_paste', 'رب گوجه'], ['sweet-sour', 'ملس', 'ترش']], exactBlocker: 'خورشت هویج تبریزی باید هویج، گوشت/مرغ، آلو، زعفران، پیاز، رب گوجه و تعادل ملس داشته باشد.' },
  { scope: 'B', slug: 'dampokhtak-mash-polo', titleFa: 'دمپختک / ماش‌پلو تهرانی', must: [['rice', 'برنج'], ['mung', 'ماش'], ['onion', 'پیاز'], ['turmeric', 'زردچوبه'], ['oil', 'butter', 'روغن', 'کره']], exactBlocker: 'باید برنج، ماش، پیاز، زردچوبه و چربی پخت دمی داشته باشد.' },
  { scope: 'B', slug: 'reshteh-polo-shirazi', titleFa: 'رشته‌پلو شیرازی', must: [['rice', 'برنج'], ['reshteh', 'رشته'], ['onion', 'پیاز', 'aromatic'], ['saffron', 'زعفران', 'cinnamon', 'دارچین']], exactBlocker: 'باید رشته پلویی و هویت برنج جشن/ملس-معطر داشته باشد.' },
  { scope: 'B', slug: 'zireh-polo-kermani', titleFa: 'زیره‌پلو کرمانی', must: [['rice', 'برنج'], ['cumin', 'زیره'], ['kerman', 'کرمان'], ['onion', 'پیاز', 'aromatic']], exactBlocker: 'زیره باید عطر مرکزی باشد و هویت کرمانی روشن باشد.' },
  { scope: 'B', slug: 'shami-kabab-lorestan', titleFa: 'شامی کباب لرستانی', must: [['ground', 'minced', 'چرخ'], ['meat', 'گوشت'], ['onion', 'پیاز'], ['chickpea_flour', 'آرد نخودچی', 'binder', 'egg', 'تخم'], ['lorestan', 'لرستان']], exactBlocker: 'باید شامی/کتلت گوشت چرخ‌کرده با پیاز، binder و هویت لرستانی باشد.' },
  { scope: 'B', slug: 'sholeh-mashhadi', titleFa: 'شله مشهدی', must: [['meat', 'گوشت'], ['wheat', 'bulgur', 'گندم', 'بلغور'], ['rice', 'برنج'], ['chickpea', 'bean', 'lentil', 'نخود', 'لوبیا', 'عدس'], ['mashhad', 'مشهد'], ['slow', 'کشدار', 'طولانی']], exactBlocker: 'شله مشهدی باید گوشتی، چندحبوبه/چندغله، مشهدی و کشدار باشد.' },
  { scope: 'B', slug: 'shirin-polo', titleFa: 'شیرین‌پلو / مرصع‌پلو', must: [['rice', 'برنج'], ['chicken', 'مرغ'], ['saffron', 'زعفران'], ['orange', 'citrus', 'پرتقال', 'نارنج'], ['almond', 'pistachio', 'بادام', 'پسته'], ['barberry', 'raisins', 'زرشک', 'کشمش'], ['sugar', 'شکر', 'sweet', 'شیرین']], exactBlocker: 'باید برنج شیرین/مرصع با زعفران، مرغ، خلال مرکبات، مغزها و تعادل شیرین باشد.' },
  { scope: 'B', slug: 'adas-polo-ba-goosht', titleFa: 'عدس‌پلو با گوشت', must: [['rice', 'برنج'], ['lentil', 'عدس'], ['meat', 'گوشت'], ['onion', 'پیاز'], ['cinnamon', 'دارچین', 'warm spice']], exactBlocker: 'عدس‌پلو با گوشت باید برنج، عدس، گوشت، پیاز و عطر گرم داشته باشد.' },
  { scope: 'B', slug: 'ghanbar-polo-shirazi', titleFa: 'قنبرپلو شیرازی', must: [['rice', 'برنج'], ['ground', 'meatball', 'چرخ', 'قلقلی'], ['walnut', 'گردو'], ['raisins', 'کشمش'], ['pomegranate_paste', 'رب انار'], ['shiraz', 'شیراز']], exactBlocker: 'قنبرپلو باید گوشت قلقلی/چرخ‌کرده، گردو، کشمش، رب انار و هویت شیرازی داشته باشد.' },
  { scope: 'B', slug: 'gheymeh-nesar', titleFa: 'قیمه نثار قزوینی', must: [['rice', 'برنج'], ['meat', 'گوشت'], ['barberry', 'زرشک'], ['almond', 'pistachio', 'بادام', 'پسته'], ['orange', 'نارنج', 'پرتقال'], ['saffron', 'زعفران'], ['qazvin', 'قزوین']], exactBlocker: 'قیمه نثار باید برنج مجلسی قزوینی با گوشت، زرشک، خلال‌ها، نارنج/پرتقال و زعفران باشد.' },
  { scope: 'B', slug: 'loobia-polo-ba-goosht', titleFa: 'لوبیاپلو با گوشت چرخ‌کرده', must: [['rice', 'برنج'], ['green_bean', 'لوبیا سبز'], ['ground', 'چرخ'], ['meat', 'گوشت'], ['onion', 'پیاز'], ['tomato_paste', 'رب گوجه']], exactBlocker: 'لوبیاپلو باید لوبیا سبز، گوشت چرخ‌کرده، پیاز و رب گوجه داشته باشد.' },
  { scope: 'B', slug: 'morgh-torsh-gilani', titleFa: 'مرغ ترش گیلانی', must: [['chicken', 'مرغ'], ['pomegranate', 'verjuice', 'lemon', 'sour', 'ترش', 'رب انار', 'آبغوره'], ['herb', 'سبزی'], ['garlic', 'سیر', 'onion', 'پیاز'], ['gilan', 'گیلان']], exactBlocker: 'مرغ ترش باید مرغ، ترشی، سبزی، سیر/پیاز و هویت گیلانی داشته باشد.' },
  { scope: 'B', slug: 'kabab-bonab', titleFa: 'کباب بناب', must: [['lamb', 'meat', 'گوشت'], ['onion', 'پیاز'], ['salt', 'pepper', 'نمک', 'فلفل'], ['grill', 'skewer', 'سیخ', 'کباب'], ['bonab', 'بناب']], exactBlocker: 'کباب بناب باید گوشت قرمز چرب/چرخ‌کرده، سیخ/گریل و هویت بناب داشته باشد.' },
  { scope: 'B', slug: 'kabab-tabei-morgh', titleFa: 'کباب تابه‌ای مرغ', must: [['chicken', 'مرغ'], ['onion', 'پیاز'], ['pan', 'تابه'], ['saffron', 'زعفران', 'spice', 'ادویه']], exactBlocker: 'کباب تابه‌ای مرغ باید مرغ چرخ/خردشده، پیاز و تکنیک تابه‌ای داشته باشد.' },
  { scope: 'B', slug: 'kabab-tabei-goosht', titleFa: 'کباب تابه‌ای گوشت', must: [['ground', 'چرخ'], ['meat', 'گوشت'], ['onion', 'پیاز'], ['pan', 'تابه'], ['tomato', 'گوجه']], exactBlocker: 'کباب تابه‌ای گوشت باید گوشت چرخ‌کرده، پیاز و پخت تابه‌ای با گوجه داشته باشد.' },
  { scope: 'B', slug: 'kadoo-polo-mazandarani', titleFa: 'کدوپلو مازندرانی', must: [['rice', 'برنج'], ['pumpkin', 'squash', 'کدو'], ['onion', 'پیاز'], ['turmeric', 'cinnamon', 'زردچوبه', 'دارچین'], ['mazandaran', 'مازندران']], exactBlocker: 'کدوپلو باید برنج، کدو حلوایی، پیاز، عطر گرم و هویت مازندرانی داشته باشد.' },
  { scope: 'B', slug: 'kufteh-berenji', titleFa: 'کوفته برنجی', must: [['rice', 'برنج'], ['ground', 'چرخ'], ['meat', 'گوشت'], ['split_pea', 'لپه'], ['herb', 'سبزی'], ['onion', 'پیاز'], ['tomato_paste', 'رب گوجه', 'sour', 'ترش']], exactBlocker: 'کوفته برنجی باید برنج، گوشت چرخ‌کرده، لپه، سبزی، پیاز و سس/آب پخت داشته باشد.' },
  { scope: 'B', slug: 'mirza-ghasemi', titleFa: 'میرزا قاسمی', must: [['eggplant', 'بادمجان'], ['garlic', 'سیر'], ['tomato', 'گوجه'], ['egg', 'تخم مرغ'], ['gilan', 'گیلان']], exactBlocker: 'میرزاقاسمی باید بادمجان کبابی/دودی، سیر، گوجه، تخم‌مرغ و هویت گیلانی داشته باشد.' },
  { scope: 'B', slug: 'vavishka', titleFa: 'واویشکا', must: [['ground', 'meat', 'چرخ', 'گوشت'], ['onion', 'پیاز'], ['tomato', 'گوجه'], ['egg', 'تخم'], ['gilan', 'north', 'گیلان', 'شمال']], exactBlocker: 'واویشکا باید variant روشن گوشت/گوجه/پیاز و هویت شمالی داشته باشد.' },
  { scope: 'B', slug: 'kateh-shomali', titleFa: 'کته شمالی', must: [['rice', 'برنج'], ['water', 'آب'], ['salt', 'نمک'], ['oil', 'butter', 'روغن', 'کره'], ['absorption', 'dami', 'kateh', 'کته', 'دمی'], ['north', 'gilan', 'شمال', 'گیلان']], exactBlocker: 'کته شمالی باید روش جذب آب/کته، برنج، آب، نمک، چربی و هویت شمالی داشته باشد.' },
  { scope: 'B', slug: 'kaleh-joosh', titleFa: 'کاله‌جوش / کله‌جوش', must: [['kashk', 'کشک'], ['walnut', 'گردو'], ['onion', 'پیاز'], ['mint', 'نعناع'], ['turmeric', 'زردچوبه'], ['water', 'آب']], exactBlocker: 'کله‌جوش باید کشک، گردو، پیاز، نعناع خشک، زردچوبه و رقیق‌سازی/گرم‌کردن ملایم داشته باشد.' },
];

export function ensureOutDir() { fs.mkdirSync(outDir, { recursive: true }); }
export function writeJson(name: string, value: unknown) { ensureOutDir(); fs.writeFileSync(path.join(outDir, name), JSON.stringify(value, null, 2), 'utf8'); }
export function writeMd(name: string, value: string) { ensureOutDir(); fs.writeFileSync(path.join(outDir, name), value, 'utf8'); }

export function getDbUrl() { return process.env.DATABASE_URL ?? ''; }
export function redactedDbUrl() { return getDbUrl().replace(/:\/\/.*@/, '://***@'); }
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
export function parseJson(value: unknown, fallback: any = null) { if (value == null) return fallback; if (typeof value !== 'string') return value; try { return JSON.parse(value); } catch { return fallback; } }
export function textValues(value: unknown): string {
  const parts: string[] = [];
  const walk = (v: unknown) => { if (v == null) return; if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') { parts.push(String(v)); return; } if (Array.isArray(v)) return v.forEach(walk); if (typeof v === 'object') Object.values(v as Record<string, unknown>).forEach(walk); };
  walk(value); return parts.join(' ');
}
export function recipeBlob(recipe: any) {
  return textValues({ title: recipe?.title, description: recipe?.description, category: recipe?.category, region: recipe?.region, categories: parseJson(recipe?.categories, []), dishType: parseJson(recipe?.dishType, []), gris: recipe?.gris, ingredients: recipe?.ingredients?.map((ri: any) => ({ name: ri.name, code: ri.ingredient?.code, nameFa: ri.ingredient?.nameFa, nameEn: ri.ingredient?.nameEn, notes: parseJson(ri.notes, ri.notes) })), steps: recipe?.steps?.map((s: any) => ({ title: s.title, instruction: s.instruction })), searchTerms: recipe?.searchTerms?.map((s: any) => s.term) }).toLowerCase().replace(/[‌\u200c]/g, ' ');
}
export async function loadRecipes() {
  const all = await prisma.recipe.findMany({ include: { ingredients: { orderBy: { order: 'asc' }, include: { ingredient: true } }, steps: { orderBy: { order: 'asc' } }, searchTerms: true, nutrition: true } });
  const bySlug = new Map<string, any>();
  for (const recipe of all) { const slug = parseJson(recipe.adminNote, {})?.slug; if (slug) bySlug.set(slug, recipe); }
  return rules.map((rule) => ({ rule, recipe: bySlug.get(rule.slug) }));
}
function matches(blob: string, terms: string[]) { return terms.some((t) => blob.includes(t.toLowerCase())); }
export function evaluate(rule: Rule, recipe: any) {
  if (!recipe) return { status: 'KEEP_REVIEWONLY_WITH_EXACT_REASON', missing: ['recipe not found'], exactBlocker: 'رسپی با slug موردنظر پیدا نشد.' };
  const blob = recipeBlob(recipe);
  const missing = rule.must.filter((group) => !matches(blob, group)).map((group) => group.join(' / '));
  const status = missing.length === 0 ? 'RESTORE_PUBLIC_AS_IS' : 'KEEP_REVIEWONLY_WITH_EXACT_REASON';
  return { status, missing, exactBlocker: status === 'RESTORE_PUBLIC_AS_IS' ? '' : `${rule.exactBlocker} Missing signals: ${missing.join(' ; ')}` };
}
export function rollbackEntry(recipe: any, slug: string) { return { recipeId: recipe.id, slug, titleFa: recipe.title, status: recipe.status, isPublic: recipe.isPublic, adminNote: recipe.adminNote, updatedAt: recipe.updatedAt }; }
export async function regressionStatus() {
  const [gamaj, qeymeh] = await Promise.all([
    prisma.recipe.findUnique({ where: { id: 'garnish_recipe_fa_104_7b4ced78' }, include: { ingredients: { include: { ingredient: true } }, searchTerms: true } }),
    prisma.recipe.findUnique({ where: { id: 'garnish_recipe_fa_170_44f0d2ad' }, include: { ingredients: { include: { ingredient: true } }, searchTerms: true } }),
  ]);
  const ingBlob = (r: any) => textValues([...(r?.ingredients ?? []).flatMap((ri: any) => [ri.name, ri.ingredient?.code, ri.ingredient?.nameFa, ri.ingredient?.nameEn]), ...(r?.searchTerms ?? []).map((t: any) => t.term)]).toLowerCase();
  return { gamaj: !gamaj || /(^|[^a-z])egg([^a-z]|$)|egg_|_egg|تخم مرغ/.test(ingBlob(gamaj)) ? 'FAIL' : 'PASS', qeymeh: !qeymeh || /split_pea|split peas|لپه/.test(ingBlob(qeymeh)) ? 'FAIL' : 'PASS' };
}
export function patchGris(gris: any, marker: { label: string; ingredientId: string; code: string; note: string }) {
  const next = gris && typeof gris === 'object' ? JSON.parse(JSON.stringify(gris)) : {};
  next.ingredients = Array.isArray(next.ingredients) ? next.ingredients : [];
  if (!textValues(next.ingredients).toLowerCase().includes(marker.code)) next.ingredients.push({ name: marker.label, ingredientId: marker.ingredientId, code: marker.code, role: marker.note, group: 'هویت اصلی', amount: 'به میزان دستور', buyTip: 'تازه و سالم انتخاب شود', substitution: 'حذف نشود؛ برای هویت غذا لازم است' });
  next.steps = Array.isArray(next.steps) ? next.steps : [];
  if (!textValues(next.steps).toLowerCase().includes(marker.code)) next.steps.push({ order: next.steps.length + 1, title: `تکمیل هویت با ${marker.label}`, instruction: `${marker.label} را طبق نقش اصلی غذا وارد کنید تا عطر، بافت و هویت منطقه‌ای دستور کامل شود.`, usesIngredientIds: [marker.ingredientId] });
  next.whyItWorks = textValues(next.whyItWorks).includes(marker.label) ? next.whyItWorks : `${textValues(next.whyItWorks)} ${marker.label} برای ${marker.note} در این دستور نقش هویتی دارد.`.trim();
  return next;
}
