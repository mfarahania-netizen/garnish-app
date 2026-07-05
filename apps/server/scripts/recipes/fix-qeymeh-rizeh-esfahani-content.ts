import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const recipeId = 'garnish_recipe_fa_170_44f0d2ad';
const now = new Date().toISOString();
const backupDir = path.resolve(process.cwd(), '..', '..', 'docs', 'qa', 'recipes', 'content-fixes');
const backupPath = path.join(backupDir, `qeymeh-rizeh-esfahani-before-${now.replace(/[:.]/g, '-')}.json`);

const ingredients = [
  { ingredientId: 'ing_ground_lamb_raw', code: 'ground_lamb_raw', name: 'گوشت چرخ‌کرده گوسفند خام', amount: '450', unit: 'گرم', preparation: 'ترجیحاً با چربی ملایم، برای کوفته‌ریزه', order: 1, component: 'کوفته‌ریزه', volume: '۴۵۰ گرم', weightG: 450, role: 'بدنه و پروتئین اصلی؛ با ورز کافی کوفته‌ها را منسجم نگه می‌دارد.', buyTip: 'چرخ‌کرده خیلی خشک نگیرید؛ کمی چربی باعث آبدار ماندن کوفته‌ریزه می‌شود.', swap: 'ترکیب گوشت گوسفند و گوساله هم قابل قبول است.' },
  { ingredientId: 'ing_onion_raw', code: 'onion_raw', name: 'پیاز خام', amount: '2', unit: 'عدد متوسط', preparation: 'یکی رنده و آب‌گرفته برای گوشت، یکی نگینی برای سس', order: 2, component: 'پایه و کوفته‌ریزه', volume: '۲ عدد متوسط', role: 'هم عطر کوفته را می‌سازد، هم شیرینی پایه سس را.', buyTip: 'پیاز زرد سفت و آبدار انتخاب کنید.', swap: 'پیاز سفید هم جواب می‌دهد، اما پیاز قرمز رنگ سس را تیره‌تر می‌کند.' },
  { ingredientId: 'ing_chickpea_flour', code: 'chickpea_flour', name: 'آرد نخودچی', amount: '3', unit: 'قاشق غذاخوری', preparation: 'الک‌شده', order: 3, component: 'کوفته‌ریزه', volume: '۳ قاشق غذاخوری', role: 'چسبندگی و بافت سنتی کوفته‌ریزه را می‌دهد.', buyTip: 'آرد نخودچی تازه و خوش‌بو بگیرید؛ بوی کهنگی طعم غذا را خراب می‌کند.', swap: 'در کمبود، آرد برنج کم‌کم اضافه شود؛ بافت کمی متفاوت می‌شود.' },
  { ingredientId: 'ing_potato_raw', code: 'potato_raw', name: 'سیب‌زمینی خام', amount: '1', unit: 'عدد بزرگ', preparation: 'مکعبی یا خلال درشت، برای سس', order: 4, component: 'سس', volume: '۱ عدد بزرگ', weightG: 250, role: 'بدنه، نشاسته و سیرکنندگی غذا را کامل می‌کند.', buyTip: 'سیب‌زمینی سالم و کم‌آب انتخاب کنید تا در سس وا نرود.', swap: 'برای نسخه سبک‌تر مقدار را نصف کنید.' },
  { ingredientId: 'ing_tomato_paste', code: 'tomato_paste', name: 'رب گوجه‌فرنگی', amount: '2', unit: 'قاشق غذاخوری', preparation: 'برای بازکردن رنگ در روغن', order: 5, component: 'سس', volume: '۲ قاشق غذاخوری', role: 'رنگ و مزه سس گوجه‌ای غذا را می‌سازد.', buyTip: 'رب غلیظ و خوش‌رنگ بگیرید؛ رب شل سس را آبکی می‌کند.', swap: 'کمی پوره گوجه می‌تواند بخشی از رب را همراهی کند، نه جایگزین کامل.' },
  { ingredientId: 'ing_tomato_raw', code: 'tomato_raw', name: 'گوجه‌فرنگی خام', amount: '2', unit: 'عدد متوسط', preparation: 'رنده یا پوره‌شده', order: 6, component: 'سس', volume: '۲ عدد متوسط', weightG: 240, role: 'ترشی و آب طبیعی سس را متعادل می‌کند.', buyTip: 'گوجه رسیده و گوشتی انتخاب کنید.', swap: 'پاساتای گوجه بدون ادویه، حدود نصف پیمانه.' },
  { ingredientId: 'ing_dried_mint', code: 'dried_mint', name: 'نعناع خشک', amount: '1', unit: 'قاشق مرباخوری', preparation: 'نیمه برای گوشت، نیمه برای سس', order: 7, component: 'عطر و ادویه', volume: '۱ قاشق مرباخوری', role: 'امضای عطری نسخه اصفهانی را می‌دهد.', buyTip: 'نعناع خشک سبز و خوش‌بو بگیرید؛ نمونه قهوه‌ای تلخ می‌شود.', swap: 'نعناع تازه خردشده در مقدار کم، نزدیک پایان پخت.' },
  { ingredientId: 'ing_parsley_fresh', code: 'parsley_fresh', name: 'جعفری تازه', amount: '2', unit: 'قاشق غذاخوری', preparation: 'ریز خردشده', order: 8, component: 'عطر و ادویه', volume: '۲ قاشق غذاخوری', role: 'طعم سبز و سبک به کوفته‌ریزه می‌دهد.', buyTip: 'برگ تازه و بدون زردی انتخاب کنید.', swap: 'در نبود، حذف شود؛ مقدار نعناع را زیاد نکنید.' },
  { ingredientId: 'ing_turmeric_ground', code: 'turmeric_ground', name: 'زردچوبه آسیاب‌شده', amount: '1', unit: 'قاشق چای‌خوری', preparation: 'برای گوشت و سس', order: 9, component: 'عطر و ادویه', volume: '۱ قاشق چای‌خوری', role: 'رنگ پایه و گرمای ادویه‌ای می‌دهد.', buyTip: 'زردچوبه تازه‌تر رنگ زنده‌تری دارد.', swap: 'حذف نشود؛ فقط مقدار را کم کنید.' },
  { ingredientId: 'ing_cinnamon_ground', code: 'cinnamon_ground', name: 'دارچین آسیاب‌شده', amount: '0.25', unit: 'قاشق چای‌خوری', preparation: 'اختیاری و کم', order: 10, component: 'عطر و ادویه', volume: 'یک‌چهارم قاشق چای‌خوری', role: 'عطر گرم پس‌زمینه می‌دهد، بدون اینکه غالب شود.', buyTip: 'دارچین تازه و معطر انتخاب کنید.', swap: 'قابل حذف است.' },
  { ingredientId: 'ing_sunflower_oil', code: 'sunflower_oil', name: 'روغن آفتابگردان', amount: '4', unit: 'قاشق غذاخوری', preparation: 'برای تفت و سرخ‌کردن سبک', order: 11, component: 'پخت', volume: '۴ قاشق غذاخوری', role: 'پایه تفت، رنگ رب و پخت سیب‌زمینی را کامل می‌کند.', buyTip: 'روغن خنثی انتخاب کنید تا عطر نعناع و گوشت پوشانده نشود.', swap: 'روغن کانولا یا روغن مایع خنثی.' },
  { ingredientId: 'ing_salt_table', code: 'salt_table', name: 'نمک خوراکی', amount: '1.25', unit: 'قاشق چای‌خوری', preparation: 'مرحله‌ای تنظیم شود', order: 12, component: 'عطر و ادویه', volume: '۱ و یک‌چهارم قاشق چای‌خوری', role: 'طعم گوشت، سس و سیب‌زمینی را یکپارچه می‌کند.', buyTip: 'نمک را مرحله‌ای اضافه کنید چون رب‌ها شوری متفاوت دارند.', swap: 'نمک دریایی یا معمولی؛ مقدار با ذائقه تنظیم شود.' },
  { ingredientId: 'ing_black_pepper_ground', code: 'black_pepper_ground', name: 'فلفل سیاه آسیاب‌شده', amount: '0.5', unit: 'قاشق چای‌خوری', preparation: 'تازه آسیاب‌شده', order: 13, component: 'عطر و ادویه', volume: 'نصف قاشق چای‌خوری', role: 'گرمای ملایم و عطر پس‌زمینه می‌دهد.', buyTip: 'فلفل تازه آسیاب‌شده عطر بیشتری دارد.', swap: 'کمی فلفل قرمز برای نسخه تندتر.' },
] as const;

