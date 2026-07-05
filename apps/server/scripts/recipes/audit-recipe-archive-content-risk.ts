import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Severity = 'P0' | 'P1' | 'P2' | 'P3';
type Issue = {
  severity: Severity;
  type: string;
  message: string;
  evidence?: string;
};

type Rule = {
  id: string;
  match: RegExp;
  country?: string;
  city?: string;
  province?: string;
  requiredAny?: string[][];
  forbidden?: string[];
  notes: string;
};

type Origin = { country: string; city?: string; province?: string };

const outDir = path.resolve(process.cwd(), '..', '..', 'docs', 'qa', 'recipes', 'archive-content-risk-audit-v1');
const now = new Date().toISOString();

function parseJson(value: unknown, fallback: any = null) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function asText(value: unknown) {
  return JSON.stringify(value ?? '').toLowerCase();
}

function faText(value: unknown) {
  return JSON.stringify(value ?? '');
}

function textValues(value: unknown): string {
  const parts: string[] = [];
  const walk = (v: unknown) => {
    if (v == null) return;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      parts.push(String(v));
      return;
    }
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    if (typeof v === 'object') {
      Object.values(v as Record<string, unknown>).forEach(walk);
    }
  };
  walk(value);
  return parts.join(' ');
}

function csvCell(value: unknown) {
  const s = String(value ?? '');
  return `"${s.replace(/"/g, '""')}"`;
}

function writeCsv(file: string, rows: Record<string, unknown>[]) {
  const headers = Object.keys(rows[0] ?? { empty: '' });
  const body = [headers.map(csvCell).join(',')]
    .concat(rows.map((row) => headers.map((h) => csvCell(row[h])).join(',')))
    .join('\n');
  fs.writeFileSync(path.join(outDir, file), `${body}\n`, 'utf8');
}

const originTokens: Array<[RegExp, { country: string; city?: string; province?: string }]> = [
  [/اصفهان|اصفهانی|گز/, { country: 'ایران', city: 'اصفهان', province: 'اصفهان' }],
  [/شیراز|شیرازی|قنبرپلو|کلم‌پلو/, { country: 'ایران', city: 'شیراز', province: 'فارس' }],
  [/گیلان|گیلانی|فومن|رشت|تالش|شمالی|گمج|باقلاقاتق|میرزا قاسمی|ترش‌تره|اناربیج|سیر قلیه|ملابیج|کته شمالی/, { country: 'ایران', province: 'گیلان' }],
  [/مازندران|مازندرانی|اکبر جوجه|کدو بره/, { country: 'ایران', province: 'مازندران' }],
  [/تبریز|تبریزی/, { country: 'ایران', city: 'تبریز', province: 'آذربایجان شرقی' }],
  [/کرمانشاه|کرمانشاهی/, { country: 'ایران', city: 'کرمانشاه', province: 'کرمانشاه' }],
  [/کرمان|کرمانی|بزقرمه|کلمپه/, { country: 'ایران', city: 'کرمان', province: 'کرمان' }],
  [/یزد|یزدی|قطاب|شولی/, { country: 'ایران', city: 'یزد', province: 'یزد' }],
  [/قم|قمی|سوهان/, { country: 'ایران', city: 'قم', province: 'قم' }],
  [/مشهد|مشهدی|شله مشهدی/, { country: 'ایران', city: 'مشهد', province: 'خراسان رضوی' }],
  [/اردبیل|اردبیلی/, { country: 'ایران', city: 'اردبیل', province: 'اردبیل' }],
  [/لرستان|لرستانی/, { country: 'ایران', province: 'لرستان' }],
  [/بوشهر|جنوبی|سیرافی|قلیه|میگو پلو|دمپخت ماهی/, { country: 'ایران', province: 'جنوب ایران' }],
  [/تهران|تهرانی|دمپختک/, { country: 'ایران', city: 'تهران', province: 'تهران' }],
  [/ایتالیایی|میلانی|رومی|ناپلی|آرانچینی|تیرامیسو|پانا کوتا|ریزوتو|پستو|آلفردو|مارگاریتا|فوک?اچا|نیوکی|کاپوناتا|پارمیجانا/, { country: 'ایتالیا' }],
  [/فرانسوی|بورگینیون|کسوله|راتاتویی|اکلر|کرم بروله|نیسواز|پوت‌او‌فو|سوپ پیاز/, { country: 'فرانسه' }],
  [/اسپانیایی|پایلا|پدرو|پاتاتاس|گازپاچو|چوروس|تورتیای اسپانیایی|آل آخیو/, { country: 'اسپانیا' }],
  [/ژاپنی|رامن|اوکونومی|اویاکودون|کاراآگه|تمپورا|گیودون|نیکوجاگا/, { country: 'ژاپن' }],
  [/چینی|کونگ پائو|چاو مین|دامپلینگ|ماپو|گوشت و بروکلی/, { country: 'چین' }],
  [/کره‌ای|کیمچی|بیبیمباپ|بولگوگی/, { country: 'کره جنوبی' }],
  [/تایلندی|تام یوم|تام کا|پد تای|کاری سبز|کاری قرمز|ماسامان/, { country: 'تایلند' }],
  [/ترکی|مانتی|لاهماجون|منمن|مرجیمک|گوزلمه|اسکندر/, { country: 'ترکیه' }],
  [/یونانی|موساکا|تزاتزیکی|سوولاکی|اسپاناکوپیتا|ساگاناکی|فتوش/, { country: 'یونان' }],
  [/هندی|بریانی|دال عدس|کاری/, { country: 'هند' }],
  [/اندونزی|ناسی گورنگ|سالاد اندونزی/, { country: 'اندونزی' }],
  [/فیلیپینی|آدوبو/, { country: 'فیلیپین' }],
  [/آرژانتینی|آسادو|امپانادا/, { country: 'آرژانتین' }],
  [/مکزیکی|تکس.?مکس|انچیلادا|چیلی/, { country: 'مکزیک/تکس-مکس' }],
  [/آمریکایی|نیویورک|لوئیزیانا|ماکارونی اند چیز|گامبو/, { country: 'آمریکا' }],
  [/کانادایی|پوتین/, { country: 'کانادا' }],
  [/ازبکی|پلوف/, { country: 'ازبکستان' }],
  [/گرجی|خینکالی/, { country: 'گرجستان' }],
  [/دانمارکی|اسموربرود/, { country: 'دانمارک' }],
  [/سوئیسی|فوندو|روشتی/, { country: 'سوئیس' }],
  [/اتریشی|اشترودل|شنیتسل|کایزرشمارن/, { country: 'اتریش' }],
  [/آلمانی|زاوربراتن|کارتوفل|زمل|کازه/, { country: 'آلمان' }],
  [/هلندی|اولی‌بولن|بیتربالن|استامپوت|کیبلینگ/, { country: 'هلند' }],
  [/بریتانیایی|اسکونز|ولش|شپرد|ماهی و چیپس|تود این د هول|کورنیش/, { country: 'بریتانیا' }],
  [/مصری|ام علی|کشری|ملوخیه/, { country: 'مصر' }],
  [/لبنانی|حمص|تبوله|بابا غنوج|فتوش/, { country: 'لبنان/شام' }],
];

