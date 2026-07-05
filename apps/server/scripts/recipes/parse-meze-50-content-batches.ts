import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const ROOT = path.resolve(__dirname, '../../../..');
const BATCH_DIR = path.join(ROOT, 'docs/qa/recipes/new-meze-50/content-batches');
const IMPORT_DIR = path.join(ROOT, 'docs/qa/recipes/new-meze-50/import');
const PLAN_V2_JSON = path.join(ROOT, 'docs/qa/recipes/new-meze-50/meze_50_candidate_plan_v2.json');
const STAGING_JSON = path.join(IMPORT_DIR, 'meze_50_staging.json');
const PARSE_REPORT = path.join(IMPORT_DIR, 'meze_50_parse_report.md');
const MAPPING_JSON = path.join(IMPORT_DIR, 'meze_50_ingredient_mapping_report.json');
const MAPPING_MD = path.join(IMPORT_DIR, 'meze_50_ingredient_mapping_report.md');

const EXPECTED_FILES = [
  'garnish_meze_50_batch_01_ranks_01_10_RTL.md',
  'garnish_meze_50_batch_02_ranks_11_20_RTL.md',
  'garnish_meze_50_batch_03_ranks_21_30_RTL.md',
  'garnish_meze_50_batch_04_ranks_31_40_RTL.md',
  'garnish_meze_50_batch_05_ranks_41_50_RTL.md',
];

const REQUIRED = [
  'story',
  'glance',
  'ingredients',
  'whyItWorks',
  'skillsLearned',
  'steps',
  'finish',
  'troubleshooting',
  'variations',
  'keep',
  'serveWith',
  'faq',
  'nourishment',
] as const;

type RequiredSection = typeof REQUIRED[number];

type MezeCandidate = {
  slug: string;
  titleFa: string;
  titleEn: string;
  cuisine: string;
  type: string;
  category: string;
  mealTypes: string[];
  ingredients?: Array<Record<string, any>>;
};

const SECTION_PATTERNS: Array<[RequiredSection, RegExp]> = [
  ['story', /داستان/],
  ['glance', /نگاه\s*اول/],
  ['ingredients', /مواد\s*لازم/],
  ['whyItWorks', /چرا.*آشپزی/],
  ['skillsLearned', /چی\s*یاد/],
  ['steps', /مراحل/],
  ['finish', /پایان|راز/],
  ['troubleshooting', /رفع\s*مشکل/],
  ['variations', /تغییرات/],
  ['keep', /نگه|نگهداری|گرم/],
  ['serveWith', /سرو\s*با/],
  ['faq', /سؤال|سوال/],
  ['nourishment', /ارزش\s*غذایی/],
];

const INTERNAL_PATTERNS = [
  /duplicate safety/i,
  /closest existing/i,
  /why distinct/i,
  /drift/i,
  /فقط\s+برای\s+تیم/,
  /نه\s+متن\s+کاربر/,
  /نزدیک‌ترین\s+رسپی/,
  /چرا\s+این\s+رسپی\s+distinct/,
];