const steps = [
  { order: 1, title: 'آماده‌کردن مایه کوفته‌ریزه', instruction: 'گوشت چرخ‌کرده، پیاز رنده و آب‌گرفته، آرد نخودچی، بخشی از نعناع خشک، جعفری، زردچوبه، نمک و فلفل را ۵ تا ۷ دقیقه ورز دهید تا مایه چسبنده و منسجم شود.', duration: 10, flame: 'none', sees: 'مایه گوشت از حالت شل خارج شده و وقتی در دست فشرده می‌شود ترک عمیق ندارد.', doneness: 'مایه قابل فرم دادن است و آب پیاز جدا نمی‌اندازد.', tip: 'آب پیاز را حتماً بگیرید؛ رطوبت زیاد باعث باز شدن کوفته‌ها در سس می‌شود.', recovery: 'اگر مایه شل بود، یک قاشق آرد نخودچی اضافه کنید و دوباره ورز دهید.' },
  { order: 2, title: 'فرم‌دادن کوفته‌ها', instruction: 'از مایه گوشت، گلوله‌های کوچک کمی بزرگ‌تر از فندق بسازید و ۱۰ دقیقه در یخچال بگذارید تا خودشان را بگیرند.', duration: 10, flame: 'none', sees: 'کوفته‌ها هم‌اندازه و سطحشان صاف است.', doneness: 'با لمس آرام تغییر شکل نمی‌دهند.', tip: 'اندازه کوچک باعث می‌شود سریع‌تر مغزپخت شوند و ظاهر سنتی غذا حفظ شود.', recovery: 'اگر ترک خوردند، دست را کمی مرطوب کنید و دوباره گرد کنید.' },
  { order: 3, title: 'ساختن پایه سس', instruction: 'پیاز نگینی را در روغن تفت دهید تا طلایی روشن شود. زردچوبه، رب گوجه و باقی نعناع خشک را اضافه کنید و کوتاه تفت دهید تا رب رنگ باز کند.', duration: 8, flame: 'medium', sees: 'رب از قرمز خام به قرمز تیره‌تر و براق می‌رسد و بوی خامی آن کم می‌شود.', doneness: 'پیاز نرم است و پایه سس بوی ادویه سوخته نمی‌دهد.', tip: 'نعناع خشک زود می‌سوزد؛ بعد از رب، کوتاه و با حرارت کنترل‌شده تفت دهید.', recovery: 'اگر ته گرفت، کمی آب جوش اضافه کنید و مواد را از کف قابلمه جدا کنید.' },
  { order: 4, title: 'پخت سس و سیب‌زمینی', instruction: 'گوجه پوره‌شده و حدود ۲ پیمانه آب جوش را اضافه کنید. سیب‌زمینی را داخل سس بریزید و بگذارید ۱۰ دقیقه آرام بجوشد تا نیم‌پز شود.', duration: 12, flame: 'low', sees: 'سس یکدست و قرمز است و سیب‌زمینی هنوز شکل خود را حفظ کرده.', doneness: 'سیب‌زمینی با فشار قاشق کمی نرم می‌شود اما له نیست.', tip: 'سس باید آرام بجوشد؛ قل شدید سیب‌زمینی را خرد می‌کند.', recovery: 'اگر سس غلیظ شد، فقط آب جوش اضافه کنید، نه آب سرد.' },
  { order: 5, title: 'اضافه‌کردن کوفته‌ریزه‌ها', instruction: 'وقتی سس آرام در حال جوش است، کوفته‌ها را یکی‌یکی داخل قابلمه بگذارید. ۵ دقیقه اول هم نزنید تا سطح کوفته‌ها خودش را بگیرد.', duration: 8, flame: 'low', sees: 'سطح کوفته‌ها رنگ عوض می‌کند و دیگر خام و نرم دیده نمی‌شود.', doneness: 'کوفته‌ها در سس ثابت مانده‌اند و وا نرفته‌اند.', tip: 'کوفته را در سس سرد نیندازید؛ سس باید آرام بجوشد.', recovery: 'اگر چند کوفته باز شد، هم نزنید؛ بگذارید سس غلیظ‌تر شود و بقیه خودشان را بگیرند.' },
  { order: 6, title: 'جاافتادن آرام', instruction: 'در قابلمه را نیمه‌باز بگذارید و غذا را ۲۰ تا ۲۵ دقیقه آرام بپزید تا کوفته‌ها مغزپخت، سیب‌زمینی نرم و سس غلیظ شود. نمک و دارچین کم را در پایان تنظیم کنید.', duration: 25, flame: 'low', sees: 'سس به قاشق می‌نشیند، کوفته‌ها روی سطح دیده می‌شوند و سیب‌زمینی فرم دارد.', doneness: 'یک کوفته نصف‌شده در مرکز خام نیست و سس آبکی نیست.', tip: 'دارچین را کم بزنید؛ قرار است عطر پس‌زمینه بدهد نه مزه شیرین غالب.', recovery: 'اگر سس آبکی بود، چند دقیقه بدون در بجوشانید.' },
  { order: 7, title: 'استراحت و سرو', instruction: 'قابلمه را ۵ دقیقه از حرارت بردارید تا سس آرام بگیرد، سپس قیمه‌ریزه را با نان تازه یا برنج ساده و سبزی خوردن سرو کنید.', duration: 5, flame: 'none', sees: 'روغن نارنجی ملایم روی سس نشسته و کوفته‌ها منظم در سس قرار دارند.', doneness: 'غذا داغ، جاافتاده و آماده سرو است.', tip: 'استراحت کوتاه باعث می‌شود کوفته‌ها هنگام سرو نشکنند.', recovery: '' },
] as const;