const culinaryRules: Rule[] = [
  { id: 'qeymeh-rizeh-esfahani', match: /قیمه.?ریزه/, country: 'ایران', city: 'اصفهان', requiredAny: [['ground_lamb_raw', 'ground_beef_raw', 'گوشت چرخ'], ['chickpea_flour', 'آرد نخودچی'], ['potato_raw', 'سیب‌زمینی']], forbidden: ['split_peas_dry', 'لپه', 'dried_lime'], notes: 'قیمه‌ریزه اصفهانی باید کوفته‌ریزه گوشت چرخ‌کرده داشته باشد، نه مدل خورش قیمه.' },
  { id: 'gamaj-kabab', match: /گمج کباب/, country: 'ایران', province: 'گیلان', requiredAny: [['lamb_meat_raw', 'گوشت گوسفند'], ['walnuts_raw', 'گردو'], ['pomegranate_molasses', 'رب انار']], forbidden: ['egg', 'تخم‌مرغ', 'ground_lamb_raw', 'ground_beef_raw'], notes: 'گمج کباب این نسخه باید خوراک گیلانی گوشت تکه‌ای با گردو و رب انار باشد.' },
  { id: 'ghormeh-sabzi', match: /قرمه.?سبزی|قورمه.?سبزی|خورشت قرمه/, country: 'ایران', requiredAny: [['sabzi', 'سبزی', 'fenugreek', 'شنبلیله'], ['kidney_beans', 'لوبیا'], ['dried_lime', 'لیموعمانی', 'لیمو عمانی'], ['lamb', 'گوشت']], forbidden: ['cream', 'خامه'], notes: 'قرمه‌سبزی بدون سبزی، لوبیا و لیموعمانی معتبر نیست.' },
  { id: 'fesenjan', match: /فسنجان/, country: 'ایران', requiredAny: [['walnuts_raw', 'گردو'], ['pomegranate_molasses', 'رب انار'], ['chicken', 'duck', 'گوشت', 'مرغ']], notes: 'فسنجان باید گردو و رب انار داشته باشد.' },
  { id: 'gheymeh-sibzamini', match: /قیمه سیب|قیمه‌ سیب|قیمه‌?سیب/, country: 'ایران', requiredAny: [['split_peas_dry', 'لپه'], ['potato_raw', 'سیب‌زمینی'], ['dried_lime', 'لیموعمانی', 'لیمو عمانی'], ['tomato_paste', 'رب گوجه']], notes: 'قیمه سیب‌زمینی کلاسیک باید لپه، سیب‌زمینی، رب و لیموعمانی داشته باشد.' },
  { id: 'zereshk-polo', match: /زرشک پلو/, country: 'ایران', requiredAny: [['rice', 'برنج'], ['barberries', 'زرشک'], ['chicken', 'مرغ'], ['saffron', 'زعفران']], notes: 'زرشک‌پلو بدون زرشک/مرغ/زعفران ناقص است.' },
  { id: 'baghali-polo', match: /باقالی پلو/, country: 'ایران', requiredAny: [['rice', 'برنج'], ['fava', 'باقالی'], ['dill', 'شوید'], ['lamb', 'گوشت']], notes: 'باقالی‌پلو با گوشت باید برنج، باقالی، شوید و گوشت داشته باشد.' },
  { id: 'loobia-polo', match: /لوبیا پلو/, country: 'ایران', requiredAny: [['rice', 'برنج'], ['green_beans', 'لوبیا سبز'], ['tomato_paste', 'رب گوجه'], ['ground', 'گوشت']], notes: 'لوبیاپلو بدون لوبیاسبز/رب/برنج/گوشت مشکوک است.' },
  { id: 'koobideh', match: /کباب کوبیده|چلو کباب کوبیده/, country: 'ایران', requiredAny: [['ground_lamb_raw', 'ground_beef_raw', 'گوشت چرخ'], ['onion_raw', 'پیاز']], forbidden: ['chicken'], notes: 'کوبیده باید بر پایه گوشت چرخ‌کرده و پیاز باشد.' },
  { id: 'joojeh-kabab', match: /جوجه کباب/, country: 'ایران', requiredAny: [['chicken', 'مرغ'], ['saffron', 'زعفران'], ['lemon', 'لیمو', 'yogurt', 'ماست']], notes: 'جوجه‌کباب باید مرغ و مرینیت زعفرانی/اسیدی داشته باشد.' },
  { id: 'kabab-torsh', match: /کباب ترش/, country: 'ایران', province: 'گیلان', requiredAny: [['lamb', 'beef', 'گوشت'], ['walnuts_raw', 'گردو'], ['pomegranate_molasses', 'رب انار']], notes: 'کباب ترش بدون گردو و رب انار گیلانی نیست.' },
  { id: 'baghala-ghatogh', match: /باقلاقاتق|باقلا قاتق/, country: 'ایران', province: 'گیلان', requiredAny: [['fava', 'پاچ باقلا', 'باقلا'], ['dill', 'شوید'], ['garlic', 'سیر'], ['egg', 'تخم‌مرغ']], notes: 'باقلاقاتق باید باقلا، شوید، سیر و تخم‌مرغ داشته باشد.' },
  { id: 'mirza-ghasemi', match: /میرزا قاسمی/, country: 'ایران', province: 'گیلان', requiredAny: [['eggplant', 'بادمجان'], ['egg', 'تخم‌مرغ'], ['garlic', 'سیر'], ['tomato', 'گوجه']], notes: 'میرزاقاسمی بدون بادمجان کبابی/تخم‌مرغ/سیر/گوجه ناقص است.' },
  { id: 'kashk-bademjan', match: /کشک بادمجان/, country: 'ایران', requiredAny: [['eggplant', 'بادمجان'], ['kashk', 'کشک'], ['mint', 'نعناع']], notes: 'کشک بادمجان باید بادمجان، کشک و نعناع داشته باشد.' },
  { id: 'ash-reshteh', match: /آش رشته/, country: 'ایران', requiredAny: [['reshteh', 'رشته'], ['kashk', 'کشک'], ['chickpeas', 'نخود'], ['beans', 'لوبیا'], ['herb', 'سبزی']], notes: 'آش رشته بدون رشته/کشک/حبوبات/سبزی ناقص است.' },
  { id: 'ash-doogh', match: /آش دوغ/, country: 'ایران', province: 'اردبیل', requiredAny: [['doogh', 'دوغ', 'yogurt', 'ماست'], ['chickpeas', 'نخود'], ['herb', 'سبزی']], notes: 'آش دوغ باید پایه دوغ/ماست، نخود و سبزی داشته باشد.' },
  { id: 'biryani-esfahan', match: /بریانی اصفهان|بریانی اصفه/, country: 'ایران', city: 'اصفهان', requiredAny: [['lamb', 'گوشت گوسفند'], ['cinnamon', 'دارچین']], notes: 'بریانی اصفهان باید پایه گوشت گوسفندی و عطر دارچین داشته باشد.' },
  { id: 'kale-pache', match: /کله پاچه/, country: 'ایران', requiredAny: [['head', 'کله'], ['trotter', 'پاچه']], notes: 'کله‌پاچه بدون کله/پاچه واقعی مشکوک است.' },
  { id: 'dolmeh-barg', match: /دلمه برگ/, country: 'ایران/منطقه قفقاز', requiredAny: [['grape', 'برگ مو'], ['rice', 'برنج'], ['herb', 'سبزی']], notes: 'دلمه برگ مو باید برگ مو، برنج و سبزی داشته باشد.' },
  { id: 'carbonara', match: /کاربونارا|carbonara/i, country: 'ایتالیا', city: 'رم', requiredAny: [['spaghetti', 'pasta', 'اسپاگتی'], ['egg', 'تخم‌مرغ'], ['pecorino', 'parmesan', 'پنیر'], ['guanciale', 'pancetta', 'bacon']], forbidden: ['heavy_cream', 'cream_cheese', 'خامه'], notes: 'کربونارا رومی خامه ندارد و باید تخم‌مرغ، پنیر و گوشت خوک/پنچتا/گوانچاله داشته باشد.' },
  { id: 'beef-wellington', match: /ولینگتون|wellington/i, country: 'بریتانیا', requiredAny: [['beef_tenderloin', 'فیله گاو'], ['puff', 'هزارلا'], ['mushroom', 'قارچ']], notes: 'بیف ولینگتون بدون فیله، داکسل قارچ و خمیر پافی ناقص است.' },
  { id: 'croissant', match: /کروسان|croissant/i, country: 'فرانسه/اتریش', requiredAny: [['butter', 'کره'], ['flour', 'آرد'], ['yeast', 'خمیرمایه']], notes: 'کروسان باید لمینیشن کره‌ای داشته باشد.' },
  { id: 'kimchi', match: /کیمچی|kimchi/i, country: 'کره جنوبی', requiredAny: [['napa', 'کلم'], ['gochugaru', 'فلفل'], ['garlic', 'سیر'], ['ginger', 'زنجبیل']], notes: 'کیمچی باید کلم، فلفل کره‌ای/تند، سیر و زنجبیل داشته باشد.' },
  { id: 'massaman', match: /ماسامان|massaman/i, country: 'تایلند', requiredAny: [['coconut', 'نارگیل'], ['potato', 'سیب‌زمینی'], ['peanut', 'بادام‌زمینی'], ['curry', 'کاری']], notes: 'ماسامان باید کاری نارگیلی با سیب‌زمینی و بادام‌زمینی باشد.' },
  { id: 'nasi-goreng', match: /ناسی گورنگ|nasi/i, country: 'اندونزی', requiredAny: [['rice', 'برنج'], ['soy', 'kecap', 'سس سویا'], ['egg', 'تخم‌مرغ']], notes: 'ناسی گورنگ بدون برنج، سس سویای شیرین/سویا و تخم‌مرغ مشکوک است.' },
  { id: 'gumbo', match: /گامبو|gumbo/i, country: 'آمریکا', city: 'لوئیزیانا', requiredAny: [['flour', 'آرد'], ['celery', 'کرفس'], ['okra', 'بامیه', 'filé'], ['shrimp', 'میگو', 'chicken', 'مرغ']], notes: 'گامبو باید رو/پایه لوئیزیانایی و عنصر غلیظ‌کننده مثل بامیه یا فیله داشته باشد.' },
  { id: 'mac-cheese', match: /ماکارونی اند چیز|macaroni.*cheese|mac and cheese/i, country: 'آمریکا/بریتانیا', requiredAny: [['macaroni', 'pasta', 'ماکارونی'], ['cheddar', 'چدار', 'cheese', 'پنیر'], ['milk', 'شیر']], notes: 'مک‌اندچیز بدون پاستا، پنیر و شیر/سس سفید ناقص است.' },
  { id: 'poutine', match: /پوتین|poutine/i, country: 'کانادا', province: 'کبک', requiredAny: [['potato', 'سیب‌زمینی'], ['cheese', 'پنیر'], ['gravy', 'آب گوشت']], notes: 'پوتین باید سیب‌زمینی سرخ‌کرده، پنیر و گریوی داشته باشد.' },
  { id: 'coq-au-vin', match: /کوک او ون|coq/i, country: 'فرانسه', requiredAny: [['chicken', 'مرغ'], ['wine', 'شراب'], ['mushroom', 'قارچ']], notes: 'کوک او ون باید مرغ پخته در شراب و قارچ/آروماتیک داشته باشد.' },
  { id: 'boeuf-bourguignon', match: /بورگینیون|bourguignon/i, country: 'فرانسه', province: 'بورگونی', requiredAny: [['beef', 'گوشت گاو'], ['wine', 'شراب'], ['carrot', 'هویج'], ['mushroom', 'قارچ']], notes: 'بوف بورگینیون بدون گوشت گاو و شراب/آروماتیک ناقص است.' },
  { id: 'cassoulet', match: /کسوله|cassoulet/i, country: 'فرانسه', requiredAny: [['beans', 'لوبیا'], ['duck', 'اردک', 'sausage', 'سوسیس']], notes: 'کسوله باید لوبیا سفید و گوشت/سوسیس/اردک داشته باشد.' },
  { id: 'bacalhau-bras', match: /براس|bacalhau/i, country: 'پرتغال', requiredAny: [['cod', 'کاد', 'ماهی'], ['potato', 'سیب‌زمینی'], ['egg', 'تخم‌مرغ']], notes: 'باکالیائو آ براش باید کاد نمک‌سود، سیب‌زمینی و تخم‌مرغ داشته باشد.' },
  { id: 'wiener-schnitzel', match: /شنیتسل|schnitzel/i, country: 'اتریش', city: 'وین', requiredAny: [['veal', 'گوساله'], ['breadcrumb', 'سوخاری'], ['egg', 'تخم‌مرغ']], notes: 'وینر شنیتسل اصیل با گوساله و پوشش سوخاری است.' },
  { id: 'cheese-fondue', match: /فوندو|fondue/i, country: 'سوئیس', requiredAny: [['gruyere', 'emmental', 'پنیر'], ['wine', 'شراب']], notes: 'فوندو سوئیسی باید پنیر ذوب‌شونده و معمولاً شراب/مایع اسیدی داشته باشد.' },
  { id: 'khinkali', match: /خینکالی|khinkali/i, country: 'گرجستان', requiredAny: [['flour', 'آرد'], ['ground', 'گوشت چرخ'], ['onion', 'پیاز']], notes: 'خینکالی باید خمیر و گوشت چرخ‌کرده آبدار داشته باشد.' },
  { id: 'plov', match: /پلوف|uzbek-plov|plov-osh/i, country: 'ازبکستان', requiredAny: [['rice', 'برنج'], ['carrot', 'هویج'], ['lamb', 'beef', 'گوشت'], ['onion', 'پیاز']], notes: 'پلوف ازبکی بدون برنج، هویج، پیاز و گوشت معتبر نیست.' },
  { id: 'smorrebrod', match: /اسموربرود|smorrebrod/i, country: 'دانمارک', requiredAny: [['rye', 'چاودار'], ['herring', 'شاه‌ماهی', 'ماهی']], notes: 'اسموربرود هرینگ باید نان چاودار و شاه‌ماهی داشته باشد.' },
  { id: 'new-york-cheesecake', match: /چیزکیک|cheesecake/i, country: 'آمریکا', city: 'نیویورک', requiredAny: [['cream_cheese', 'پنیر خامه'], ['egg', 'تخم‌مرغ'], ['sugar', 'شکر']], notes: 'چیزکیک نیویورکی باید پنیر خامه‌ای، تخم‌مرغ و شکر داشته باشد.' },
];