const exactCode: Record<string, string> = {
  almond: 'almonds_raw',
  avocado: 'avocado_raw',
  baguette: 'baguette',
  basil: 'basil_fresh',
  beans: 'red_kidney_beans_canned_drained',
  beetroot: 'beetroot_raw',
  'bread crumbs': 'breadcrumbs',
  broccoli: 'broccoli_raw',
  bulgur: 'bulgur_fine_dry',
  butter: 'butter_unsalted',
  carrot: 'carrot_raw',
  cashew: 'cashews_raw',
  cauliflower: 'cauliflower_raw',
  'cheddar cheese': 'cheddar_cheese',
  cheese: 'cheddar_cheese',
  'cherry tomato': 'cherry_tomato_raw',
  chicken: 'chicken_breast_raw',
  'chickpea flour': 'chickpea_flour',
  chickpeas: 'chickpeas_canned_drained',
  chili: 'chili_pepper_raw',
  'chili flakes': 'red_pepper_flakes',
  'chili powder': 'red_pepper_flakes',
  chives: 'chives_fresh',
  cilantro: 'cilantro_fresh',
  corn: 'frozen_corn_kernels',
  'cream cheese': 'cream_cheese',
  cucumber: 'cucumber_raw',
  dill: 'dill_fresh',
  edamame: 'edamame_frozen',
  egg: 'whole_egg_raw',
  eggplant: 'eggplant_raw',
  'feta cheese': 'feta_cheese',
  flour: 'all_purpose_flour',
  garlic: 'garlic_raw',
  ginger: 'ginger_root_raw',
  gochujang: 'gochujang',
  'green onion': 'chives_fresh',
  'ground beef': 'ground_beef_raw',
  halloumi: 'halloumi_cheese',
  harissa: 'harissa_paste',
  herbs: 'sabzi_khordan_mix',
  honey: 'honey',
  'hot sauce': 'hot_sauce_cayenne',
  jalapeno: 'jalapeno_pepper_raw',
  kimchi: 'kimchi',
  labneh: 'labneh',
  lavash: 'lavash_bread',
  lemon: 'lemon_juice_bottled',
  lettuce: 'romaine_lettuce_raw',
  lime: 'lime_juice_bottled',
  mayonnaise: 'mayonnaise',
  'mini pepper': 'bell_pepper_raw',
  mint: 'mint_fresh',
  mozzarella: 'mozzarella_cheese',
  mushroom: 'button_mushroom_raw',
  mustard: 'dijon_mustard',
  olive: 'green_olives_pitted',
  'olive oil': 'olive_oil',
  onion: 'onion_raw',
  parmesan: 'parmesan_cheese',
  parsley: 'parsley_fresh',
  'peanut butter': 'peanut_butter_smooth',
  pepper: 'bell_pepper_raw',
  'phyllo dough': 'phyllo_dough',
  'pinto beans': 'canned_pinto_beans',
  pistachio: 'pistachios_raw',
  'pita bread': 'pita_bread',
  'pomegranate molasses': 'pomegranate_molasses',
  potato: 'potato_raw',
  'puff pastry': 'puff_pastry',
  'red lentils': 'red_lentils_dry',
  rice: 'short_grain_rice_raw',
  'rice vinegar': 'rice_vinegar',
  'roasted pepper': 'roasted_red_peppers_jarred',
  'roasted red pepper': 'roasted_red_peppers_jarred',
  rosemary: 'rosemary_dried',
  saffron: 'saffron',
  salt: 'salt_table',
  sesame: 'roasted_sesame_seeds',
  'sesame oil': 'toasted_sesame_oil',
  'smoked paprika': 'paprika_ground',
  'sour cream': 'sour_cream',
  'soy sauce': 'soy_sauce',
  spinach: 'spinach_raw',
  sumac: 'sumac_ground',
  'sweet potato': 'sweet_potato_raw',
  tahini: 'tahini',
  thyme: 'thyme_dried',
  tofu: 'tofu_firm',
  tomato: 'tomato_raw',
  'tomato paste': 'tomato_paste',
  tortilla: 'corn_tortilla',
  vinegar: 'white_vinegar',
  walnut: 'walnuts_raw',
  'white beans': 'white_beans_dry',
  yogurt: 'greek_yogurt_plain',
  yufka: 'phyllo_dough',
  zaatar: 'zaatar',
  zucchini: 'zucchini_raw',
};

