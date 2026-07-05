import { assertLocalDatabase, getCounts, loadRecipeById, prisma, writeJson, writeMd } from './culinary-authenticity-sprint-common';

const recipeId = 'garnish_recipe_global_143_135_2919e78e';

async function main() {
  assertLocalDatabase();
  const before = await getCounts();
  const recipe = await loadRecipeById(recipeId);
  if (!recipe) throw new Error('carbonara_missing');
  const gris = recipe.gris as any;
  if (!gris || typeof gris !== 'object') throw new Error('carbonara_gris_missing');

  writeJson('carbonara_gris_ingredient_alignment_rollback.json', {
    generatedAt: new Date().toISOString(),
    recipeId,
    title: recipe.title,
    previousGrisIngredients: gris.ingredients ?? null,
  });

  const alignedIngredients = [
    {
      ingredientId: 'ing_spaghetti_dry',
      code: 'spaghetti_dry',
      name: 'اسپاگتی خشک',
      amount: '400',
      unit: 'گرم',
      displayUnit: 'گرم',
      volume: '۴۰۰ گرم',
      component: 'پاستا',
      prepState: 'خشک؛ تا آلدنته پخته شود',
      optional: false,
      role: 'رشتهٔ بلند و باریک است که امولسیون زرده، پکورینو، چربی گوآنچاله و آب پاستا را یکنواخت نگه می‌دارد.',
      buyTip: 'اسپاگتی با سطح کمی زبر و کیفیت خوب بخرید؛ رشته خیلی صاف سس را کم‌تر نگه می‌دارد.',
      swap: 'بوکاتینی یا ریگاتونی قابل قبول‌اند، اما نام و حس این نسخه را تغییر می‌دهند.',
      weightG: null,
    },
    {
      ingredientId: 'ing_guanciale_cured_pork',
      code: 'guanciale_cured_pork',
      name: 'گوآنچاله',
      amount: '180',
      unit: 'گرم',
      displayUnit: 'گرم',
      volume: '۱۸۰ گرم',
      component: 'سس کاربونارا',
      prepState: 'خردشده',
      optional: false,
      role: 'چربی خوکِ خشک‌شده و معطر است؛ چربی آزادشده پایهٔ واقعی کاربونارا را می‌سازد.',
      buyTip: 'گوآنچاله با رگه چربی و گوشت متعادل بخرید؛ برش خیلی خشک، چربی کافی نمی‌دهد.',
      swap: 'پانچتا نزدیک‌تر از بیکن است؛ بیکن دودی مزه را از نسخه رومی دور می‌کند.',
      weightG: null,
    },
    {
      ingredientId: 'ing_egg_yolk_raw',
      code: 'egg_yolk_raw',
      name: 'زرده تخم‌مرغ خام',
      amount: '5',
      unit: 'عدد',
      displayUnit: 'عدد',
      volume: '۵ عدد',
      component: 'سس کاربونارا',
      prepState: 'هم‌دما با محیط',
      optional: false,
      role: 'بدنهٔ سس امولسیونی کاربونارا را می‌سازد؛ دور از حرارت مستقیم، کرمی می‌شود نه املت.',
      buyTip: 'تخم‌مرغ تازه و سالم انتخاب کنید؛ کیفیت زرده در این سس کاملاً دیده می‌شود.',
      swap: 'تخم‌مرغ کامل سس را سبک‌تر اما کم‌غلیظ‌تر می‌کند.',
      weightG: null,
    },
    {
      ingredientId: 'ing_pecorino_romano_cheese',
      code: 'pecorino_romano_cheese',
      name: 'پنیر پکورینو رومانو',
      amount: '90',
      unit: 'گرم',
      displayUnit: 'گرم',
      volume: '۹۰ گرم',
      component: 'سس کاربونارا',
      prepState: 'ریز رنده‌شده',
      optional: false,
      role: 'شوری، تندی لبنی و بافت سس کاربونارا را می‌دهد.',
      buyTip: 'پکورینو را تازه رنده کنید؛ پودر آماده خوب در سس حل نمی‌شود.',
      swap: 'پارمزان ملایم‌تر است و نسخه را از کاربونارای رومی دور می‌کند.',
      weightG: null,
    },
    {
      ingredientId: 'ing_black_pepper_ground',
      code: 'black_pepper_ground',
      name: 'فلفل سیاه آسیاب‌شده',
      amount: '2',
      unit: 'قاشق چای‌خوری',
      displayUnit: 'قاشق چای‌خوری',
      volume: '۲ قاشق چای‌خوری',
      component: 'سس کاربونارا',
      prepState: 'تازه آسیاب‌شده',
      optional: false,
      role: 'گرمی خشک و عطر پایانی می‌دهد و با پکورینو و چربی گوآنچاله تعادل می‌سازد.',
      buyTip: 'فلفل را در لحظه آسیاب کنید؛ عطر آن در غذاهای ساده حیاتی است.',
      swap: 'فلفل سفید تیزتر و کم‌عطرتر است و نسخه را از حس کلاسیک دور می‌کند.',
      weightG: null,
    },
    {
      ingredientId: 'ing_salt_table',
      code: 'salt_table',
      name: 'نمک خوراکی',
      amount: '1',
      unit: 'قاشق غذاخوری',
      displayUnit: 'قاشق غذاخوری',
      volume: '۱ قاشق غذاخوری برای آب پاستا',
      component: 'پاستا',
      prepState: 'برای آب پاستا',
      optional: false,
      role: 'آب پاستا را مزه‌دار می‌کند و به تعادل سس کمک می‌کند؛ نمک اضافه در خود سس باید با پکورینو کنترل شود.',
      buyTip: 'نمک خشک و یکنواخت استفاده کنید و شوری نهایی را با پکورینو تنظیم کنید.',
      swap: 'جایگزین واقعی ندارد.',
      weightG: null,
    },
  ];

  await prisma.$transaction(async (tx) => {
    await tx.recipe.update({
      where: { id: recipeId },
      data: { gris: { ...gris, ingredients: alignedIngredients } },
    });
  });

  const after = await getCounts();
  if (before.totalRecipes !== after.totalRecipes || before.ingredientCount !== after.ingredientCount) {
    throw new Error(`COUNT_DRIFT:${JSON.stringify({ before, after })}`);
  }

  writeMd(
    'carbonara_gris_ingredient_alignment_report.md',
    `# Carbonara GRIS Ingredient Alignment Report

- generatedAt: ${new Date().toISOString()}
- recipeId: ${recipeId}
- title: ${recipe.title}
- changed field: Recipe.gris.ingredients only
- RecipeIngredient rows changed: 0
- Ingredient rows changed: 0
- recipe count: ${before.totalRecipes} -> ${after.totalRecipes}
- ingredient count: ${before.ingredientCount} -> ${after.ingredientCount}
- result: PASS
`,
  );

  console.log(JSON.stringify({ ok: true, recipeId, changed: 'Recipe.gris.ingredients', recipeCount: `${before.totalRecipes}->${after.totalRecipes}`, ingredientCount: `${before.ingredientCount}->${after.ingredientCount}` }, null, 2));
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