const gris = {
  schemaVersion: 'gris.v2.content-fix',
  recipeId,
  title: 'قیمه‌ریزه اصفهانی',
  firstLook: 'کوفته‌ریزه‌های کوچکِ گوشت چرخ‌کرده در سس گوجه‌ای نعناعی با سیب‌زمینی نرم؛ غذای خانگی، سریع‌تر از خورش‌های طولانی و کاملاً اصفهانی.',
  glance: {
    promise: 'قیمه‌ریزه‌ای با کوفته‌های منسجم، سس قرمز جاافتاده، عطر نعناع و سیب‌زمینی نرم؛ بدون بافت خورشیِ اشتباه و بدون سنگینی اضافه.',
    servings: 4,
    difficulty: 'medium',
    totalTimeMin: 65,
    activeTimeMin: 30,
    handsOffMin: 25,
    costBand: 'متوسط',
    keyEquipment: ['قابلمه متوسط', 'رنده', 'کاسه برای ورز دادن', 'کفگیر'],
    goodFor: ['ناهار خانگی', 'شام ساده', 'غذای اصفهانی', 'سرو با نان یا برنج'],
  },
  story: {
    hook: 'قیمه‌ریزه اصفهانی در اصل بازیِ اندازه و بافت است: گوشت چرخ‌کرده خوب ورزخورده به کوفته‌های کوچک تبدیل می‌شود و در سس گوجه‌ای معطر آرام می‌پزد.',
    origin: 'این غذا در آشپزی خانگی اصفهان با نام قیمه‌ریزه یا قیمه نخودچی شناخته می‌شود؛ تمرکزش روی کوفته‌های ریز، آرد نخودچی، نعناع و سس ساده خانگی است، نه ساختار خورش قیمه.',
    occasion: 'برای روزهایی مناسب است که غذای گرم، مقوی و سفره‌پسند می‌خواهید اما نمی‌خواهید سراغ خورش طولانی بروید.',
  },
  ingredients: ingredients.map((i) => ({
    ingredientId: i.ingredientId,
    code: i.code,
    name: i.name,
    amount: i.amount,
    unit: i.unit,
    displayUnit: i.unit,
    volume: i.volume,
    weightG: 'weightG' in i ? i.weightG : null,
    prepState: i.preparation,
    preparation: i.preparation,
    optional: false,
    component: i.component,
    role: i.role,
    buyTip: i.buyTip,
    swap: i.swap,
  })),
  steps: steps.map((s) => ({
    order: s.order,
    title: s.title,
    instruction: s.instruction,
    durationMin: s.duration,
    flame: s.flame,
    sees: s.sees,
    doneness: s.doneness,
    tip: s.tip,
    recovery: s.recovery,
  })),
  whyItWorks: [
    { point: 'آرد نخودچی چسبندگی کنترل‌شده می‌دهد.', explanation: 'وقتی گوشت با پیاز آب‌گرفته و آرد نخودچی ورز می‌خورد، پروتئین و نشاسته کنار هم کوفته‌ای می‌سازند که در سس باز نمی‌شود.' },
    { point: 'سس باید پیش از ورود کوفته‌ها آرام بجوشد.', explanation: 'حرارت ملایم سطح کوفته‌ها را سریع می‌بندد؛ اگر سس سرد باشد مایه گوشت در مایع پخش می‌شود.' },
    { point: 'سیب‌زمینی زودتر وارد سس می‌شود.', explanation: 'سیب‌زمینی برای نرم شدن و دادن کمی نشاسته به سس زمان لازم دارد، اما باید آن‌قدر آرام بپزد که شکلش حفظ شود.' },
  ],
  chefTips: ['آب پیاز کوفته را کامل بگیرید.', 'مایه گوشت را حداقل ۵ دقیقه ورز دهید تا کوفته‌ها در سس باز نشوند.', 'رب را در روغن باز کنید تا رنگ و طعم خام نداشته باشد.', 'کوفته‌ها را در سس آرام‌جوش بیندازید و چند دقیقه اول هم نزنید.'],
  commonMistakes: ['ریختن کوفته در سس سرد یا خاموش.', 'آب‌دار گذاشتن پیاز رنده‌شده در مایه گوشت.', 'زیاد کردن نعناع خشک و تلخ کردن سس.', 'قل شدید دادن بعد از اضافه شدن کوفته‌ها.'],
  servingSuggestions: ['با نان سنگک یا بربری تازه', 'با برنج ساده کم‌چرب', 'کنار سبزی خوردن، ماست ساده یا ترشی ملایم', 'با کمی آب‌لیموی تازه در کنار سفره، نه داخل قابلمه'],
  serveWith: ['نان تازه', 'برنج ساده', 'سبزی خوردن', 'ماست ساده', 'ترشی مخلوط ملایم'],
  substitutions: ['گوشت گوساله چرخ‌کرده می‌تواند بخشی از گوشت گوسفند را جایگزین کند.', 'اگر جعفری ندارید حذفش کنید و نعناع را زیاد نکنید.', 'پوره گوجه می‌تواند کمی از آب سس را خوش‌طعم‌تر کند.'],
  variations: [
    { name: 'نسخه سبک‌تر', how: 'کوفته‌ها را مستقیم در سس بپزید و از سرخ کردن جداگانه صرف‌نظر کنید.' },
    { name: 'نسخه تندتر', how: 'کمی فلفل قرمز یا فلفل کاین به پایه سس اضافه کنید.' },
    { name: 'سرو مجلسی‌تر', how: 'سیب‌زمینی را درشت‌تر و مرتب‌تر خرد کنید تا هنگام سرو شکل غذا تمیزتر بماند.' },
  ],
  skillsLearned: ['ورزدادن مایه کوفته بدون تخم‌مرغ', 'بازکردن رب در روغن', 'کنترل جوش آرام برای کوفته‌های ریز', 'متعادل کردن عطر نعناع خشک'],
  troubleshooting: [
    { problem: 'کوفته‌ها باز شدند', fix: 'آب پیاز زیاد بوده یا ورز کافی نبوده؛ دفعات بعد آب پیاز را بگیرید و کمی آرد نخودچی اضافه کنید. برای همین قابلمه هم فعلاً هم نزنید تا سس غلیظ‌تر شود.' },
    { problem: 'سس آبکی است', fix: 'در قابلمه را بردارید و چند دقیقه با حرارت ملایم بجوشانید تا غلیظ شود.' },
    { problem: 'طعم نعناع تلخ شده', fix: 'نعناع یا سوخته یا زیاد بوده؛ کمی گوجه پوره‌شده و آب جوش اضافه کنید و چند دقیقه آرام بپزید.' },
    { problem: 'سیب‌زمینی له شده', fix: 'جوش خیلی شدید بوده؛ دفعات بعد حرارت را کم کنید و قطعات سیب‌زمینی را بزرگ‌تر بگیرید.' },
  ],
  nourishment: {
    note: 'غذایی پروتئینی و سیرکننده است؛ سیب‌زمینی کربوهیدرات و بافت سس را کامل می‌کند و مقدار روغن را می‌توان کنترل کرد.',
    perServing: { calories: 420, proteinG: 25, carbsG: 24, fatG: 25, fiberG: 3 },
    disclaimer: 'ارزش غذایی تقریبی است و جای توصیه پزشکی را نمی‌گیرد.',
  },
  keep: {
    storage: 'در ظرف دربسته تا ۳ روز در یخچال نگهداری شود.',
    reheat: 'با حرارت کم و کمی آب جوش گرم کنید تا سس دوباره باز شود.',
    freeze: 'قابل فریز است، اما سیب‌زمینی بعد از یخ‌زدایی کمی بافت نرم‌تری پیدا می‌کند.',
    makeAhead: 'مایه کوفته را می‌توان چند ساعت زودتر آماده و در یخچال نگه داشت.',
  },
  faq: [
    { q: 'چرا کوفته‌های قیمه‌ریزه باز می‌شوند؟', a: 'معمولاً آب پیاز زیاد است یا مایه خوب ورز نخورده. آب پیاز را بگیرید، آرد نخودچی را کم‌کم اضافه کنید و چند دقیقه ورز دهید.' },
    { q: 'قیمه‌ریزه را با نان بخوریم یا برنج؟', a: 'هر دو درست است؛ با نان حالت خوراک خانگی‌تر دارد و با برنج تبدیل به وعده کامل‌تر می‌شود.' },
    { q: 'آیا لازم است کوفته‌ها جدا سرخ شوند؟', a: 'نه؛ اگر مایه خوب ورز خورده باشد، پخت مستقیم در سس آرام‌جوش هم تمیزتر است و هم سبک‌تر.' },
  ],
  finish: {
    finalLook: 'سس قرمز و غلیظ، کوفته‌های کوچک و سالم، سیب‌زمینی نرم اما له‌نشده و عطر ملایم نعناع.',
    plating: 'در ظرف کم‌عمق سرو کنید تا کوفته‌ها و سیب‌زمینی دیده شوند؛ کنار آن نان یا برنج و سبزی خوردن بگذارید.',
    chefSecret: 'راز غذا در آب‌گرفتن پیاز و آرام‌جوش بودن سس است؛ همین دو کار کوفته‌ریزه را سالم و حرفه‌ای نگه می‌دارد.',
  },
  dietary: { allergens: [], containsPork: false },
};