const persianCodeAliases: Record<string, string> = {
  'آب لایم': 'lime_juice_bottled',
  'آب لیمو': 'lemon_juice_bottled',
  'آب‌لیمو': 'lemon_juice_bottled',
  'آرد سفید': 'all_purpose_flour',
  'آرد سوخاری': 'breadcrumbs',
  'آرد سوخاری یا خرده‌نان': 'breadcrumbs',
  'آرد سوخاری یا نان خشک خردشده': 'breadcrumbs',
  'آرد نخود': 'chickpea_flour',
  'آووکادو': 'avocado_raw',
  'آویشن خشک': 'thyme_dried',
  'ادامامه منجمد': 'edamame_frozen',
  'ارده': 'tahini',
  'بادام خام': 'almonds_raw',
  'بادام‌هندی خام': 'cashews_raw',
  'بادمجان': 'eggplant_raw',
  'باگت': 'baguette',
  'بروکلی': 'broccoli_raw',
  'بلغور ریز خشک': 'bulgur_fine_dry',
  'تاهینی': 'tahini',
  'تخم‌مرغ': 'whole_egg_raw',
  'تورتیلای ذرت': 'corn_tortilla',
  'توفوی سفت': 'tofu_firm',
  'جعفری تازه': 'parsley_fresh',
  'خامه ترش': 'sour_cream',
  'خردل دیژون': 'dijon_mustard',
  'خمیر فیلو': 'phyllo_dough',
  'خمیر پفکی': 'puff_pastry',
  'خیار': 'cucumber_raw',
  'دانه ذرت منجمد': 'frozen_corn_kernels',
  'رب انار': 'pomegranate_molasses',
  'رب گوجه‌فرنگی': 'tomato_paste',
  'رزماری خشک': 'rosemary_dried',
  'روغن زیتون': 'olive_oil',
  'روغن کنجد بوداده': 'toasted_sesame_oil',
  'ریحان تازه': 'basil_fresh',
  'زعتر': 'zaatar',
  'زنجبیل تازه': 'ginger_root_raw',
  'زیتون سبز بدون هسته': 'green_olives_pitted',
  'سرکه برنج': 'rice_vinegar',
  'سرکه سفید': 'white_vinegar',
  'سس تند کاین': 'hot_sauce_cayenne',
  'سس سویا': 'soy_sauce',
  'سس مایونز': 'mayonnaise',
  'سماق': 'sumac_ground',
  'سیب‌زمینی': 'potato_raw',
  'سیب‌زمینی شیرین': 'sweet_potato_raw',
  'سیر': 'garlic_raw',
  'سیر خام': 'garlic_raw',
  'سینه مرغ خام': 'chicken_breast_raw',
  'شوید تازه': 'dill_fresh',
  'عدس قرمز': 'red_lentils_dry',
  'عسل': 'honey',
  'فلفل دلمه‌ای': 'bell_pepper_raw',
  'فلفل دلمه‌ای کوچک یا تکه‌های فلفل دلمه‌ای': 'bell_pepper_raw',
  'فلفل قرمز پرک': 'red_pepper_flakes',
  'فلفل قرمز کبابی آماده': 'roasted_red_peppers_jarred',
  'فلفل هالوپینو': 'jalapeno_pepper_raw',
  'فلفل چیلی': 'chili_pepper_raw',
  'قارچ دکمه‌ای': 'button_mushroom_raw',
  'قارچ دکمه‌ای خام': 'button_mushroom_raw',
  'لبنه': 'labneh',
  'لوبیا سفید خشک': 'white_beans_dry',
  'لوبیا چیتی پخته یا کنسروی': 'canned_pinto_beans',
  'لوبیای قرمز پخته و آبکش‌شده': 'red_kidney_beans_canned_drained',
  'ماست یونانی ساده': 'greek_yogurt_plain',
  'موتزارلا': 'mozzarella_cheese',
  'نان پیتا': 'pita_bread',
  'نخود پخته و آبکش‌شده': 'chickpeas_canned_drained',
  'نعناع تازه': 'mint_fresh',
  'نمک خوراکی': 'salt_table',
  'هریسا': 'harissa_paste',
  'هویج خام': 'carrot_raw',
  'پاپریکا دودی': 'paprika_ground',
  'پرک فلفل قرمز': 'red_pepper_flakes',
  'پسته خام': 'pistachios_raw',
  'پنیر خامه‌ای': 'cream_cheese',
  'پنیر فتا': 'feta_cheese',
  'پنیر هالومی': 'halloumi_cheese',
  'پنیر پارمزان': 'parmesan_cheese',
  'پنیر چدار': 'cheddar_cheese',
  'پیاز': 'onion_raw',
  'پیاز خام': 'onion_raw',
  'پیازچه': 'chives_fresh',
  'پیازچه تازه': 'chives_fresh',
  'پیازچه یا ساقه سبز پیاز': 'chives_fresh',
  'چدار': 'cheddar_cheese',
  'چغندر خام': 'beetroot_raw',
  'کاهو رومی': 'romaine_lettuce_raw',
  'کدو سبز': 'zucchini_raw',
  'کره بادام‌زمینی نرم': 'peanut_butter_smooth',
  'کره بدون نمک': 'butter_unsalted',
  'کنجد برشته': 'roasted_sesame_seeds',
  'کنجد بوداده': 'roasted_sesame_seeds',
  'کیمچی': 'kimchi',
  'گردو': 'walnuts_raw',
  'گردو خام': 'walnuts_raw',
  'گشنیز تازه': 'cilantro_fresh',
  'گل‌کلم': 'cauliflower_raw',
  'گوجه گیلاسی': 'cherry_tomato_raw',
  'گوجه‌فرنگی': 'tomato_raw',
  'گوشت چرخ‌کرده گاو': 'ground_beef_raw',
  'گوچوجانگ': 'gochujang',
};

