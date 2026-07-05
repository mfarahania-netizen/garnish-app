import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const recipeId = 'garnish_recipe_fa_104_7b4ced78';
const now = new Date().toISOString();
const backupDir = path.resolve(process.cwd(), '..', '..', 'docs', 'qa', 'recipes', 'content-fixes');
const backupPath = path.join(backupDir, `gamaj-kabab-before-${now.replace(/[:.]/g, '-')}.json`);

const ingredients = [
  { ingredientId: 'ing_lamb_meat_raw', code: 'lamb_meat_raw', name: 'گوشت گوسفند خام', amount: '500', unit: 'گرم', preparation: 'خورشتی و تکه‌ای خردشده', order: 1 },
  { ingredientId: 'ing_onion_raw', code: 'onion_raw', name: 'پیاز خام', amount: '1', unit: 'عدد بزرگ', preparation: 'رنده یا ریز خردشده', order: 2 },
  { ingredientId: 'ing_garlic_raw', code: 'garlic_raw', name: 'سیر خام', amount: '3', unit: 'حبه', preparation: 'رنده‌شده', order: 3, optional: true },
  { ingredientId: 'ing_walnuts_raw', code: 'walnuts_raw', name: 'گردو خام', amount: '200', unit: 'گرم', preparation: 'آسیاب‌شده', order: 4 },
  { ingredientId: 'ing_pomegranate_molasses', code: 'pomegranate_molasses', name: 'رب انار', amount: '3', unit: 'قاشق غذاخوری', preparation: 'ترجیحاً ترش یا ملس', order: 5 },
  { ingredientId: 'ing_tomato_paste', code: 'tomato_paste', name: 'رب گوجه‌فرنگی', amount: '1', unit: 'قاشق غذاخوری', preparation: 'اختیاری، برای رنگ و تعادل', order: 6, optional: true },
  { ingredientId: 'ing_tareh_fresh', code: 'tareh_fresh', name: 'تره تازه', amount: '80', unit: 'گرم', preparation: 'ریز خردشده', order: 7 },
  { ingredientId: 'ing_parsley_fresh', code: 'parsley_fresh', name: 'جعفری تازه', amount: '80', unit: 'گرم', preparation: 'ریز خردشده', order: 8 },
  { ingredientId: 'ing_cilantro_fresh', code: 'cilantro_fresh', name: 'گشنیز تازه', amount: '60', unit: 'گرم', preparation: 'ریز خردشده؛ اگر چوچاق یا خالواش داری کمی جایگزین کن', order: 9 },
  { ingredientId: 'ing_sunflower_oil', code: 'sunflower_oil', name: 'روغن آفتابگردان', amount: '3', unit: 'قاشق غذاخوری', preparation: 'برای تفت‌دادن', order: 10 },
  { ingredientId: 'ing_turmeric_ground', code: 'turmeric_ground', name: 'زردچوبه آسیاب‌شده', amount: '1', unit: 'قاشق چای‌خوری', preparation: null, order: 11 },
  { ingredientId: 'ing_salt_table', code: 'salt_table', name: 'نمک خوراکی', amount: '1.25', unit: 'قاشق چای‌خوری', preparation: 'به ذائقه تنظیم شود', order: 12 },
  { ingredientId: 'ing_black_pepper_ground', code: 'black_pepper_ground', name: 'فلفل سیاه آسیاب‌شده', amount: '0.5', unit: 'قاشق چای‌خوری', preparation: null, order: 13 },
] as const;

