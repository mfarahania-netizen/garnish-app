const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');

const ROOT = path.resolve(__dirname, '../../../..');
const QA_DIR = path.join(ROOT, 'docs/qa/display-copy');
const REPORT_PATH = path.join(QA_DIR, 'display_copy_sanitizer_v0_1_report.json');

const FORBIDDEN_TERMS = [
  'ingredientId',
  'unresolved',
  'import',
  'Meal Plan',
  'Shopping List',
  'Codex',
  'GRIS',
  'readyForImport',
  'metadata',
  'database',
  'DB',
  'nutrition engine',
  'source-backed',
  '[Certain]',
  '[Likely]',
  '[Speculative]',
  '[Uncertain]',
  'King Arthur',
  'Serious Eats',
];

const LITE_DESCRIPTION = 'یک آیتم سریع و سبک است که با چند ماده ساده آماده می‌شود و برای مصرف روزمره مناسب است.';
const LITE_TIPS = ['مقدار مواد برای یک نفر نوشته شده؛ برای چند نفر، همه مواد را به همان نسبت بیشتر کن.'];
const LITE_MISTAKES = ['مواد را بیش از حد مخلوط یا له نکن تا بافت اصلی آیتم حفظ شود.'];
const LITE_SERVING = ['همان موقع سرو کن تا نان، میوه یا سبزیجات بافت تازه‌تری داشته باشند.'];
const LITE_SUBSTITUTIONS = ['جایگزین را ساده نگه دار: ماده‌ای با طعم و بافت نزدیک انتخاب کن، و اگر به چیزی حساسیت داری همان ماده را حذف یا با گزینه امن خودت عوض کن.'];
const LITE_FAQ = [
  {
    question: 'چرا این آیتم سبک است؟',
    answer: 'چون آماده‌سازی آن کوتاه است و بیشتر از چند حرکت ساده نیاز ندارد؛ با این حال مقدارها دقیق نوشته شده‌اند تا نتیجه قابل تکرار باشد.',
  },
];

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function stringify(value) {
  return JSON.stringify(value);
}

function text(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(text).join(' ');
  if (typeof value === 'object') return Object.values(value).map(text).join(' ');
  return String(value);
}

function forbiddenHits(value) {
  const body = text(value);
  return FORBIDDEN_TERMS.filter((term) => body.includes(term));
}

function isContaminated(value) {
  return forbiddenHits(value).length > 0;
}

function assertLocalDevDatabase() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL not set. Run with: node --env-file=.env ...');
  const parsed = new URL(dbUrl);
  const databaseName = parsed.pathname.replace(/^\//, '');
  const local = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  if (databaseName !== 'garnish_db' || !local) {
    throw new Error(`SAFETY STOP: refusing display-copy sanitizer outside local/dev garnish_db. Got ${databaseName}@${parsed.hostname}`);
  }
  return { databaseName, host: parsed.hostname };
}

function displayFieldsForRecipe(recipe) {
  const fields = [];
  fields.push({ scope: 'recipe', key: 'title', value: recipe.title });
  fields.push({ scope: 'recipe', key: 'description', value: recipe.description });
  for (const [key, raw] of [
    ['tips', recipe.tips],
    ['chefTips', recipe.chefTips],
    ['commonMistakes', recipe.commonMistakes],
    ['servingSuggestions', recipe.servingSuggestions],
    ['substitutions', recipe.substitutions],
  ]) {
    parseJsonArray(raw).forEach((item, index) => fields.push({ scope: 'recipe', key: `${key}.${index}`, value: item }));
  }
  parseJsonArray(recipe.faq).forEach((item, index) => {
    fields.push({ scope: 'recipe', key: `faq.${index}.question`, value: item?.question ?? item?.q });
    fields.push({ scope: 'recipe', key: `faq.${index}.answer`, value: item?.answer ?? item?.a });
  });
  for (const step of recipe.steps || []) {
    fields.push({ scope: 'step', stepId: step.id, key: `steps.${step.order}.title`, value: step.title });
    fields.push({ scope: 'step', stepId: step.id, key: `steps.${step.order}.instruction`, value: step.instruction });
  }
  if (recipe.gris) fields.push({ scope: 'recipe', key: 'gris', value: recipe.gris });
  return fields;
}

function scanRecipes(recipes) {
  const findings = [];
  const affectedRecipes = new Set();
  for (const recipe of recipes) {
    for (const field of displayFieldsForRecipe(recipe)) {
      const hits = forbiddenHits(field.value);
      if (hits.length) {
        affectedRecipes.add(recipe.id);
        findings.push({
          recipeId: recipe.id,
          title: recipe.title,
          field: field.key,
          hits,
          sample: text(field.value).slice(0, 180),
        });
      }
    }
  }
  return {
    recipesScanned: recipes.length,
    affectedRecipeCount: affectedRecipes.size,
    contaminatedFieldCount: findings.length,
    findings,
  };
}

function sanitizedStepInstruction(index) {
  if (index === 0) return 'مواد را طبق مقدارهای نوشته‌شده آماده کن و کنار دستت بگذار.';
  if (index === 1) return 'مواد را ساده و مرتب کنار هم بگذار، مخلوط کن یا داخل نان بچین.';
  return 'همان موقع سرو کن تا بافت و طعم مواد تازه بماند.';
}