const famousIranianMissing = [
  { title: 'مرصع‌پلو / شیرین‌پلو کامل مجلسی', region: 'تهران/قزوین/ایران', priority: 'P2', reason: 'نسخه‌ای هست، اما باید بررسی شود که مرصع‌پلو مجلسی کامل با خلال‌ها و مرغ/گوشت دارد یا نه.' },
  { title: 'ته‌چین اسفناج یا ته‌چین بادمجان', region: 'ایران', priority: 'P3', reason: 'تنوع مهم ته‌چین برای آرشیو ایرانی.' },
  { title: 'آلبالوپلو نسخه مجلسی با کوفته‌ریزه', region: 'تهران/شیراز', priority: 'P2', reason: 'آلبالوپلو هست، ولی نسخه کوفته‌ریزه معروف می‌تواند جدا باشد.' },
  { title: 'مرغ شکم‌پر مازندرانی/گیلانی اصیل', region: 'شمال ایران', priority: 'P1', reason: 'کاربر قبلاً نبودن/نیامدن آن در سرچ را گزارش کرده؛ باید نسخه شمالی اصیل با گردو/رب انار/سبزی محلی بررسی شود.' },
  { title: 'خورش آلو مسما', region: 'گیلان/ایران', priority: 'P2', reason: 'خورش آلو هست، اما مسمای شمالی معروف باید جدا یا کامل باشد.' },
  { title: 'قلیه مرغ شمالی', region: 'گیلان/مازندران', priority: 'P2', reason: 'برای پوشش غذاهای شمالی شناخته‌شده.' },
  { title: 'چکدرمه ترکمنی', region: 'گلستان/ترکمن', priority: 'P1', reason: 'غذای بسیار شناخته‌شده منطقه‌ای و مناسب آرشیو ملی.' },
  { title: 'باقالی قاتوق با پاچ‌باقلا دقیق', region: 'گیلان', priority: 'P1', reason: 'اگر موجود باشد باید از نظر پاچ‌باقلا/شوید/تخم‌مرغ دقیق کنترل شود.' },
  { title: 'واویشکای دقیق گیلانی با دل/جگر یا گوشت', region: 'گیلان', priority: 'P2', reason: 'واویشکا هست، اما نسخه و مواد باید کنترل اصالت شود.' },
  { title: 'دوغ پای کرمانی', region: 'کرمان', priority: 'P1', reason: 'غذای شاخص کرمان و برای آرشیو ایرانی مهم.' },
  { title: 'یتیمچه نیشابوری/تهرانی تفکیک‌شده', region: 'خراسان/تهران', priority: 'P3', reason: 'یتیمچه هست، ولی نسخه‌های محلی متفاوت‌اند.' },
  { title: 'شامی پوک گیلانی', region: 'گیلان', priority: 'P2', reason: 'غذای معروف شمالی و متفاوت از شامی عمومی.' },
  { title: 'کوفته سبزی شیرازی', region: 'شیراز', priority: 'P2', reason: 'غذای شاخص فارس که در لیست فعلی دیده نمی‌شود.' },
  { title: 'کوفته همدانی', region: 'همدان', priority: 'P2', reason: 'پوشش منطقه‌ای غرب ایران ناقص است.' },
  { title: 'آش کشک خراسانی', region: 'خراسان', priority: 'P3', reason: 'برای تکمیل دسته آش‌های منطقه‌ای.' },
  { title: 'دمی گوجه / استانبولی با گوشت قلقلی', region: 'تهران/ایران', priority: 'P3', reason: 'استانبولی بدون گوشت هست، اما نسخه رایج خانگی با گوشت هم لازم است.' },
  { title: 'خورش به‌آلو', region: 'اصفهان/ایران', priority: 'P2', reason: 'خورشت به هست، اما به‌آلو نسخه مهمی است.' },
  { title: 'خورش سیب و آلبالو یا سیب کرمانشاهی', region: 'کرمانشاه', priority: 'P3', reason: 'خورشت سیب هست، ولی نسخه منطقه‌ای باید روشن شود.' },
  { title: 'آش اوماج', region: 'آذربایجان/همدان', priority: 'P2', reason: 'آش معروف منطقه‌ای و مناسب پوشش ملی.' },
  { title: 'دلمه فلفل و گوجه ایرانی', region: 'ایران', priority: 'P2', reason: 'دلمه برگ مو هست، اما دلمه سبزیجات رایج جداگانه ارزش دارد.' },
];