const steps = [
  { title: 'آماده‌کردن پایه', instruction: 'پیاز را با روغن روی حرارت متوسط تفت دهید تا نرم و طلایی روشن شود. سیر و زردچوبه را اضافه کنید و کوتاه هم بزنید تا عطرشان باز شود.', duration: 8, order: 1 },
  { title: 'تفت‌دادن گوشت تکه‌ای', instruction: 'گوشت تکه‌ای را اضافه کنید و چند دقیقه تفت دهید تا سطح قطعات از حالت خام خارج شود و کمی رنگ بگیرد. گوشت باید خورشتی و تکه‌ای بماند تا بافت غذا درست شود.', duration: 10, order: 2 },
  { title: 'افزودن گردو و رب‌ها', instruction: 'گردوی آسیاب‌شده را اضافه کنید و ۲ تا ۳ دقیقه آرام تفت دهید تا بوی خامی گردو کمتر شود. رب انار و در صورت استفاده رب گوجه را اضافه کنید و کوتاه تفت دهید.', duration: 6, order: 3 },
  { title: 'آرام‌پز کردن', instruction: 'حدود ۲ پیمانه آب داغ اضافه کنید، نمک و فلفل را بزنید و در ظرف را بگذارید. خوراک را با حرارت کم بپزید تا گوشت نرم شود و سس گردو و رب انار جا بیفتد.', duration: 45, order: 4 },
  { title: 'افزودن سبزی گیلانی', instruction: 'تره، جعفری و گشنیز خردشده را اضافه کنید. اگر چوچاق یا خالواش دارید، کمی از آن را در همین مرحله اضافه کنید. ۱۲ تا ۱۵ دقیقه دیگر بپزید تا سبزی عطر بدهد اما نسوزد.', duration: 15, order: 5 },
  { title: 'تنظیم غلظت و مزه', instruction: 'در پایان سس باید غلیظ، براق و ترش‌مزه باشد. اگر زیادی ترش بود کمی آب داغ و چند دقیقه پخت بیشتر کمک می‌کند؛ اگر رقیق بود در ظرف را بردارید تا غلیظ شود.', duration: 8, order: 6 },
  { title: 'سرو', instruction: 'گمج کباب را داغ، در همان ظرف سفالی یا قابلمه گرم، با کته شمالی یا نان و سبزی خوردن سرو کنید.', duration: 2, order: 7 },
] as const;