const faToEnDigits = (value: string) => String(value).replace(/[۰-۹٠-٩]/g, (digit) => {
  const fa = '۰۱۲۳۴۵۶۷۸۹';
  const ar = '٠١٢٣٤٥٦٧٨٩';
  const faIndex = fa.indexOf(digit);
  return faIndex >= 0 ? String(faIndex) : String(ar.indexOf(digit));
});

function writeJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function clean(value: string) {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function normalizeIngredientText(value: string) {
  return stripMd(value)
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[‌\u200c\-_\s،,؛;()]/g, '')
    .trim()
    .toLowerCase();
}

function resolveIngredientForDisplayName(name: string, candidate: any, ingredientByCode: Map<string, any>) {
  const aliasEntry = Object.entries(persianCodeAliases).find(([alias]) => normalizeIngredientText(alias) === normalizeIngredientText(name));
  const aliasCode = aliasEntry?.[1];
  if (aliasCode && ingredientByCode.has(aliasCode)) return ingredientByCode.get(aliasCode);

  const normalizedName = normalizeIngredientText(name);
  for (const ingredient of ingredientByCode.values()) {
    const fa = normalizeIngredientText(ingredient.nameFa || '');
    if (fa && (fa === normalizedName || fa.includes(normalizedName) || normalizedName.includes(fa))) return ingredient;
  }

  const coreMappings = new Map<string, any>();
  for (const mapping of candidate.matchedIngredientIds || []) coreMappings.set(mapping.term, mapping);
  for (const term of candidate.coreIngredients || []) {
    if (!normalizeIngredientText(name).includes(normalizeIngredientText(term))) continue;
    const code = coreMappings.get(term)?.code || exactCode[term];
    if (code && ingredientByCode.has(code)) return ingredientByCode.get(code);
  }
  return null;
}