function inferOrigin(recipe: any, blob: string): Origin {
  const admin = parseJson(recipe.adminNote, {});
  const categories = parseJson(recipe.categories, []);
  const hay = `${recipe.title} ${recipe.region ?? ''} ${recipe.category ?? ''} ${admin.slug ?? ''} ${categories.join?.(' ') ?? ''}`;
  for (const [re, origin] of originTokens) {
    if (re.test(hay)) return origin;
  }
  if (recipe.region === 'persian') return { country: 'ایران' };
  if (recipe.region && recipe.region !== 'international') return { country: String(recipe.region) };
  if (/global|international/.test(blob)) return { country: 'نامشخص در داده؛ بین‌المللی' };
  return { country: 'نامشخص' };
}

function hasAny(hay: string, terms: string[]) {
  return terms.some((term) => hay.includes(term.toLowerCase()));
}

function compactEvidence(recipe: any) {
  const ingredientCodes = recipe.ingredients.map((ri: any) => ri.ingredient?.code).filter(Boolean);
  const ingredientNames = recipe.ingredients.map((ri: any) => ri.name || ri.ingredient?.nameFa).filter(Boolean);
  return `مواد: ${ingredientNames.slice(0, 10).join('، ')} | کدها: ${ingredientCodes.slice(0, 10).join(', ')}`;
}