const gris = {
  recipeId,
  title: 'گمج کباب',
  firstLook: 'خوراک گیلانیِ گوشت تکه‌ای با گردو، رب انار و سبزی محلی؛ ترش، غلیظ و جاافتاده.',
  glance: {
    promise: 'گوشت تکه‌ای نرم در سس گردو و رب انار، با عطر سبزی شمالی و قوامی شبیه خوراک جاافتاده؛ ترش، گردویی و مناسب سرو با کته.',
    servings: 4,
    difficulty: 'medium',
    totalTimeMin: 95,
    activeTimeMin: 30,
    handsOffMin: 55,
    costBand: 'متوسط رو به بالا',
    keyEquipment: ['گمج سفالی یا قابلمه ته‌ضخیم', 'کفگیر', 'درپوش', 'چاقوی تیز'],
    goodFor: ['ناهار گیلانی', 'غذای مجلسی', 'سرو با کته', 'مهمانی خانوادگی'],
  },
  story: {
    hook: 'گمج کباب را نباید مثل مایهٔ تابه‌ای سریع دید؛ هویت آن در پخت آرام گوشت تکه‌ای با گردو، رب انار و سبزی محلی ساخته می‌شود.',
    origin: 'گمج کباب از خوراک‌های گیلانی است که نامش به «گمج»، ظرف سفالی سنتی شمال، برمی‌گردد. در روایت‌های خانگی، پایهٔ غذا گوشت تکه‌ای، گردو، رب انار و سبزی محلی مثل چوچاق یا خالواش است؛ چیزی بین خوراک ترش شمالی و خورش غلیظ گردویی.',
    occasion: 'برای ناهار یا شام خانوادگی، مخصوصاً وقتی کنار کته شمالی، زیتون پرورده و سبزی خوردن سرو شود.',
  },
  ingredients: [
    { ...ingredients[0], volume: '500 گرم', weightG: 500, component: 'خوراک اصلی', role: 'پروتئین اصلی؛ باید تکه‌ای بماند تا بافت خوراک درست شود.', buyTip: 'سردست یا ران گوسفند با کمی چربی انتخاب بهتری است؛ گوشت خیلی خشک دیرتر نرم می‌شود.', swap: 'گوشت گوساله خورشتی؛ زمان پخت را ۱۵ تا ۲۰ دقیقه بیشتر در نظر بگیر.' },
    { ...ingredients[1], volume: '1 عدد بزرگ', component: 'پایه عطر', role: 'شیرینی و بدنهٔ پایه را می‌سازد.', buyTip: 'پیاز زرد یا سفید سفت و آبدار انتخاب کن.', swap: 'پیاز قرمز، با طعم کمی شیرین‌تر.' },
    { ...ingredients[2], volume: '3 حبه', component: 'پایه عطر', role: 'عطر سیر را به پایه می‌دهد بدون اینکه غالب شود.', buyTip: 'حبه‌های سفت و بدون جوانه تلخی کمتری دارند.', swap: 'اگر سیر تازه نداری، مقدار کمی پودر سیر در پایان تفت پیاز.' },
    { ...ingredients[3], volume: '200 گرم', weightG: 200, component: 'سس گردویی', role: 'قوام، چربی و مزهٔ گردویی سس را می‌سازد.', buyTip: 'گردوی تازه و روشن بخر؛ گردوی مانده مزه تلخ و روغن‌زده می‌دهد.', swap: 'جایگزین واقعی ندارد؛ مقدار کمتر فقط سس را سبک‌تر می‌کند.' },
    { ...ingredients[4], volume: '3 قاشق غذاخوری', component: 'سس گردویی', role: 'ترشی و رنگ اصلی غذا را می‌سازد.', buyTip: 'رب انار ترش یا ملس با بافت غلیظ انتخاب کن، نه شربتی و رقیق.', swap: 'اگر خیلی ترش است، مقدار را کمتر کن و در پایان تنظیم کن.' },
    { ...ingredients[5], volume: '1 قاشق غذاخوری', component: 'سس گردویی', role: 'اختیاری؛ رنگ را گرم‌تر و ترشی رب انار را متعادل می‌کند.', buyTip: 'رب گوجه غلیظ و خوش‌رنگ بهتر جواب می‌دهد.', swap: 'می‌توان حذف کرد تا مزهٔ انار و گردو غالب‌تر بماند.' },
    { ...ingredients[6], volume: '80 گرم', weightG: 80, component: 'سبزی محلی', role: 'بخش پیازی و سبزِ عطر غذا را کامل می‌کند.', buyTip: 'تره تازه با ساقه‌های خشک‌نشده بخر.', swap: 'کمی کمتر استفاده کن اگر سبزی محلی پرعطر مثل چوچاق داری.' },
    { ...ingredients[7], volume: '80 گرم', weightG: 80, component: 'سبزی محلی', role: 'عطر سبز و روشن به خوراک می‌دهد.', buyTip: 'برگ‌های زرد یا له‌شده نخرید.', swap: 'در نبود جعفری، کمی گشنیز بیشتر استفاده کن.' },
    { ...ingredients[8], volume: '60 گرم', weightG: 60, component: 'سبزی محلی', role: 'عطر تند و شمالی‌تر را تقویت می‌کند.', buyTip: 'اگر چوچاق یا خالواش تازه پیدا کردی، بخشی از گشنیز را با آن جایگزین کن.', swap: 'چوچاق، خالواش یا ترکیب سبزی‌های محلی شمالی.' },
    { ...ingredients[9], volume: '3 قاشق غذاخوری', component: 'چاشنی و پخت', role: 'برای تفت اولیه و بازکردن عطرها.', buyTip: 'روغن خنثی انتخاب کن تا عطر گردو و رب انار پوشانده نشود.', swap: 'روغن کانولا یا روغن مایع خنثی.' },
    { ...ingredients[10], volume: '1 قاشق چای‌خوری', component: 'چاشنی و پخت', role: 'رنگ و گرمای ادویه‌ای پایه را می‌دهد.', buyTip: 'زردچوبه تازه‌تر رنگ زنده‌تری دارد.', swap: 'حذف نکن؛ فقط مقدار را کمتر کن اگر طعم زردچوبه دوست نداری.' },
    { ...ingredients[11], volume: '1.25 قاشق چای‌خوری', component: 'چاشنی و پخت', role: 'تعادل مزه ترش و گردویی را تنظیم می‌کند.', buyTip: 'نمک را مرحله‌ای اضافه کن چون رب انارها غلظت و شوری متفاوت دارند.', swap: 'نمک دریایی یا نمک معمولی؛ مقدار را با ذائقه تنظیم کن.' },
    { ...ingredients[12], volume: '0.5 قاشق چای‌خوری', component: 'چاشنی و پخت', role: 'گرمای ملایم و عطر پس‌زمینه می‌دهد.', buyTip: 'فلفل تازه آسیاب‌شده عطر بیشتری دارد.', swap: 'کمی فلفل قرمز برای نسخه تندتر.' },
  ].map((i) => ({
    ingredientId: i.ingredientId,
    code: i.code,
    name: i.name,
    amount: i.amount,
    unit: i.unit,
    displayUnit: i.unit,
    volume: i.volume,
    weightG: 'weightG' in i ? i.weightG : null,
    prepState: i.preparation,
    component: i.component,
    role: i.role,
    buyTip: i.buyTip,
    swap: i.swap,
    optional: 'optional' in i ? Boolean(i.optional) : false,
  })),
  steps: [
    { ...steps[0], flame: 'medium', sees: 'پیاز نرم و طلایی روشن می‌شود و بوی سیر و زردچوبه بالا می‌آید.', doneness: 'پیاز خام نیست، اما قهوه‌ای و تلخ هم نشده.', tip: 'زردچوبه را بعد از نرم‌شدن پیاز اضافه کن تا نسوزد.', recovery: 'اگر پیاز تیره شد، حرارت را کم کن و کمی آب اضافه کن.' },
    { ...steps[1], flame: 'medium-high', sees: 'سطح تکه‌های گوشت از قرمز خام به قهوه‌ای روشن می‌رسد.', doneness: 'بیرون گوشت رنگ گرفته و آب اضافه کف قابلمه جمع نشده.', tip: 'قابلمه را شلوغ نکن؛ اگر آب انداخت، چند دقیقه بدون در بپز تا آب تبخیر شود.', recovery: 'اگر گوشت سفت شد، نگران نباش؛ مرحله آرام‌پز آن را نرم می‌کند.' },
    { ...steps[2], flame: 'medium', sees: 'گردو عطر می‌دهد و رب انار رنگ پایه را تیره‌تر و براق‌تر می‌کند.', doneness: 'بوی خامی گردو کم شده اما گردو نسوخته است.', tip: 'گردو را طولانی تفت نده؛ سوختن گردو تلخی پایدار می‌دهد.', recovery: 'اگر ته گرفت، کمی آب داغ اضافه کن و کف قابلمه را آرام آزاد کن.' },
    { ...steps[3], flame: 'low', sees: 'خوراک ریزجوش می‌زند؛ سس کم‌کم تیره و غلیظ می‌شود.', doneness: 'گوشت با فشار قاشق نرم می‌شود و سس گردویی به قوام می‌رسد.', tip: 'جوش تند سس گردویی را خراب و گوشت را سفت می‌کند.', recovery: 'اگر آب کم شد، فقط آب داغ اضافه کن؛ آب سرد پخت را عقب می‌اندازد.' },
    { ...steps[4], flame: 'low', sees: 'سبزی رنگ و عطر تازه می‌دهد و در سس پخش می‌شود.', doneness: 'سبزی پخته اما بی‌رنگ و سوخته نیست.', tip: 'سبزی را آخرتر اضافه کن تا عطر محلی آن زنده بماند.', recovery: 'اگر سبزی زیادی تیره شد، دفعه بعد آن را دیرتر اضافه کن.' },
    { ...steps[5], flame: 'low', sees: 'وقتی کفگیر را می‌کشی، سس آرام برمی‌گردد و آبکی نیست.', doneness: 'مزه ترش، شور و گردویی متعادل است و گوشت نرم شده.', tip: 'رب انارها فرق دارند؛ مزه نهایی را در همین مرحله تنظیم کن.', recovery: 'اگر ترشی زیاد شد، کمی آب داغ و پخت بیشتر مزه را گردتر می‌کند.' },
    { ...steps[6], flame: 'none', sees: 'خوراک غلیظ و براق است و تکه‌های گوشت در سس نشسته‌اند.', doneness: 'داغ و جاافتاده، آماده سرو با کته یا نان.', tip: 'ظرف گرم کمک می‌کند سس گردویی زود نبندد.', recovery: '' },
  ].map((s) => ({ order: s.order, title: s.title, instruction: s.instruction, durationMin: s.duration, flame: s.flame, sees: s.sees, doneness: s.doneness, tip: s.tip, recovery: s.recovery })),
  whyItWorks: [
    { point: 'گردو با پخت آرام سس را غلیظ و براق می‌کند.', explanation: 'تفت کوتاه گردو بوی خامی را کم می‌کند و پخت آرام، چربی و بافت آن را وارد سس می‌کند.' },
    { point: 'رب انار باید زودتر وارد شود.', explanation: 'رب انار در تماس با گوشت و چربی، مزه ترش و ملس را در پایه غذا پخش می‌کند.' },
    { point: 'سبزی در پایان می‌آید.', explanation: 'سبزی محلی اگر خیلی زود اضافه شود عطرش می‌پرد و رنگش تیره می‌شود.' },
  ],
  chefTips: ['از گوشت تکه‌ای خورشتی استفاده کنید، نه گوشت چرخ‌کرده.', 'اگر گمج سفالی ندارید، قابلمه چدنی یا ضخیم با حرارت کم بهتر از تابه نازک است.', 'چوچاق یا خالواش عطر را محلی‌تر می‌کند، اما نبودنش دستور را متوقف نمی‌کند.'],
  commonMistakes: ['استفاده از گوشت چرخ‌کرده به جای گوشت تکه‌ای.', 'جوشاندن تند که گوشت را سفت و سس گردویی را دو فاز می‌کند.', 'اضافه‌کردن سبزی از اول پخت که عطر شمالی را کم می‌کند.'],
  servingSuggestions: ['کته شمالی', 'سبزی خوردن', 'زیتون پرورده', 'ترشی محلی'],
  serveWith: ['کته شمالی ساده', 'زیتون پرورده', 'سبزی خوردن', 'ماست چکیده یا ماست ساده', 'ترشی سیر یا ترشی محلی'],
  substitutions: ['گوشت گوساله خورشتی می‌تواند جای گوشت گوسفند بیاید، اما زمان پخت ممکن است بیشتر شود.', 'اگر رب انار خیلی ترش است، مقدار را کمتر کنید و در پایان تنظیم کنید.', 'به جای چوچاق، ترکیب تره، جعفری و گشنیز قابل قبول‌تر از حذف کامل سبزی است.'],
  variations: [
    { name: 'با گوشت گوساله', how: 'گوشت گوسفند را با گوشت گوساله خورشتی عوض کن و زمان آرام‌پز را حدود ۱۵ تا ۲۰ دقیقه بیشتر بگیر.' },
    { name: 'ترش‌تر', how: 'رب انار ترش‌تر یا کمی آب انار ترش اضافه کن و نمک را در پایان دوباره تنظیم کن.' },
    { name: 'گیلانی‌تر با سبزی محلی', how: 'اگر چوچاق یا خالواش داری، بخشی از گشنیز را با آن جایگزین کن تا عطر شمالی‌تر شود.' },
    { name: 'سبک‌تر', how: 'مقدار گردو را کمی کمتر کن و با پخت آرام‌تر قوام را از تبخیر بگیر؛ مزه گردویی ملایم‌تر می‌شود.' },
  ],
  skillsLearned: ['جاانداختن سس گردویی', 'کنترل ترشی رب انار', 'نرم‌کردن گوشت تکه‌ای با پخت آرام', 'زمان‌بندی اضافه‌کردن سبزی تازه'],
  troubleshooting: [
    { problem: 'گوشت هنوز سفت است', fix: 'حرارت را کم نگه دار، کمی آب داغ اضافه کن و زمان پخت را ادامه بده؛ گوشت تکه‌ای با عجله نرم نمی‌شود.' },
    { problem: 'سس آبکی مانده', fix: 'در قابلمه را بردار و با حرارت ملایم بجوشان تا آب اضافه تبخیر شود؛ گردو باید فرصت قوام‌دادن داشته باشد.' },
    { problem: 'مزه زیادی ترش شده', fix: 'کمی آب داغ اضافه کن و چند دقیقه دیگر بپز؛ برای دفعات بعد رب انار را مرحله‌ای اضافه کن.' },
    { problem: 'سبزی تیره و بی‌عطر شده', fix: 'سبزی را دیرتر اضافه کن و بعد از اضافه‌کردن آن جوش تند نده.' },
  ],
  nourishment: {
    note: 'غذایی پرپروتئین و پرانرژی است؛ گردو چربی و کالری را بالا می‌برد و برای وعده اصلی کنار برنج یا نان مناسب است.',
    perServing: { calories: 430, proteinG: 27, carbsG: 12, fatG: 31, fiberG: 3 },
    disclaimer: 'ارزش غذایی تقریبی است و جای توصیه پزشکی را نمی‌گیرد.',
  },
  keep: { storage: 'در ظرف دربسته تا ۳ روز در یخچال.', reheat: 'با حرارت کم و کمی آب داغ گرم کنید تا سس دوباره باز شود.', freeze: 'بدون سبزی تازه بهتر فریز می‌شود؛ با سبزی هم ممکن است عطر و رنگ افت کند.', makeAhead: 'پایه گوشت و گردو را می‌توان از قبل پخت و سبزی را نزدیک سرو اضافه کرد.' },
  faq: [
    { q: 'گوشت گمج کباب باید چرخ‌کرده باشد؟', a: 'نه؛ برای این مدل گیلانی از گوشت تکه‌ای خورشتی استفاده کنید تا بافت و زمان پخت درست بماند.' },
    { q: 'اگر چوچاق نداشته باشم چه کنم؟', a: 'از تره، جعفری و گشنیز استفاده کنید؛ عطر دقیق محلی کمتر می‌شود، اما ساختار غذا درست می‌ماند.' },
    { q: 'با نان بهتر است یا برنج؟', a: 'هر دو ممکن است، اما کنار کته شمالی یا نان تازه رایج و خوش‌خوراک است.' },
  ],
  finish: { finalLook: 'خوراکی قهوه‌ای-اناری، غلیظ و براق با تکه‌های گوشت نرم و سبزی معطر.', plating: 'در گمج یا ظرف گرم سرو کنید؛ کنار آن کته، سبزی و زیتون بگذارید.', chefSecret: 'سس را عجله‌ای رقیق برندارید؛ گمج کباب وقتی خوب است که گردو و رب انار به غلظت خوراک جاافتاده برسند.' },
  dietary: { allergens: ['tree_nut'], containsPork: false },
};