function stripMd(value: string) {
  return clean(value)
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/^[#>\-*]+\s*/gm, '')
    .replace(/^[🧩🛒🔄⚖️📊💰🍽️🔧🤲⏲️🧊🔥❄️]+\s*/gm, '')
    .trim();
}

function sectionKey(title: string): RequiredSection | 'qaOnly' | null {
  const normalized = clean(title).replace(/\u200c/g, ' ');
  if (INTERNAL_PATTERNS.some((pattern) => pattern.test(normalized))) return 'qaOnly';
  for (const [key, pattern] of SECTION_PATTERNS) if (pattern.test(normalized)) return key;
  return null;
}

function splitRecipes(markdown: string, sourceFile: string) {
  const lines = clean(markdown).split('\n');
  const recipes: Array<{ rank: number; headingTitle: string; sourceFile: string; body: string }> = [];
  let current: { rank: number; headingTitle: string; sourceFile: string; lines: string[] } | null = null;
  const headingRe = /^##\s+([0-9۰-۹٠-٩]+)\)\s+(.+?)\s*$/;
  for (const line of lines) {
    const match = line.match(headingRe);
    if (match) {
      if (current) recipes.push({ ...current, body: current.lines.join('\n') });
      current = { rank: Number(faToEnDigits(match[1])), headingTitle: stripMd(match[2]), sourceFile, lines: [] };
      continue;
    }
    current?.lines.push(line);
  }
  if (current) recipes.push({ ...current, body: current.lines.join('\n') });
  return recipes;
}

function parseMeta(body: string) {
  const meta: Record<string, string> = {};
  for (const line of body.split('\n')) {
    const match = line.match(/^`([^:]+):\s*(.*?)`\s*$/);
    if (match) meta[match[1].trim()] = stripMd(match[2]);
  }
  return meta;
}

function splitSections(body: string) {
  const sections: Partial<Record<RequiredSection, string>> = {};
  const qaOnly: string[] = [];
  let currentKey: RequiredSection | 'qaOnly' | null = null;
  let buffer: string[] = [];
  function flush() {
    if (!currentKey) return;
    const text = clean(buffer.join('\n'));
    if (currentKey === 'qaOnly') qaOnly.push(text);
    else sections[currentKey] = [sections[currentKey], text].filter(Boolean).join('\n\n');
  }
  for (const line of body.split('\n')) {
    const heading = line.match(/^###\s+(.+?)\s*$/);
    if (heading) {
      flush();
      currentKey = sectionKey(heading[1]);
      buffer = [];
      continue;
    }
    if (currentKey) buffer.push(line);
  }
  flush();
  return { sections, qaOnly };
}

function parseGlance(section = '') {
  const lines = clean(section).split('\n').map(stripMd).filter(Boolean);
  const joined = lines.join('\n');
  const servingsMatch = joined.match(/(?:تعداد نفرات|نفرات):\s*([0-9۰-۹٠-٩]+)/);
  const handsOffMatch = joined.match(/بی‌?دخالت:\s*([0-9۰-۹٠-٩]+)/);
  const difficultyMatch = joined.match(/سختی:\s*([^\n]+)/);
  const costMatch = joined.match(/هزینه:\s*([^\n]+)/);
  const toolsMatch = joined.match(/ابزار:\s*([^\n]+)/);
  return {
    promise: lines.find((line) => !line.includes(':')) || '',
    handsOffMin: handsOffMatch ? Number(faToEnDigits(handsOffMatch[1])) : null,
    difficulty: difficultyMatch ? difficultyMatch[1].trim() : null,
    costBand: costMatch ? costMatch[1].trim() : null,
    servings: servingsMatch ? Number(faToEnDigits(servingsMatch[1])) : null,
    keyEquipment: toolsMatch ? toolsMatch[1].split(/،|,|·/).map((item) => item.trim()).filter(Boolean) : [],
  };
}

function parseIngredients(section = '', candidate: any, ingredientByCode: Map<string, any>) {
  const lines = clean(section).split('\n');
  let currentComponent = '';
  let current: any = null;
  const detailed: any[] = [];
  const pushCurrent = () => {
    if (current) detailed.push(current);
    current = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('####')) {
      pushCurrent();
      currentComponent = stripMd(line.replace(/^####\s*/, '').replace(/^برای\s+/, ''));
      continue;
    }
    const nameMatch = line.match(/^\*\*(.+?)\*\*/);
    if (nameMatch) {
      pushCurrent();
      const [name, prepState] = stripMd(nameMatch[1]).split(/\s+—\s+/);
      current = { name: name?.trim(), prepState: prepState?.trim() || null, component: currentComponent };
      continue;
    }
    if (!current) continue;
    const text = stripMd(line);
    if (/مقدار:/.test(text)) current.volume = text.replace(/^مقدار:\s*/, '').trim();
    else if (/نقش ماده:/.test(text)) current.role = text.replace(/^نقش ماده:\s*/, '').trim();
    else if (/نکته خرید:/.test(text)) current.buyTip = text.replace(/^نکته خرید:\s*/, '').trim();
    else if (/جایگزین واقعی:/.test(text)) current.swap = text.replace(/^جایگزین واقعی:\s*/, '').trim();
  }
  pushCurrent();

  return detailed.map((sourceLine, index) => {
    const ingredient = resolveIngredientForDisplayName(sourceLine.name || '', candidate, ingredientByCode);
    return {
      order: index + 1,
      name: sourceLine.name || ingredient?.nameFa || '',
      displayName: sourceLine.name || ingredient?.nameFa || '',
      ingredientId: ingredient?.id || null,
      code: ingredient?.code || null,
      amount: null,
      unit: null,
      displayUnit: null,
      volume: sourceLine.volume || null,
      weightG: null,
      prepState: sourceLine.prepState || null,
      role: sourceLine.role || null,
      buyTip: sourceLine.buyTip || null,
      swap: sourceLine.swap || null,
      component: sourceLine.component || '',
      optional: false,
      identityCritical: index < 2,
      canRemove: false,
      replacementCandidates: [],
      replacementReason: index < 2 ? 'identity ingredient; no safe automatic replacement' : '',
    };
  });
}

function parseList(section = '') {
  return clean(section).split('\n').map(stripMd).filter((line) => line && line !== '---');
}

function parseWhy(section = '') {
  return parseList(section).map((line) => {
    const [point, ...rest] = line.split(':');
    return { point: point?.trim() || line, explanation: rest.join(':').trim() || line };
  });
}

function parseSteps(section = '') {
  return clean(section).split('\n').map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const match = line.match(/^([0-9۰-۹٠-٩]+)[.)]\s*(?:\*\*(.+?)\*\*:?\s*)?(.+)$/);
    if (!match) return null;
    return { order: Number(faToEnDigits(match[1])) || index + 1, title: stripMd(match[2] || `مرحله ${index + 1}`), instruction: stripMd(match[3]) };
  }).filter(Boolean);
}