function inspectRecipe(recipe: any) {
  const issues: Issue[] = [];
  const admin = parseJson(recipe.adminNote, {});
  const gris = recipe.gris ?? null;
  const categories = parseJson(recipe.categories, []);
  const tools = parseJson(recipe.tools, []);
  const tips = parseJson(recipe.tips, []);
  const faq = parseJson(recipe.faq, []);
  const chefTips = parseJson(recipe.chefTips, []);
  const commonMistakes = parseJson(recipe.commonMistakes, []);
  const servingSuggestions = parseJson(recipe.servingSuggestions, []);
  const substitutions = parseJson(recipe.substitutions, []);
  const displayPayload = {
    title: recipe.title,
    description: recipe.description,
    category: recipe.category,
    region: recipe.region,
    categories,
    tools,
    tips,
    faq,
    chefTips,
    commonMistakes,
    servingSuggestions,
    substitutions,
    gris,
    ingredients: recipe.ingredients.map((ri: any) => ({
      name: ri.name,
      ingredientNameFa: ri.ingredient?.nameFa,
      ingredientCode: ri.ingredient?.code,
      amount: ri.amount,
      unit: ri.unit,
      preparation: parseJson(ri.notes, {})?.preparation ?? null,
    })),
    steps: recipe.steps.map((s: any) => ({ title: s.title, instruction: s.instruction })),
    searchTerms: recipe.searchTerms.map((s: any) => s.term),
  };
  const blob = textValues(displayPayload).toLowerCase();
  const faBlob = textValues(displayPayload);
  const isLite = recipe.id.includes('lite') || recipe.category === 'lite_food' || blob.includes('lite-food');
  const sourceGroup = admin.source ?? (recipe.id.startsWith('meze50_') ? 'meze-50-v1' : 'unknown');
  const simpleDish = isLite
    || /drink|beverage|smoothie|juice|coffee|tea|sauce|dip|side|snack|assemble/.test(blob)
    || /نوشیدنی|اسموتی|شربت|قهوه|چای|لیموناد|لاته|موهیتو|آیران|آگوا|سس|دیپ|سالاد ساده|سیب زمینی سرخ|سیب‌زمینی سرخ|سمنو/.test(recipe.title);

  if (recipe.ingredients.length === 0) issues.push({ severity: 'P0', type: 'STRUCTURE_NO_INGREDIENTS', message: 'مواد لازم ندارد.' });
  if (recipe.steps.length === 0) issues.push({ severity: 'P0', type: 'STRUCTURE_NO_STEPS', message: 'مراحل پخت ندارد.' });
  if (!isLite && recipe.ingredients.length > 0) {
    const minIngredients = simpleDish ? 2 : 4;
    if (recipe.ingredients.length < minIngredients) issues.push({ severity: 'P2', type: 'STRUCTURE_TOO_FEW_INGREDIENTS', message: 'تعداد مواد نسبت به نوع رسپی کم است.', evidence: String(recipe.ingredients.length) });
  }
  if (!isLite && recipe.steps.length > 0) {
    const minSteps = simpleDish ? 3 : 5;
    if (recipe.steps.length < minSteps) issues.push({ severity: 'P2', type: 'STRUCTURE_TOO_FEW_STEPS', message: 'تعداد مراحل نسبت به نوع رسپی کم است.', evidence: String(recipe.steps.length) });
  }
  if (!recipe.totalTime || recipe.totalTime === '0') issues.push({ severity: 'P1', type: 'TIME_MISSING', message: 'زمان کل خالی/نامعتبر است.' });
  if (recipe.cookingTime == null && !isLite) issues.push({ severity: 'P1', type: 'COOKING_TIME_MISSING', message: 'زمان پخت ندارد.' });
  if (!recipe.servings || recipe.servings <= 0) issues.push({ severity: 'P1', type: 'SERVINGS_MISSING', message: 'تعداد نفرات خالی/نامعتبر است.' });

  const requiredGris = ['story', 'glance', 'ingredients', 'steps', 'whyItWorks', 'troubleshooting', 'serveWith', 'finish', 'faq'];
  const grisKeys = gris && typeof gris === 'object' ? Object.keys(gris) : [];
  const missingGris = requiredGris.filter((key) => !grisKeys.includes(key));
  if (!isLite && !gris) issues.push({ severity: 'P0', type: 'GRIS_MISSING', message: 'ساختار GRIS ندارد.' });
  if (!isLite && gris && missingGris.length) issues.push({ severity: missingGris.length >= 4 ? 'P1' : 'P2', type: 'GRIS_SECTIONS_MISSING', message: 'بخش‌های GRIS ناقص است.', evidence: missingGris.join(', ') });
  if (!isLite && gris?.steps && Array.isArray(gris.steps)) {
    const weak = gris.steps.filter((s: any) => !s.title || !s.instruction || String(s.instruction).length < 45);
    if (weak.length) issues.push({ severity: 'P2', type: 'WEAK_GRIS_STEPS', message: 'بعضی مراحل GRIS کوتاه/کم‌جزئیات‌اند.', evidence: `${weak.length}/${gris.steps.length}` });
  }
  if (!isLite && gris?.ingredients && Array.isArray(gris.ingredients)) {
    const weak = gris.ingredients.filter((i: any) => !i.role || !i.buyTip || !i.component);
    if (weak.length) issues.push({ severity: 'P2', type: 'WEAK_GRIS_INGREDIENTS', message: 'مواد GRIS نقش/نکته خرید/گروه کامل ندارند.', evidence: `${weak.length}/${gris.ingredients.length}` });
  }

  const unresolved = recipe.ingredients.filter((ri: any) => !ri.ingredientId || !ri.ingredient);
  if (unresolved.length) issues.push({ severity: 'P0', type: 'UNRESOLVED_INGREDIENT', message: 'ingredientId یا اتصال Ingredient ناقص است.', evidence: unresolved.map((x: any) => x.name).join('، ') });
  const mismatches: string[] = [];
  for (const ri of recipe.ingredients) {
    const notes = parseJson(ri.notes, {});
    if (notes?.code && ri.ingredient?.code && notes.code !== ri.ingredient.code) {
      mismatches.push(`${ri.name}:${notes.code}->${ri.ingredient.code}`);
    }
  }
  if (mismatches.length) issues.push({ severity: 'P0', type: 'INGREDIENT_CODE_MISMATCH', message: 'کد ماده در notes با Ingredient وصل‌شده یکی نیست.', evidence: mismatches.slice(0, 5).join(' | ') });

  const forbiddenCopy = ['internal', 'debug', 'database', 'import', 'ai generated', 'placeholder', 'todo', 'fixme'];
  const copyHits = forbiddenCopy.filter((term) => blob.includes(term));
  if (copyHits.length) issues.push({ severity: 'P1', type: 'USER_COPY_LEAK', message: 'متن نمایشی احتمالاً واژه داخلی/دیباگ دارد.', evidence: copyHits.join(', ') });
  if (/ingredientId|resolverNote|sourceFoodId|datasetVersion/.test(faBlob)) {
    issues.push({ severity: 'P1', type: 'TECHNICAL_TEXT_LEAK', message: 'عبارت فنی ممکن است در payload نمایشی یا admin-copy دیده شود.', evidence: 'ingredientId/resolverNote/sourceFoodId/datasetVersion' });
  }

  const matchingRules = culinaryRules.filter((rule) => rule.match.test(recipe.title) || rule.match.test(admin.slug ?? ''));
  for (const rule of matchingRules) {
    const missing = (rule.requiredAny ?? []).filter((group) => !hasAny(blob, group));
    let forbidden = (rule.forbidden ?? []).filter((term) => blob.includes(term.toLowerCase()));
    if (rule.id === 'carbonara') {
      const ingredientBlob = recipe.ingredients.map((ri: any) => `${ri.name ?? ''} ${ri.ingredient?.nameFa ?? ''} ${ri.ingredient?.nameEn ?? ''} ${ri.ingredient?.code ?? ''}`).join(' ').toLowerCase();
      forbidden = forbidden.filter((term) => ingredientBlob.includes(term.toLowerCase()));
    }
    if (rule.id === 'kimchi' && isLite && recipe.ingredients.some((ri: any) => ri.ingredient?.code === 'kimchi')) {
      forbidden = [];
    }
    const requiredGroups = rule.id === 'kimchi' && isLite && recipe.ingredients.some((ri: any) => ri.ingredient?.code === 'kimchi') ? [] : (rule.requiredAny ?? []);
    const missingForRule = requiredGroups.filter((group) => !hasAny(blob, group));
    if (missingForRule.length) {
      issues.push({
        severity: 'P1',
        type: 'CULINARY_REQUIRED_KEY_MISSING',
        message: `مواد/نشانه‌های کلیدی برای ${rule.id} کامل نیست.`,
        evidence: missingForRule.map((group) => `[${group.join(' OR ')}]`).join(' + '),
      });
    }
    if (forbidden.length) {
      issues.push({
        severity: 'P1',
        type: 'CULINARY_FORBIDDEN_OR_SUSPICIOUS_KEY',
        message: `مواد/نشانه‌های مشکوک برای ${rule.id} دیده شد.`,
        evidence: forbidden.join(', '),
      });
    }
  }

  const originFromRule = matchingRules.find((rule) => rule.country);
  const origin = originFromRule
    ? { country: originFromRule.country, city: originFromRule.city, province: originFromRule.province }
    : inferOrigin(recipe, blob);
  if (!origin.country || origin.country.includes('نامشخص')) {
    issues.push({ severity: 'P2', type: 'ORIGIN_WEAK', message: 'کشور/مبدا از داده به‌وضوح قابل استخراج نیست.' });
  }
  if (recipe.region === 'persian' && !origin.city && !origin.province) {
    issues.push({ severity: 'P3', type: 'IRANIAN_LOCALITY_MISSING', message: 'غذای ایرانی است اما شهر/استان مشخص ندارد.' });
  }

  const severityRank = { P0: 0, P1: 1, P2: 2, P3: 3 };
  const worst = issues.length ? issues.map((i) => i.severity).sort((a, b) => severityRank[a] - severityRank[b])[0] : 'PASS';
  const structuralComplete = !issues.some((i) => ['P0', 'P1'].includes(i.severity) && !i.type.startsWith('CULINARY_'));
  const culinaryRisk = issues.some((i) => i.type.startsWith('CULINARY_')) ? 'HIGH_REVIEW' : matchingRules.length ? 'RULE_PASS' : 'NOT_RULED';

  return {
    id: recipe.id,
    slug: admin.slug ?? '',
    title: recipe.title,
    sourceGroup,
    status: recipe.status,
    isPublic: recipe.isPublic,
    category: recipe.category,
    country: origin.country ?? '',
    province: origin.province ?? '',
    city: origin.city ?? '',
    ingredientCount: recipe.ingredients.length,
    stepCount: recipe.steps.length,
    grisSectionCount: grisKeys.length,
    structuralComplete,
    culinaryRisk,
    worstSeverity: worst,
    issueCount: issues.length,
    issues,
    evidence: compactEvidence(recipe),
  };
}