const searchTerms = [
  'gheymeh-rizeh-esfahani',
  'qeymeh-rizeh-esfahani',
  'قیمه‌ریزه',
  'قیمه ریزه',
  'قیمه‌ریزه اصفهانی',
  'قیمه ریزه اصفهانی',
  'قیمه نخودچی',
  'کوفته ریزه اصفهانی',
  'گوشت چرخ‌کرده',
  'آرد نخودچی',
  'سیب‌زمینی',
  'نعناع خشک',
  'غذای اصفهانی',
  'persian',
  'main_course',
  'lunch',
  'dinner',
];

function ingredientNotes(i: (typeof ingredients)[number]) {
  return JSON.stringify({
    ingredientId: i.ingredientId,
    code: i.code,
    preparation: i.preparation,
    optional: false,
    unit: i.unit,
    line: `${i.amount} ${i.unit} ${i.name}، ${i.preparation}`,
  });
}

function rejectForbiddenUserCopy(payload: unknown) {
  const text = JSON.stringify(payload);
  const forbidden = ['لپه', 'split_pea', 'split peas', 'ing_split_peas_dry', 'لیموعمانی', 'لیمو عمانی'];
  const hits = forbidden.filter((term) => text.includes(term));
  if (hits.length) {
    throw new Error(`forbidden_copy_detected:${hits.join(',')}`);
  }
}

