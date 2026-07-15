/**
 * Remove the retired Batch-02 identity-marker corruption from the LOCAL database.
 *
 * Dry-run by default. Pass `--apply` to mutate. The command is deliberately scoped
 * to one reviewed recipe and to rows that carry the old marker provenance.
 */
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');

const ROOT = path.resolve(__dirname, '../../../..');
const CANONICAL_PATH = path.join(
  ROOT,
  'data/recipes/active/recipes.fa.phase-one.200.json',
);
const RECIPE_ID = 'garnish_recipe_fa_77_3adf94d4';
const MARKER_RESOLVER = 'batch02_existing_dictionary_marker_patch';
const RETIRED_MARKERS = [
  {
    ingredientId: 'ing_lamb_meat_raw',
    code: 'lamb_meat_raw',
    label: 'گوشت گوسفندی',
    note: 'پایه گوشتی و کشدار آش سبزی شیرازی',
  },
  {
    ingredientId: 'ing_basmati_rice_raw',
    code: 'basmati_rice_raw',
    label: 'برنج نیم‌دانه',
    note: 'لعاب و بافت کشدار آش سبزی شیرازی',
  },
  {
    ingredientId: 'ing_tarragon_fresh',
    code: 'tarragon_fresh',
    label: 'ترخون تازه',
    note: 'عطر مرکزی سبزی شیرازی',
  },
];

// The old patch flattened this reviewed structured array through `textValues`
// before appending its marker sentences. Restore the exact pre-corruption shape.
const PRISTINE_WHY_IT_WORKS = [
  {
    point: 'حبوبات را اول و جدا می‌پزیم تا درسته بمانند',
    explanation:
      'نشاستهٔ لپه و نخود در حدود ۶۰ تا ۸۰ درجه ژلاتینه می‌شود و دانه را نرم می‌کند؛ اگر زیر جوشِ ملایم بپزند فقط نرم می‌شوند، اما جوشِ تند و هم‌زدنِ زیاد دیوارهٔ سلولی را می‌شکند و آش را خمیری می‌کند. پختِ جداگانه به ما اجازه می‌دهد نقطهٔ «نرم اما درسته» را دقیق بگیریم.',
    testedBecause: 'McGee — ژلاتیناسیون نشاسته',
  },
  {
    point: 'سبزی را دیر و کوتاه می‌پزیم تا سبز و معطر بماند',
    explanation:
      'کلروفیلِ سبزی در حرارتِ طولانی و اسید به فئوفیتینِ زیتونی‌رنگ تبدیل می‌شود و رنگ کدر و بوی علفی می‌گیرد. افزودنِ سبزی در اواخر کار و پختِ کوتاه، هم رنگِ سبزِ روشن و هم ترکیبات معطرِ فرّارش را حفظ می‌کند.',
    testedBecause: 'McGee — تخریب کلروفیل',
  },
  {
    point: 'زردچوبه را در روغنِ داغ باز می‌کنیم، نه در آب',
    explanation:
      'رنگ‌دانه و عطرِ زردچوبه (کورکومین) چربی‌دوست است؛ وقتی در روغنِ گرم تفت داده شود رنگ و طعمش آزاد و در کلِ آش پخش می‌شود، در حالی که ریختنِ مستقیمش در آب طعمِ خام و خاکی باقی می‌گذارد.',
    testedBecause: 'López-Alt — حل‌شدنِ طعم در چربی',
  },
  {
    point: 'پیازداغ را جدا و تا طلاییِ واقعی سرخ می‌کنیم',
    explanation:
      'قندهای پیاز در حدود ۱۶۰ درجه کاراملیزه و پروتئین و قندها با هم واکنشِ مایار (از حدود ۱۴۰ درجه به بالا) می‌دهند؛ همین برشتگی است که آن عمقِ شیرین-برشته را می‌سازد. سرخ‌کردنِ جداگانه می‌گذارد روغن واقعاً داغ بماند و پیاز به‌جای بخارپزشدن، رنگ بگیرد.',
    testedBecause: 'ATK — کاراملیزاسیون و مایار',
  },
  {
    point: 'گشنیزِ تازه را همان آخر اضافه می‌کنیم',
    explanation:
      'عطرِ گشنیز از روغن‌های فرّارش می‌آید که با حرارت به‌سرعت تبخیر می‌شوند؛ ریختنش درست پیش از سرو، تازگیِ آن رایحهٔ مرکباتی-سبز را زنده نگه می‌دارد.',
    testedBecause: 'McGee — ترکیبات معطر فرّار',
  },
];

