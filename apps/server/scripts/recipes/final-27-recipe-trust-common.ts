import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
export const outDir = path.resolve(process.cwd(), '..', '..', 'docs', 'qa', 'recipes', 'recipe-trust-final-27');

export type Rule = {
  slug: string;
  titleFa: string;
  country: string;
  must: string[][];
  forbidden?: string[][];
  exactBlocker: string;
};

export const rules: Rule[] = [
  { slug: 'avgolemono', titleFa: 'آوگولمونو', country: 'Greece', must: [['egg', 'whole_egg'], ['lemon'], ['stock', 'broth'], ['rice', 'orzo'], ['temper', 'غلیظ', 'نبرد', 'جوش'], ['greek', 'greece', 'یونان']], exactBlocker: 'Avgolemono must have egg, lemon, broth/base, rice/orzo, egg-lemon tempering logic, and Greek identity.' },
  { slug: 'stamppot', titleFa: 'استامپوت', country: 'Netherlands', must: [['potato'], ['mash', 'stamp', 'پوره', 'له'], ['kale', 'sauerkraut', 'endive', 'spinach', 'carrot', 'کلم'], ['butter', 'milk'], ['dutch', 'netherlands', 'هلند']], exactBlocker: 'Stamppot must be a Dutch potato mash with a vegetable and mash moisture/fat logic.' },
  { slug: 'estamboli-polo', titleFa: 'استانبولی پلو بدون گوشت', country: 'Iran', must: [['rice'], ['tomato'], ['potato'], ['onion'], ['turmeric', 'spice'], ['meatless', 'vegetarian', 'بدون گوشت'], ['steam', 'absorption', 'دم', 'دمی']], forbidden: [['beef_raw', 'lamb', 'chicken_raw', 'ground_beef', 'meat']], exactBlocker: 'Estamboli polo without meat must have rice, tomato, potato, onion, spice, meatless identity, and dami/absorption logic, with no meat ingredient.' },
  { slug: 'spaghetti-al-limone', titleFa: 'اسپاگتی آل لیمونه', country: 'Italy', must: [['spaghetti', 'pasta'], ['lemon'], ['butter', 'olive_oil'], ['parmesan', 'pecorino', 'cheese'], ['pasta water', 'emulsion', 'امولسیون', 'آب پاستا'], ['italy', 'italian', 'ایتال']], exactBlocker: 'Spaghetti al limone must be lemon-forward pasta with fat, cheese, and pasta-water/emulsion logic.' },
  { slug: 'spaghetti-aglio-e-olio', titleFa: 'اسپاگتی سیر و روغن', country: 'Italy', must: [['spaghetti', 'pasta'], ['garlic'], ['olive_oil'], ['pepper', 'chili', 'red_pepper'], ['pasta water', 'emulsion', 'آب پاستا'], ['italy', 'italian', 'ایتال']], forbidden: [['tomato_sauce', 'cream']], exactBlocker: 'Aglio e olio must have pasta, garlic, olive oil, pepper/chili, pasta-water tossing logic, and Italian identity.' },
  { slug: 'meat-strudel', titleFa: 'اشترودل گوشت', country: 'Central Europe', must: [['dough', 'pastry', 'phyllo', 'puff', 'خمیر'], ['ground', 'minced', 'beef', 'meat'], ['onion'], ['spice', 'paprika', 'pepper'], ['roll', 'fold', 'enclos', 'رول', 'پیچ'], ['bake', 'oven', 'فر']], exactBlocker: 'Meat strudel must have pastry/dough, minced meat filling, onion, seasoning, roll/fold technique, and oven baking.' },
  { slug: 'imam-bayildi', titleFa: 'امام بایلدی', country: 'Turkey', must: [['eggplant'], ['onion'], ['tomato'], ['garlic'], ['olive_oil'], ['stuff', 'split', 'شکم', 'باز'], ['turkish', 'turkey', 'ترک']], forbidden: [['beef_raw', 'lamb', 'ground_beef', 'meat']], exactBlocker: 'Imam bayildi must be Turkish olive-oil stuffed/split eggplant with onion, tomato, garlic, and no meat.' },
  { slug: 'borscht', titleFa: 'بورش', country: 'Eastern Europe', must: [['beet'], ['cabbage', 'root', 'carrot', 'potato'], ['onion', 'carrot'], ['stock', 'broth'], ['sour', 'vinegar', 'sour_cream'], ['ukrain', 'russian', 'polish', 'eastern', 'شرق']], exactBlocker: 'Borscht must be beet soup with vegetables, broth, sour element/serving, and Eastern European variant clarity.' },
  { slug: 'irish-stew', titleFa: 'خورش ایرلندی', country: 'Ireland', must: [['lamb', 'mutton', 'beef'], ['potato'], ['onion'], ['carrot', 'root'], ['slow', 'simmer', 'stew', 'آرام'], ['irish', 'ireland', 'ایرلند']], exactBlocker: 'Irish stew must have meat variant, potato, onion, root vegetable, slow stew technique, and Irish identity.' },
  { slug: 'red-lentil-soup', titleFa: 'سوپ عدس قرمز ترکی', country: 'Turkey', must: [['red_lentil', 'red lentil'], ['onion'], ['carrot', 'tomato_paste', 'potato', 'rice'], ['mint', 'chili', 'paprika', 'butter', 'oil'], ['smooth', 'velvety', 'نرم'], ['turkish', 'turkey', 'ترک']], exactBlocker: 'Turkish red lentil soup must have red lentils, aromatic/thickening base, Turkish aroma, smooth texture, and Turkish identity.' },
  { slug: 'miso-soup', titleFa: 'سوپ میسو', country: 'Japan', must: [['miso'], ['dashi', 'broth', 'base'], ['tofu'], ['wakame', 'seaweed'], ['scallion', 'green onion', 'پیازچه'], ['japan', 'japanese', 'ژاپن']], exactBlocker: 'Miso soup must have miso paste, dashi/base, tofu, wakame/seaweed, scallion marker, and Japanese identity.' },
  { slug: 'minestrone-soup', titleFa: 'سوپ مینسترونه', country: 'Italy', must: [['vegetable', 'zucchini', 'carrot', 'celery'], ['bean', 'beans'], ['tomato', 'stock', 'broth'], ['pasta', 'rice'], ['onion', 'carrot', 'celery'], ['italy', 'italian', 'ایتال']], exactBlocker: 'Minestrone must have mixed vegetables, beans, tomato/broth, pasta/rice, aromatic base, and Italian identity.' },
  { slug: 'fatteh', titleFa: 'فته', country: 'Levant', must: [['pita', 'bread'], ['chickpea', 'chicken', 'meat'], ['yogurt', 'tahini'], ['garlic'], ['nut', 'butter', 'oil'], ['levant', 'leban', 'sham', 'شام', 'لبنان']], exactBlocker: 'Fatteh must have toasted/fried bread, chickpea/meat variant, yogurt/tahini sauce, garlic, topping fat/nut, and Levantine identity.' },
  { slug: 'lasagna', titleFa: 'لازانیا', country: 'Italy', must: [['lasagna'], ['layer', 'لایه'], ['meat', 'ragu', 'vegetable', 'beef', 'ground_beef', 'گوشت'], ['bechamel', 'cheese', 'mozzarella', 'parmesan', 'بشامل'], ['bake', 'oven', 'فر']], exactBlocker: 'Lasagna must have sheets, layering, sauce/filling, bechamel/cheese, and oven baking.' },
  { slug: 'fish-and-chips', titleFa: 'ماهی و چیپس', country: 'Britain', must: [['fish', 'cod'], ['batter', 'breadcrumb', 'flour', 'coating'], ['fry', 'سرخ'], ['chips', 'fries', 'potato'], ['british', 'britain', 'انگلیس', 'بریتان']], exactBlocker: 'Fish and chips must have white fish, coating/batter, frying, chips/fries, and British identity.' },
  { slug: 'piri-piri-chicken', titleFa: 'مرغ پیری‌پیری', country: 'Portugal/Afro-Portuguese', must: [['chicken'], ['chili', 'pepper', 'piri', 'paprika'], ['garlic'], ['lemon', 'vinegar'], ['oil'], ['grill', 'roast', 'oven', 'فر']], exactBlocker: 'Piri-piri chicken must have chicken, chili heat, garlic, acid marinade, oil, and grill/roast technique.' },
  { slug: 'maqluba', titleFa: 'مقلوبه', country: 'Levant/Palestine', must: [['rice'], ['chicken', 'meat'], ['eggplant', 'cauliflower', 'potato'], ['spice', 'allspice', 'cinnamon'], ['layer', 'لایه'], ['invert', 'upside', 'flip', 'برگردان', 'وارونه'], ['levant', 'palestin', 'شام', 'فلسطین']], exactBlocker: 'Maqluba must have rice, meat/chicken, vegetable layer, spices, layered pot, inversion serving, and Levantine/Palestinian identity.' },
  { slug: 'alfredo-pasta', titleFa: 'پاستا آلفردو', country: 'Italy/American variant', must: [['pasta', 'fettuccine'], ['butter'], ['parmesan', 'cheese'], ['cream', 'milk', 'pasta water', 'emulsion', 'creamy', 'خامه', 'شیر']], exactBlocker: 'Alfredo must clearly match Roman butter-parmesan emulsion or American creamy Alfredo with pasta, butter, cheese, and creamy/emulsion logic.' },
  { slug: 'pasta-e-fagioli', titleFa: 'پاستا ای فاجولی', country: 'Italy', must: [['pasta'], ['bean'], ['broth', 'stock', 'liquid'], ['onion', 'celery', 'carrot', 'garlic'], ['italy', 'italian', 'ایتال']], exactBlocker: 'Pasta e fagioli must have pasta, beans, broth/bean liquid, aromatic base, and Italian identity.' },
  { slug: 'pesto-pasta', titleFa: 'پاستا پستو', country: 'Italy/Liguria', must: [['pasta'], ['basil', 'pesto', 'herb'], ['olive_oil'], ['cheese', 'parmesan'], ['nut', 'walnut', 'pine'], ['garlic'], ['italy', 'italian', 'ligur', 'ایتال']], exactBlocker: 'Pesto pasta must have pasta, pesto/herb sauce, oil, cheese, nut/seed, garlic, and Italian/Ligurian framing.' },
  { slug: 'polenta-con-funghi', titleFa: 'پلنتا با قارچ', country: 'Italy', must: [['polenta', 'cornmeal'], ['mushroom'], ['stock', 'broth', 'liquid', 'water'], ['butter', 'cheese', 'olive_oil'], ['saute', 'rag', 'قارچ'], ['italy', 'italian', 'ایتال']], exactBlocker: 'Polenta con funghi must have polenta/cornmeal, mushrooms, creamy liquid cooking, fat/cheese finish, mushroom topping, and Italian identity.' },
  { slug: 'pot-au-feu', titleFa: 'پوت‌او‌فو', country: 'France', must: [['beef'], ['carrot', 'turnip', 'potato', 'leek', 'onion', 'root'], ['broth', 'stock', 'liquid', 'water', 'آب', 'عصاره'], ['slow', 'simmer', 'gentle', 'آرام'], ['french', 'france', 'فرانس']], exactBlocker: 'Pot-au-feu must have beef, root vegetables, broth/simmering liquid, long gentle simmer, and French identity.' },
  { slug: 'pollo-al-ajillo', titleFa: 'پویو آل آخیو', country: 'Spain', must: [['chicken'], ['garlic'], ['olive_oil'], ['spanish', 'spain', 'اسپان'], ['pan', 'braise', 'fry', 'تابه']], exactBlocker: 'Pollo al ajillo must have chicken, lots of garlic, olive oil, Spanish identity, and pan-fry/braise technique.' },
  { slug: 'pierogi', titleFa: 'پیروگی لهستانی', country: 'Poland', must: [['dough', 'wrapper', 'خمیر'], ['potato', 'cheese', 'meat', 'cabbage', 'mushroom'], ['seal', 'fold', 'dumpling', 'تا'], ['boil', 'جوش'], ['polish', 'poland', 'لهستان']], exactBlocker: 'Pierogi must have dough wrapper, filling, sealing/folding dumpling technique, boiling, and Polish identity.' },
  { slug: 'swedish-meatballs', titleFa: 'کوفته سوئدی', country: 'Sweden', must: [['ground', 'meat', 'beef', 'pork'], ['onion'], ['breadcrumb', 'bread', 'milk'], ['egg'], ['allspice', 'white pepper', 'nutmeg'], ['gravy', 'sauce', 'cream', 'خامه'], ['swedish', 'sweden', 'سوئد']], exactBlocker: 'Swedish meatballs must have ground meat, onion, bread/milk binder, egg if supported, spice, creamy/brown gravy, and Swedish identity.' },
  { slug: 'kofte', titleFa: 'کوفته ترکی', country: 'Turkey', must: [['ground', 'meat', 'beef'], ['onion'], ['cumin', 'paprika', 'parsley', 'spice'], ['patty', 'meatball', 'shape', 'شکل'], ['grill', 'pan', 'تابه'], ['turkish', 'turkey', 'ترک']], forbidden: [['rice', 'split_pea']], exactBlocker: 'Turkish kofte must have ground meat, onion, Turkish spice/herb profile, shaped patties/meatballs, grill/pan cooking, and Turkish identity, without Iranian rice/split-pea koofteh identity.' },
  { slug: 'koenigsberger-klopse', titleFa: 'کونیگسبرگر کلوپسه', country: 'Germany/Prussia', must: [['ground', 'meat', 'beef'], ['onion'], ['breadcrumb', 'bread'], ['egg'], ['poach', 'gentle', 'آرام'], ['white', 'cream', 'creamy', 'خامه'], ['caper'], ['lemon', 'tangy'], ['german', 'prussian', 'آلمان']], exactBlocker: 'Koenigsberger Klopse must have meatballs, onion, bread binder, egg if supported, poaching/gentle cooking, white creamy caper sauce, lemon/tang, and German/Prussian identity.' },
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
    mealType: recipe?.mealType,
    dishType: parseJson(recipe?.dishType, recipe?.dishType),
    categories: parseJson(recipe?.categories, []),
    allergens: parseJson(recipe?.allergens, []),
    gris: recipe?.gris,
    ingredients: recipe?.ingredients?.map((ri: any) => ({
      name: ri.name,
      ingredientId: ri.ingredientId,
      code: ri.ingredient?.code,
      nameFa: ri.ingredient?.nameFa,
      nameEn: ri.ingredient?.nameEn,
      notes: parseJson(ri.notes, ri.notes),
    })),
    steps: recipe?.steps?.map((step: any) => ({ title: step.title, instruction: step.instruction })),
    searchTerms: recipe?.searchTerms?.map((term: any) => term.term),
  }).toLowerCase().replace(/\u200c/g, ' ');
}
export async function loadRecipes() {
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
    const slug = parseJson(recipe.adminNote, {})?.slug;
    if (slug) bySlug.set(slug, recipe);
  }
  return rules.map((rule) => ({ rule, recipe: bySlug.get(rule.slug) }));
}
function matches(blob: string, terms: string[]) {
  return terms.some((term) => blob.includes(term.toLowerCase().replace(/\u200c/g, ' ')));
}
export function grisCompleteness(recipe: any) {
  const required = ['story', 'glance', 'ingredients', 'steps', 'whyItWorks', 'skillsLearned', 'troubleshooting', 'variations', 'keep', 'serveWith', 'faq', 'nourishment', 'finish'];
  const gris = recipe?.gris;
  const missing = required.filter((key) => !(gris && typeof gris === 'object' && key in gris));
  return { ok: missing.length === 0, missing };
}
export function evaluate(rule: Rule, recipe: any) {
  if (!recipe) return { finalState: 'KEEP_REVIEWONLY_WITH_EXACT_REASON', missing: ['recipe not found'], forbiddenHits: [], exactBlocker: `Recipe not found for slug ${rule.slug}.` };
  const blob = recipeBlob(recipe);
  const missing = rule.must.filter((group) => !matches(blob, group)).map((group) => group.join(' / '));
  const forbiddenHits = (rule.forbidden ?? []).filter((group) => matches(blob, group)).map((group) => group.join(' / '));
  const completeness = grisCompleteness(recipe);
  if (!completeness.ok) missing.push(`GRIS missing ${completeness.missing.join(', ')}`);
  const finalState = missing.length === 0 && forbiddenHits.length === 0 ? 'RESTORE_PUBLIC_AS_IS' : 'KEEP_REVIEWONLY_WITH_EXACT_REASON';
  return {
    finalState,
    missing,
    forbiddenHits,
    exactBlocker: finalState === 'RESTORE_PUBLIC_AS_IS' ? '' : `${rule.exactBlocker} Missing: ${missing.join(' ; ') || '-'} Forbidden/contradiction: ${forbiddenHits.join(' ; ') || '-'}`,
  };
}
export function rollbackEntry(recipe: any, slug: string) {
  return { recipeId: recipe.id, slug, titleFa: recipe.title, status: recipe.status, isPublic: recipe.isPublic, adminNote: recipe.adminNote, updatedAt: recipe.updatedAt };
}
export async function regressionStatus() {
  const [gamaj, qeymeh] = await Promise.all([
    prisma.recipe.findUnique({ where: { id: 'garnish_recipe_fa_104_7b4ced78' }, include: { ingredients: { include: { ingredient: true } }, searchTerms: true } }),
    prisma.recipe.findUnique({ where: { id: 'garnish_recipe_fa_170_44f0d2ad' }, include: { ingredients: { include: { ingredient: true } }, searchTerms: true } }),
  ]);
  const ingBlob = (r: any) => textValues([...(r?.ingredients ?? []).flatMap((ri: any) => [ri.name, ri.ingredient?.code, ri.ingredient?.nameFa, ri.ingredient?.nameEn]), ...(r?.searchTerms ?? []).map((t: any) => t.term)]).toLowerCase();
  return {
    gamaj: !gamaj || /(^|[^a-z])egg([^a-z]|$)|egg_|_egg|تخم مرغ/.test(ingBlob(gamaj)) ? 'FAIL' : 'PASS',
    qeymeh: !qeymeh || /split_pea|split peas|لپه/.test(ingBlob(qeymeh)) ? 'FAIL' : 'PASS',
  };
}