function parsePairs(section = '') {
  const out: any[] = [];
  const lines = clean(section).split('\n').map((line) => line.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const title = lines[i].match(/^\*\*(.+?)\*\*/);
    if (!title) continue;
    const next = lines[i + 1] && !lines[i + 1].startsWith('**') ? stripMd(lines[++i]).replace(/^←\s*/, '') : '';
    out.push({ problem: stripMd(title[1]), fix: next });
  }
  return out;
}

function parseVariations(section = '') {
  return parseList(section).map((line) => ({ name: line.split(':')[0].trim(), how: line }));
}

function parseKeep(section = '') {
  const lines = parseList(section);
  return {
    makeAhead: lines.find((line) => /آماده|زود/.test(line)) || null,
    storage: lines.find((line) => /یخچال|نگه/.test(line)) || null,
    reheat: lines.find((line) => /گرم|سرو دوباره/.test(line)) || null,
    freeze: lines.find((line) => /فریز/.test(line)) || null,
  };
}

function parseFaq(section = '') {
  const lines = clean(section).split('\n').map((line) => line.trim()).filter(Boolean);
  const out: any[] = [];
  for (let i = 0; i < lines.length; i++) {
    const question = lines[i].match(/^\*\*(.+?)\*\*/);
    if (!question) continue;
    const answer = lines[i + 1] && !lines[i + 1].startsWith('**') ? stripMd(lines[++i]) : '';
    out.push({ q: stripMd(question[1]), a: answer });
  }
  return out;
}