function ingredientNotes(i: (typeof ingredients)[number]) {
  return JSON.stringify({
    ingredientId: i.ingredientId,
    code: i.code,
    preparation: i.preparation || null,
    optional: 'optional' in i ? Boolean(i.optional) : false,
    unit: i.unit,
    line: `${i.amount} ${i.unit} ${i.name}${i.preparation ? `، ${i.preparation}` : ''}`,
  });
}

async function main() {
  fs.mkdirSync(backupDir, { recursive: true });
  const before = await prisma.recipe.findUnique({
    where: { id: recipeId },
    include: { ingredients: true, steps: true, searchTerms: true, nutrition: true },
  });
  if (!before) throw new Error('recipe_not_found');
  fs.writeFileSync(backupPath, JSON.stringify(before, null, 2), 'utf8');

  const oldAdmin = before.adminNote ? JSON.parse(before.adminNote) : {};
  oldAdmin.aiContext = {
    ...(oldAdmin.aiContext || {}),
    searchKeywordsFa: ['گمج کباب', 'gamaj-kabab', 'خوراک گیلانی با گوشت تکه‌ای گردو رب انار و سبزی محلی'],
    behaviorSignals: {
      ...((oldAdmin.aiContext || {}).behaviorSignals || {}),
      primaryIngredientIds: ['ing_lamb_meat_raw', 'ing_walnuts_raw', 'ing_pomegranate_molasses', 'ing_tareh_fresh', 'ing_parsley_fresh', 'ing_cilantro_fresh'],
    },
  };
  oldAdmin.contentFix = {
    fixedAt: now,
    reason: 'Corrected Gamaj Kabab to Gilan-style walnut-pomegranate herb stew with chunked meat and local herbs.',
  };

  await prisma.$transaction(async (tx) => {
    await tx.recipe.update({
      where: { id: recipeId },
      data: {
        description: 'گمج کباب یک خوراک گیلانیِ جاافتاده با گوشت تکه‌ای، گردو، رب انار و سبزی محلی است. مزهٔ اصلی از پخت آرام گوشت در سس ترش و غلیظ گردو و انار می‌آید.',
        difficulty: 'medium',
        cookingTime: 75,
        prepTime: '20',
        totalTime: '95',
        servings: 4,
        tools: JSON.stringify(['گمج سفالی یا قابلمه ضخیم', 'کفگیر', 'چاقو', 'تخته', 'درپوش']),
        tips: JSON.stringify(['گوشت تکه‌ای استفاده کنید، نه چرخ‌کرده.', 'گردو را کوتاه تفت دهید تا بوی خامی کم شود اما نسوزد.', 'سبزی محلی را نزدیک پایان اضافه کنید تا عطرش بماند.', 'اگر چوچاق یا خالواش ندارید، تره و جعفری و گشنیز جایگزین عملی هستند.', 'غذا باید غلیظ و جاافتاده باشد، نه آبکی.']),
        faq: JSON.stringify(gris.faq.map(({ q, a }) => ({ question: q, answer: a }))),
        categories: JSON.stringify(['main_course', 'گمج کباب', 'گیلانی', 'گردو', 'رب انار', 'سبزی محلی', 'protein_forward']),
        allergens: JSON.stringify(['tree_nut']),
        chefTips: JSON.stringify(gris.chefTips),
        commonMistakes: JSON.stringify(gris.commonMistakes),
        servingSuggestions: JSON.stringify(gris.servingSuggestions),
        substitutions: JSON.stringify(gris.substitutions),
        gris,
        adminNote: JSON.stringify(oldAdmin),
        containsPork: false,
        nutrition: {
          upsert: {
            create: { calories: 430, protein: 27, carbs: 12, fat: 31, fiber: 3 },
            update: { calories: 430, protein: 27, carbs: 12, fat: 31, fiber: 3 },
          },
        },
        ingredients: {
          deleteMany: {},
          create: ingredients.map((i) => ({
            ingredientId: i.ingredientId,
            name: i.name,
            amount: i.amount,
            unit: i.unit,
            notes: ingredientNotes(i),
            order: i.order,
          })),
        },
        steps: {
          deleteMany: {},
          create: steps.map((s) => ({
            title: s.title,
            instruction: s.instruction,
            duration: s.duration,
            order: s.order,
          })),
        },
        searchTerms: {
          deleteMany: {},
          create: ['gamaj-kabab', 'گمج کباب', 'گیلانی', 'گوشت تکه‌ای', 'گردو', 'رب انار', 'سبزی محلی', 'چوچاق', 'خوراک گیلانی', 'main_course', 'lunch', 'dinner', 'persian'].map((term) => ({ term })),
        },
      },
    });
  });

  const after = await prisma.recipe.findUnique({
    where: { id: recipeId },
    include: { ingredients: { orderBy: { order: 'asc' } }, steps: { orderBy: { order: 'asc' } }, searchTerms: true },
  });
  if (!after) throw new Error('recipe_missing_after_update');
  const text = JSON.stringify(after);
  console.log(JSON.stringify({
    ok: true,
    backupPath,
    ingredientCount: after.ingredients.length,
    stepCount: after.steps.length,
    searchTermCount: after.searchTerms.length,
    hasEggFa: text.includes('تخم'),
    hasEggEn: /egg/i.test(text),
    allergens: after.allergens,
    firstIngredients: after.ingredients.slice(0, 6).map((i) => i.name),
    steps: after.steps.map((s) => s.title),
  }, null, 2));
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