const RETIRED_IDS = new Set(
  RETIRED_MARKERS.map((marker) => marker.ingredientId),
);
const RETIRED_TERMS = new Set(
  RETIRED_MARKERS.flatMap((marker) => [marker.code, marker.label]),
);

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function stable(value) {
  return JSON.stringify(value);
}

function stringArray(value) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function markerIngredientIds(value) {
  return Array.isArray(value)
    ? value.map(String).filter((id) => RETIRED_IDS.has(id))
    : [];
}

function cleanAshGris(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const next = clone(value);

  if (Array.isArray(next.ingredients)) {
    next.ingredients = next.ingredients.filter(
      (ingredient) => !RETIRED_IDS.has(String(ingredient?.ingredientId || '')),
    );
  }
  if (Array.isArray(next.steps)) {
    next.steps = next.steps.filter(
      (step) => markerIngredientIds(step?.usesIngredientIds).length === 0,
    );
  }
  if (typeof next.whyItWorks === 'string') {
    next.whyItWorks = clone(PRISTINE_WHY_IT_WORKS);
  }

  next.dietary = {
    ...(next.dietary &&
    typeof next.dietary === 'object' &&
    !Array.isArray(next.dietary)
      ? next.dietary
      : {}),
    vegan: false,
    vegetarian: true,
  };
  return next;
}