function containsInternalLeak(value: unknown): string[] {
  const text = JSON.stringify(value ?? '');
  return INTERNAL_PATTERNS.filter((pattern) => pattern.test(text)).map((pattern) => String(pattern));
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const plan = JSON.parse(fs.readFileSync(PLAN_V2_JSON, 'utf8'));
    const candidates = (plan.finalCandidates || []) as MezeCandidate[];
    const candidateBySlug = new Map<string, MezeCandidate>(candidates.map((candidate) => [candidate.slug, candidate]));
    const ingredientRows = await prisma.ingredient.findMany({ select: { id: true, code: true, nameFa: true, nameEn: true } });
    const ingredientByCode = new Map(ingredientRows.map((ingredient) => [ingredient.code, ingredient]));
    const parsed: any[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const fileName of EXPECTED_FILES) {
      const file = path.join(BATCH_DIR, fileName);
      if (!fs.existsSync(file)) {
        errors.push(`missing batch file: ${fileName}`);
        continue;
      }
      for (const recipeBlock of splitRecipes(fs.readFileSync(file, 'utf8'), fileName)) {
        const meta = parseMeta(recipeBlock.body);
        const slug = meta.slug;
        const candidate = candidateBySlug.get(slug);
        if (!candidate) {
          errors.push(`slug not found in v2 plan: ${slug}`);
          continue;
        }
        const { sections, qaOnly } = splitSections(recipeBlock.body);
        const missing = REQUIRED.filter((key) => !sections[key] || !clean(sections[key] || ''));
        if (missing.length) errors.push(`${slug}: missing sections ${missing.join(', ')}`);
        const ingredients = parseIngredients(sections.ingredients || '', candidate, ingredientByCode);
        const missingMappings = ingredients.filter((ingredient: any) => !ingredient.ingredientId || !ingredient.code);
        if (missingMappings.length) errors.push(`${slug}: missing ingredient mappings ${missingMappings.map((i: any) => i.name).join(', ')}`);
        const titleParts = recipeBlock.headingTitle.split(/\s+\/\s+/);
        const headingFa = titleParts[0]?.trim() || '';
        const headingEn = titleParts.slice(1).join(' / ').trim();
        if (candidate.titleFa !== headingFa) warnings.push(`${slug}: titleFa differs from v2 plan; using v2 title "${candidate.titleFa}" over batch heading "${headingFa}"`);
        if (candidate.titleEn !== headingEn) warnings.push(`${slug}: titleEn differs from v2 plan; using v2 title "${candidate.titleEn}" over batch heading "${headingEn}"`);
        const recipeId = `meze50_${String(recipeBlock.rank).padStart(2, '0')}_${slug}`;
        const grisIngredients = ingredients.map(({ ingredientId, code, ...ingredient }: any) => ingredient);
        const gris = {
          schemaVersion: 'meze50_v1',
          recipeId,
          slug,
          sourceGroup: 'meze-50-v1',
          story: { origin: stripMd(sections.story || ''), occasion: null },
          glance: parseGlance(sections.glance || ''),
          ingredients: grisIngredients,
          whyItWorks: parseWhy(sections.whyItWorks || ''),
          skillsLearned: parseList(sections.skillsLearned || ''),
          steps: parseSteps(sections.steps || ''),
          finish: { chefSecret: stripMd(sections.finish || '') },
          troubleshooting: parsePairs(sections.troubleshooting || ''),
          variations: parseVariations(sections.variations || ''),
          keep: parseKeep(sections.keep || ''),
          serveWith: parseList(sections.serveWith || ''),
          faq: parseFaq(sections.faq || ''),
          nourishment: { note: stripMd(sections.nourishment || ''), medicalClaimsAllowed: false, strictDietPlanningAllowed: false },
          qaOnly: undefined,
        };
        const leaks = containsInternalLeak(gris);
        if (leaks.length) errors.push(`${slug}: internal QA leak in user-facing JSON ${leaks.join(', ')}`);
        parsed.push({
          rank: recipeBlock.rank,
          recipeId,
          slug,
          titleFa: candidate.titleFa,
          titleEn: candidate.titleEn,
          cuisine: candidate.cuisine,
          type: candidate.type,
          category: candidate.category,
          mealTypes: candidate.mealTypes,
          sourceFile: recipeBlock.sourceFile,
          qaOnlyNotes: qaOnly,
          gris,
          ingredients,
        });
      }
    }

    const ranks = parsed.map((recipe) => recipe.rank);
    const slugs = parsed.map((recipe) => recipe.slug);
    const duplicateRanks = ranks.filter((rank, index) => ranks.indexOf(rank) !== index);
    const duplicateSlugs = slugs.filter((slug, index) => slugs.indexOf(slug) !== index);
    const missingPlanSlugs = candidates.map((candidate: any) => candidate.slug).filter((slug: string) => !slugs.includes(slug));
    const extraSlugs = slugs.filter((slug) => !candidateBySlug.has(slug));
    if (parsed.length !== 50) errors.push(`parsed count ${parsed.length}, expected 50`);
    if (duplicateRanks.length) errors.push(`duplicate ranks: ${duplicateRanks.join(', ')}`);
    if (duplicateSlugs.length) errors.push(`duplicate slugs: ${duplicateSlugs.join(', ')}`);
    if (missingPlanSlugs.length) errors.push(`missing v2 plan slugs: ${missingPlanSlugs.join(', ')}`);
    if (extraSlugs.length) errors.push(`extra slugs: ${extraSlugs.join(', ')}`);
    const mappingRows = parsed.flatMap((recipe) => recipe.ingredients.map((ingredient: any) => ({
      recipeId: recipe.recipeId,
      slug: recipe.slug,
      name: ingredient.name,
      ingredientId: ingredient.ingredientId,
      code: ingredient.code,
      ok: Boolean(ingredient.ingredientId && ingredient.code),
    })));
    const mappingErrors = mappingRows.filter((row) => !row.ok);
    const report = {
      generatedAt: new Date().toISOString(),
      parsedCount: parsed.length,
      expectedCount: 50,
      duplicateRanks,
      duplicateSlugs,
      missingPlanSlugs,
      extraSlugs,
      errors,
      warnings,
      ok: errors.length === 0,
    };
    writeJson(STAGING_JSON, { ...report, recipes: parsed });
    writeJson(MAPPING_JSON, { generatedAt: report.generatedAt, ok: mappingErrors.length === 0, totalLines: mappingRows.length, missing: mappingErrors, rows: mappingRows });
    fs.mkdirSync(IMPORT_DIR, { recursive: true });
    fs.writeFileSync(PARSE_REPORT, [
      '# Meze 50 Parse Report',
      '',
      `- generatedAt: ${report.generatedAt}`,
      `- parsedCount: ${report.parsedCount}`,
      `- duplicateRanks: ${duplicateRanks.length}`,
      `- duplicateSlugs: ${duplicateSlugs.length}`,
      `- missingPlanSlugs: ${missingPlanSlugs.length}`,
      `- extraSlugs: ${extraSlugs.length}`,
      `- errors: ${errors.length}`,
      `- warnings: ${warnings.length}`,
      `- verdict: ${report.ok ? 'PASS' : 'FAIL'}`,
      '',
      '## Errors',
      errors.length ? errors.map((error) => `- ${error}`).join('\n') : '- none',
      '',
      '## Warnings',
      warnings.length ? warnings.map((warning) => `- ${warning}`).join('\n') : '- none',
      '',
    ].join('\n'), 'utf8');
    fs.writeFileSync(MAPPING_MD, [
      '# Meze 50 Ingredient Mapping Report',
      '',
      `- generatedAt: ${report.generatedAt}`,
      `- total ingredient lines: ${mappingRows.length}`,
      `- missing mappings: ${mappingErrors.length}`,
      `- invented ingredients: 0`,
      `- verdict: ${mappingErrors.length === 0 ? 'PASS' : 'FAIL'}`,
      '',
      '| slug | name | ingredientId | code |',
      '|---|---|---|---|',
      ...mappingRows.map((row) => `| ${row.slug} | ${row.name} | ${row.ingredientId || ''} | ${row.code || ''} |`),
      '',
    ].join('\n'), 'utf8');
    console.log(JSON.stringify({ ok: report.ok, parsedCount: parsed.length, errors: errors.slice(0, 20) }, null, 2));
    if (!report.ok) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