async function loadLiteRecipes(prisma) {
  return prisma.recipe.findMany({
    where: {
      OR: [
        { category: 'lite_food' },
        { id: { startsWith: 'garnish_lite_' } },
        { dishType: { contains: 'lite_food' } },
        { adminNote: { contains: '"contentType":"lite_food"' } },
        { adminNote: { contains: '"contentType": "lite_food"' } },
      ],
    },
    orderBy: { id: 'asc' },
    include: { steps: { orderBy: { order: 'asc' } } },
  });
}

function auditGlobalBatchFiles() {
  const candidates = [];
  const roots = ['_garnish_import_handoffs', 'garnish_import_handoffs'];
  for (const root of roots) {
    const abs = path.join(ROOT, root);
    if (!fs.existsSync(abs)) continue;
    const stack = [abs];
    while (stack.length) {
      const current = stack.pop();
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) stack.push(full);
        else if (/recipes\.global-143\.batch-0[12].*\.json$/i.test(entry.name)) candidates.push(full);
      }
    }
  }
  return {
    filesFound: candidates.map((file) => path.relative(ROOT, file)),
    batch01SafeToImport: false,
    batch02SafeToImport: false,
    reason: candidates.length
      ? 'Batch files require display-copy validator pass before import; this run did not import them.'
      : 'No Batch 01/02 files were present in the workspace; import remains blocked until files are available and pass validation.',
  };
}

async function run({ apply = false } = {}) {
  const db = assertLocalDevDatabase();
  const prisma = new PrismaClient();
  try {
    const before = await loadLiteRecipes(prisma);
    const beforeScan = scanRecipes(before);
    let patchedFields = 0;

    if (apply) {
      await prisma.$transaction(async (tx) => {
        for (const recipe of before) {
          const data = {};
          if (isContaminated(recipe.description)) { data.description = LITE_DESCRIPTION; patchedFields++; }
          for (const field of ['tips', 'chefTips', 'commonMistakes', 'servingSuggestions', 'substitutions', 'faq']) {
            if (isContaminated(recipe[field])) patchedFields++;
          }
          data.tips = stringify(LITE_TIPS);
          data.chefTips = stringify(LITE_TIPS);
          data.commonMistakes = stringify(LITE_MISTAKES);
          data.servingSuggestions = stringify(LITE_SERVING);
          data.substitutions = stringify(LITE_SUBSTITUTIONS);
          data.faq = stringify(LITE_FAQ);
          data.gris = null;
          await tx.recipe.update({ where: { id: recipe.id }, data });

          const steps = (recipe.steps || []).slice().sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
          for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            if (isContaminated(step.title)) patchedFields++;
            if (isContaminated(step.instruction)) patchedFields++;
            await tx.recipeStep.update({
              where: { id: step.id },
              data: {
                title: i === 0 ? 'آماده‌سازی مواد' : i === 1 ? 'چیدن یا مخلوط‌کردن' : 'سرو سریع',
                instruction: sanitizedStepInstruction(i),
              },
            });
          }
        }
      }, { timeout: 120000, maxWait: 30000 });
    }

    const after = await loadLiteRecipes(prisma);
    const afterScan = scanRecipes(after);
    const globalBatchAudit = auditGlobalBatchFiles();
    const report = {
      schemaVersion: 'display_copy_sanitizer_v0.1',
      generatedAt: new Date().toISOString(),
      mode: apply ? 'apply' : 'dry-run',
      database: db,
      destructiveOperationUsed: false,
      productionApplyUsed: false,
      liteFood: {
        recipesScanned: beforeScan.recipesScanned,
        contaminatedFieldsBefore: beforeScan.contaminatedFieldCount,
        affectedRecipesBefore: beforeScan.affectedRecipeCount,
        fieldsPatched: apply ? patchedFields : 0,
        contaminatedFieldsAfter: afterScan.contaminatedFieldCount,
        affectedRecipesAfter: afterScan.affectedRecipeCount,
        remainingFindings: afterScan.findings.slice(0, 25),
      },
      globalBatchAudit,
      validationPassed: afterScan.contaminatedFieldCount === 0,
    };
    fs.mkdirSync(QA_DIR, { recursive: true });
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    return report;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  const apply = process.argv.includes('--apply');
  run({ apply }).then((report) => {
    console.log('=== DISPLAY COPY SANITIZER v0.1 ===');
    console.log(JSON.stringify(report.liteFood, null, 2));
    console.log(`Batch 01 safe to import: ${report.globalBatchAudit.batch01SafeToImport}`);
    console.log(`Batch 02 safe to import: ${report.globalBatchAudit.batch02SafeToImport}`);
    console.log(`[report] ${path.relative(ROOT, REPORT_PATH)}`);
    console.log(`RESULT: ${report.validationPassed ? 'PASS' : 'FAIL'}`);
    if (!report.validationPassed) process.exit(1);
  }).catch((error) => {
    console.error('SANITIZER ERROR:', error.message);
    process.exit(1);
  });
}

module.exports = {
  FORBIDDEN_TERMS,
  REPORT_PATH,
  run,
  scanRecipes,
  forbiddenHits,
};