function parsedNotes(value) {
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function isRetiredFlatStep(step) {
  const haystack = `${step?.title || ''} ${step?.instruction || ''}`;
  return RETIRED_MARKERS.some((marker) => haystack.includes(marker.label));
}

function loadCanonicalRecipe() {
  const recipes = JSON.parse(fs.readFileSync(CANONICAL_PATH, 'utf8'));
  const recipe = recipes.find((row) => row.recipeId === RECIPE_ID);
  if (!recipe) throw new Error(`Canonical recipe missing: ${RECIPE_ID}`);
  const canonicalIds = new Set(
    (recipe.ingredients || []).map((ingredient) =>
      String(ingredient.ingredientId),
    ),
  );
  const retiredCanonicalIds = [...RETIRED_IDS].filter((id) =>
    canonicalIds.has(id),
  );
  if (retiredCanonicalIds.length) {
    throw new Error(
      `Canonical recipe unexpectedly contains retired markers: ${retiredCanonicalIds.join(', ')}`,
    );
  }
  if (
    !Array.isArray(recipe.dietFlags) ||
    !recipe.dietFlags.includes('vegetarian')
  ) {
    throw new Error(
      'Canonical Ash-e Sabzi is not classified vegetarian; refusing reconciliation.',
    );
  }
  return recipe;
}

function buildPlan(row, canonical) {
  if (!row) throw new Error(`Live recipe missing: ${RECIPE_ID}`);

  const suspiciousIngredients = row.ingredients.filter((ingredient) => {
    if (!RETIRED_IDS.has(String(ingredient.ingredientId || ''))) return false;
    return parsedNotes(ingredient.notes).resolverNote !== MARKER_RESOLVER;
  });
  if (suspiciousIngredients.length) {
    throw new Error(
      `Retired ingredient exists without reviewed marker provenance: ${suspiciousIngredients.map((row) => row.id).join(', ')}`,
    );
  }

  const ingredientIds = row.ingredients
    .filter((ingredient) =>
      RETIRED_IDS.has(String(ingredient.ingredientId || '')),
    )
    .filter(
      (ingredient) =>
        parsedNotes(ingredient.notes).resolverNote === MARKER_RESOLVER,
    )
    .map((ingredient) => ingredient.id);
  const stepIds = row.steps.filter(isRetiredFlatStep).map((step) => step.id);
  const searchTermIds = row.searchTerms
    .filter((term) => RETIRED_TERMS.has(String(term.term)))
    .map((term) => term.id);

  const categories = stringArray(row.categories).filter(
    (value) => !['vegan', 'vegetarian'].includes(value),
  );
  for (const flag of canonical.dietFlags.map(String))
    if (!categories.includes(flag)) categories.push(flag);
  const nextRecipe = {
    diet: 'vegetarian',
    categories: JSON.stringify(categories),
    gris: cleanAshGris(row.gris),
  };
  const recipeChanged =
    row.diet !== nextRecipe.diet ||
    row.categories !== nextRecipe.categories ||
    stable(row.gris) !== stable(nextRecipe.gris);

  return {
    ingredientIds,
    stepIds,
    searchTermIds,
    nextRecipe,
    recipeChanged,
    changeCount:
      ingredientIds.length +
      stepIds.length +
      searchTermIds.length +
      Number(recipeChanged),
  };
}

function assertClean(row) {
  const failures = [];
  const categories = stringArray(row.categories);
  const grisBlob = stable(row.gris);
  if (row.diet !== 'vegetarian') failures.push(`diet=${row.diet}`);
  if (!categories.includes('vegetarian'))
    failures.push('categories missing vegetarian');
  if (
    row.ingredients.some((ingredient) =>
      RETIRED_IDS.has(String(ingredient.ingredientId || '')),
    )
  )
    failures.push('retired flat ingredient remains');
  if (row.steps.some(isRetiredFlatStep))
    failures.push('retired flat step remains');
  if (row.searchTerms.some((term) => RETIRED_TERMS.has(String(term.term))))
    failures.push('retired search term remains');
  if ([...RETIRED_IDS].some((id) => grisBlob.includes(id)))
    failures.push('retired GRIS artifact remains');
  if (
    row.gris?.dietary?.vegetarian !== true ||
    row.gris?.dietary?.vegan !== false
  )
    failures.push('GRIS dietary flags not restored');
  if (failures.length)
    throw new Error(`Postcondition failed: ${failures.join('; ')}`);
}

function localDatabaseGuard() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  const parsed = new URL(url);
  const db = parsed.pathname.replace(/^\//, '');
  if (
    !['localhost', '127.0.0.1', '::1'].includes(parsed.hostname) ||
    db !== 'garnish_db'
  ) {
    throw new Error('SAFETY STOP: expected local garnish_db');
  }
}

const include = {
  ingredients: { orderBy: { order: 'asc' } },
  steps: { orderBy: { order: 'asc' } },
  searchTerms: true,
};

async function main() {
  localDatabaseGuard();
  const apply = process.argv.includes('--apply');
  const canonical = loadCanonicalRecipe();
  const prisma = new PrismaClient();
  try {
    const before = await prisma.recipe.findUnique({
      where: { id: RECIPE_ID },
      include,
    });
    const plan = buildPlan(before, canonical);
    console.log(
      JSON.stringify(
        {
          mode: apply ? 'apply' : 'dry-run',
          recipeId: RECIPE_ID,
          changeCount: plan.changeCount,
          deleteIngredientRows: plan.ingredientIds.length,
          deleteStepRows: plan.stepIds.length,
          deleteSearchTerms: plan.searchTermIds.length,
          updateRecipe: plan.recipeChanged,
        },
        null,
        2,
      ),
    );

    if (!apply || plan.changeCount === 0) {
      if (plan.changeCount === 0) assertClean(before);
      return;
    }

    await prisma.$transaction(
      async (tx) => {
        if (plan.ingredientIds.length)
          await tx.recipeIngredient.deleteMany({
            where: { id: { in: plan.ingredientIds } },
          });
        if (plan.stepIds.length)
          await tx.recipeStep.deleteMany({
            where: { id: { in: plan.stepIds } },
          });
        if (plan.searchTermIds.length)
          await tx.searchTerm.deleteMany({
            where: { id: { in: plan.searchTermIds } },
          });
        if (plan.recipeChanged)
          await tx.recipe.update({
            where: { id: RECIPE_ID },
            data: plan.nextRecipe,
          });
        const after = await tx.recipe.findUnique({
          where: { id: RECIPE_ID },
          include,
        });
        assertClean(after);
      },
      { isolationLevel: 'Serializable' },
    );

    console.log(
      `[apply] restored ${RECIPE_ID}; ${plan.changeCount} reviewed changes.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = {
  RECIPE_ID,
  RETIRED_MARKERS,
  PRISTINE_WHY_IT_WORKS,
  cleanAshGris,
  buildPlan,
  assertClean,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error?.message || error);
    process.exitCode = 1;
  });
}