function renderMd(summary: any, activeRows: any[], draftRows: any[], critical: any[], missing: any[]) {
  const bySeverity = (sev: string) => activeRows.filter((r) => r.worstSeverity === sev).length;
  const byRisk = (risk: string) => activeRows.filter((r) => r.culinaryRisk === risk).length;
  const sourceLines = Object.entries(summary.activeBySource)
    .sort((a: any, b: any) => b[1] - a[1])
    .map(([k, v]) => `| ${k} | ${v} |`)
    .join('\n');
  const criticalLines = critical.slice(0, 120).map((r) => {
    const first = r.issues[0];
    return `| ${r.worstSeverity} | ${r.title} | ${r.country}${r.city ? ` / ${r.city}` : r.province ? ` / ${r.province}` : ''} | ${r.sourceGroup} | ${r.ingredientCount}/${r.stepCount}/${r.grisSectionCount} | ${r.culinaryRisk} | ${first?.type ?? ''}: ${first?.message ?? ''} ${first?.evidence ? `<br>${first.evidence}` : ''} |`;
  }).join('\n');
  const missingLines = missing.map((m) => `| ${m.priority} | ${m.title} | ${m.region} | ${m.reason} |`).join('\n');
  const allRowsSample = activeRows.slice(0, 589).map((r) => `| ${r.title} | ${r.country || 'نامشخص'} | ${r.city || r.province || '-'} | ${r.structuralComplete ? 'کامل' : 'ناقص/نیازمند بررسی'} | ${r.worstSeverity} | ${r.culinaryRisk} |`).join('\n');

  return `# ممیزی کل آرشیو رسپی‌ها - ریسک اصالت و ساختار

تاریخ تولید: ${now}

## Reality Check

این ممیزی نشان می‌دهد مشکل قیمه‌ریزه و گمج‌کباب اتفاق منفرد قابل چشم‌پوشی نیست. ساختار فنی بخش بزرگی از رسپی‌های active بعد از تعمیرهای GRIS بهتر شده، اما هنوز برای اپ غذایی با ادعای بین‌المللی، کیفیت دیتای آشپزی باید یک مرحله ممیزی انسانی/قانون‌محور جدی‌تر بخورد.

درجه اطمینان:
- [قطعی] شمارش DB، اتصال مواد، تعداد مراحل، وجود GRIS، زمان/نفرات و وجود متن‌های فنی.
- [احتمالاً] ریسک اصالت غذایی بر اساس قواعد مواد کلیدی و مواد ممنوع/مشکوک.
- [نامطمئن] اصالت نهایی تک‌تک غذاهایی که rule اختصاصی ندارند؛ برای آن‌ها باید فاز بعدی expert review اجرا شود.

## خلاصه عددی

| شاخص | تعداد |
|---|---:|
| کل رکورد Recipe در DB | ${summary.totalDb} |
| active + public، یعنی آرشیو قابل مشاهده کاربر | ${summary.activePublic} |
| draft/private جدا از لانچ | ${draftRows.length} |
| P0 بحرانی در active/public | ${bySeverity('P0')} |
| P1 مهم در active/public | ${bySeverity('P1')} |
| P2 متوسط در active/public | ${bySeverity('P2')} |
| P3 سبک/متادیتا در active/public | ${bySeverity('P3')} |
| PASS بدون issue در active/public | ${bySeverity('PASS')} |
| ریسک آشپزی بالا طبق rule اختصاصی | ${byRisk('HIGH_REVIEW')} |
| rule اختصاصی داشته و پاس کرده | ${byRisk('RULE_PASS')} |
| rule اختصاصی ندارد و باید در فاز بعد نمونه‌خوانی شود | ${byRisk('NOT_RULED')} |

## توزیع منابع active/public

| منبع | تعداد |
|---|---:|
${sourceLines}

## برداشت مستقیم

اولویت ۱: هر مورد P0 یا P1 باید قبل از لانچ اصلاح یا از public خارج شود.

اولویت ۲: غذاهای ruleدار با HIGH_REVIEW باید دستی بررسی شوند؛ این‌ها همان جنس خطای «غذای معروف اما مواد/ساختار غلط» هستند.

اولویت ۳: غذاهای NOT_RULED ممکن است درست باشند، اما هنوز از نظر اصالت آشپزی rule-based کنترل نشده‌اند. برای اپی که ادعای بین‌المللی دارد، این عدد باید در چند sprint کم شود.

## موارد بحرانی و پرریسک

فهرست کامل در فایل CSV کنار همین گزارش آمده است. جدول زیر ۱۲۰ مورد اول بر اساس شدت است.

| شدت | غذا | کشور/شهر | منبع | مواد/مراحل/GRIS | ریسک آشپزی | مشکل |
|---|---|---|---|---:|---|---|
${criticalLines || '| - | موردی پیدا نشد | - | - | - | - | - |'}

## فهرست کامل active/public با کشور/شهر و وضعیت ساختار

این جدول برای مرور سریع است؛ نسخه قابل فیلتر در CSV تولید شده.

| غذا | کشور | شهر/استان | ساختار | شدت | ریسک آشپزی |
|---|---|---|---|---|---|
${allRowsSample}

## غذاهای معروف ایرانی که باید به آرشیو اضافه یا دقیق‌تر تفکیک شوند

این فهرست قطعی نیست؛ فهرست کاری برای غنی‌کردن آرشیو ایرانی است.

| اولویت | غذا | منطقه | دلیل |
|---|---|---|---|
${missingLines}

## روش ممیزی

- منبع حقیقت: PostgreSQL local/dev که اپ از آن می‌خواند.
- محدوده اصلی: فقط Recipeهای active/public.
- کنترل‌های ساختاری: مواد، مراحل، زمان، نفرات، GRIS، بخش‌های GRIS، ضعف مواد/مراحل GRIS.
- کنترل‌های دیتایی: ingredientId ناموجود، اتصال Ingredient قطع، mismatch بین notes.code و Ingredient.code.
- کنترل‌های copy: عبارت‌های internal/debug/import/database/placeholder و leakهای فنی مثل ingredientId/resolverNote.
- کنترل‌های اصالت: ruleهای مواد کلیدی/ممنوع برای غذاهای معروف ایرانی و بین‌المللی.

## نتیجه عملی

برای درست‌کردن این پایه، نباید موردی و واکنشی جلو رفت. مسیر درست این است:
1. همه P0/P1ها را batch کنید.
2. برای HIGH_REVIEWها «repair prompt» جدا بسازید که فقط همان غذا را با منابع معتبر و ساختار GRIS کامل اصلاح کند.
3. بعد از هر batch، همین audit دوباره اجرا شود تا عدد P0/P1 و HIGH_REVIEW پایین بیاید.
`;
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const recipes = await prisma.recipe.findMany({
    include: {
      ingredients: { orderBy: { order: 'asc' }, include: { ingredient: true } },
      steps: { orderBy: { order: 'asc' } },
      searchTerms: true,
      nutrition: true,
    },
    orderBy: { title: 'asc' },
  });

  const rows = recipes.map(inspectRecipe);
  const activeRows = rows.filter((r) => r.status === 'active' && r.isPublic);
  const draftRows = rows.filter((r) => !(r.status === 'active' && r.isPublic));
  const activeBySource = activeRows.reduce((acc: Record<string, number>, row) => {
    acc[row.sourceGroup] = (acc[row.sourceGroup] ?? 0) + 1;
    return acc;
  }, {});

  const severityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3, PASS: 4 };
  const critical = activeRows
    .filter((r) => r.worstSeverity !== 'PASS' || r.culinaryRisk === 'HIGH_REVIEW')
    .sort((a, b) => (severityOrder[a.worstSeverity] ?? 9) - (severityOrder[b.worstSeverity] ?? 9) || b.issueCount - a.issueCount || a.title.localeCompare(b.title, 'fa'));

  const inventoryRows = activeRows.map((r) => ({
    recipeId: r.id,
    slug: r.slug,
    title: r.title,
    sourceGroup: r.sourceGroup,
    country: r.country,
    province: r.province,
    city: r.city,
    category: r.category,
    ingredientCount: r.ingredientCount,
    stepCount: r.stepCount,
    grisSectionCount: r.grisSectionCount,
    structuralComplete: r.structuralComplete ? 'YES' : 'NO',
    culinaryRisk: r.culinaryRisk,
    worstSeverity: r.worstSeverity,
    issueCount: r.issueCount,
    issues: r.issues.map((i) => `${i.severity}:${i.type}:${i.message}${i.evidence ? ` (${i.evidence})` : ''}`).join(' | '),
  }));

  const criticalRows = critical.map((r) => ({
    recipeId: r.id,
    slug: r.slug,
    title: r.title,
    sourceGroup: r.sourceGroup,
    country: r.country,
    province: r.province,
    city: r.city,
    ingredientCount: r.ingredientCount,
    stepCount: r.stepCount,
    grisSectionCount: r.grisSectionCount,
    culinaryRisk: r.culinaryRisk,
    worstSeverity: r.worstSeverity,
    issues: r.issues.map((i) => `${i.severity}:${i.type}:${i.message}${i.evidence ? ` (${i.evidence})` : ''}`).join(' | '),
    evidence: r.evidence,
  }));

  const summary = {
    generatedAt: now,
    totalDb: recipes.length,
    activePublic: activeRows.length,
    draftPrivate: draftRows.length,
    activeBySource,
    activeSeverityCounts: ['P0', 'P1', 'P2', 'P3', 'PASS'].reduce((acc: Record<string, number>, sev) => {
      acc[sev] = activeRows.filter((r) => r.worstSeverity === sev).length;
      return acc;
    }, {}),
    culinaryRiskCounts: ['HIGH_REVIEW', 'RULE_PASS', 'NOT_RULED'].reduce((acc: Record<string, number>, risk) => {
      acc[risk] = activeRows.filter((r) => r.culinaryRisk === risk).length;
      return acc;
    }, {}),
    issueTypeCounts: activeRows.flatMap((r) => r.issues).reduce((acc: Record<string, number>, issue) => {
      acc[issue.type] = (acc[issue.type] ?? 0) + 1;
      return acc;
    }, {}),
  };

  fs.writeFileSync(path.join(outDir, 'recipe_archive_content_audit_v1.json'), JSON.stringify({ summary, activeRows, draftRows, famousIranianMissing }, null, 2), 'utf8');
  writeCsv('recipe_archive_inventory_active_public_v1.csv', inventoryRows);
  writeCsv('recipe_archive_critical_risks_v1.csv', criticalRows.length ? criticalRows : [{ empty: 'no critical rows' }]);
  writeCsv('famous_iranian_missing_or_needs_split_v1.csv', famousIranianMissing);
  fs.writeFileSync(path.join(outDir, 'recipe_archive_content_audit_v1.md'), renderMd(summary, activeRows, draftRows, critical, famousIranianMissing), 'utf8');
  console.log(JSON.stringify({
    ok: true,
    outDir,
    summary,
    files: [
      'recipe_archive_content_audit_v1.md',
      'recipe_archive_content_audit_v1.json',
      'recipe_archive_inventory_active_public_v1.csv',
      'recipe_archive_critical_risks_v1.csv',
      'famous_iranian_missing_or_needs_split_v1.csv',
    ],
  }, null, 2));
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