async function main() {
  rejectForbiddenUserCopy({ ingredients, steps, gris, searchTerms });
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
    searchKeywordsFa: ['قیمه‌ریزه اصفهانی', 'قیمه ریزه اصفهانی', 'قیمه نخودچی', 'کوفته ریزه اصفهانی'],
    behaviorSignals: {
      ...((oldAdmin.aiContext || {}).behaviorSignals || {}),
      primaryIngredientIds: ['ing_ground_lamb_raw', 'ing_chickpea_flour', 'ing_potato_raw', 'ing_tomato_paste', 'ing_dried_mint'],
    },
  };
  oldAdmin.contentFix = {
    fixedAt: now,
    reason: 'Corrected Qeymeh Rizeh Esfahani to the small ground-meat koofteh version with chickpea flour, mint, tomato sauce, and potato.',
  };

  await prisma.$transaction(async (tx) => {
    await tx.recipe.update({
      where: { id: recipeId },
      data: {
        description: 'قیمه‌ریزه اصفهانی یک خوراک خانگی با کوفته‌های کوچکِ گوشت چرخ‌کرده، آرد نخودچی، نعناع، سس گوجه‌ای و سیب‌زمینی است. راز غذا در آب‌گرفتن پیاز، ورز دادن مایه گوشت و پخت آرام کوفته‌ها در سس است.',
        category: 'main',
        difficulty: 'medium',
        cookingTime: 35,
        prepTime: '25',
        totalTime: '65',
        servings: 4,
        tools: JSON.stringify(['قابلمه متوسط', 'رنده', 'کاسه برای ورز دادن', 'کفگیر', 'چاقو و تخته']),
        tips: JSON.stringify(gris.chefTips),
        faq: JSON.stringify(gris.faq.map(({ q, a }) => ({ question: q, answer: a }))),
        categories: JSON.stringify(['main_course', 'قیمه‌ریزه اصفهانی', 'قیمه نخودچی', 'کوفته ریزه', 'غذای اصفهانی', 'protein_forward']),
        allergens: JSON.stringify([]),
        chefTips: JSON.stringify(gris.chefTips),
        commonMistakes: JSON.stringify(gris.commonMistakes),
        servingSuggestions: JSON.stringify(gris.servingSuggestions),
        substitutions: JSON.stringify(gris.substitutions),
        gris,
        adminNote: JSON.stringify(oldAdmin),
        containsPork: false,
        nutrition: {
          upsert: {
            create: { calories: 420, protein: 25, carbs: 24, fat: 25, fiber: 3 },
            update: { calories: 420, protein: 25, carbs: 24, fat: 25, fiber: 3 },
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
          create: searchTerms.map((term) => ({ term })),
        },
      },
    });
  });

  const after = await prisma.recipe.findUnique({
    where: { id: recipeId },
    include: {
      ingredients: { orderBy: { order: 'asc' } },
      steps: { orderBy: { order: 'asc' } },
      searchTerms: { orderBy: { term: 'asc' } },
    },
  });
  if (!after) throw new Error('recipe_missing_after_update');

  const text = JSON.stringify(after);
  const result = {
    ok: true,
    recipeId,
    title: after.title,
    backupPath,
    ingredientCount: after.ingredients.length,
    stepCount: after.steps.length,
    searchTermCount: after.searchTerms.length,
    hasWrongPulseFa: text.includes('لپه'),
    hasWrongPulseCode: /split_pea|split-pea|split peas/i.test(text),
    hasGroundMeat: text.includes('گوشت چرخ'),
    hasPotato: text.includes('سیب‌زمینی') || text.includes('سیب زمینی'),
    firstIngredients: after.ingredients.slice(0, 6).map((i) => i.name),
    steps: after.steps.map((s) => s.title),
  };
  if (result.hasWrongPulseFa || result.hasWrongPulseCode || !result.hasGroundMeat || !result.hasPotato) {
    throw new Error(`post_update_validation_failed:${JSON.stringify(result)}`);
  }
  console.log(JSON.stringify(result, null, 2));
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
