import fs from 'node:fs';
import path from 'node:path';
import {
  assertLocalDatabase,
  getCounts,
  parseJson,
  prisma,
  sprintDir,
  writeJson,
  writeMd,
} from './culinary-authenticity-sprint-common';

type RecipeWithSteps = Awaited<ReturnType<typeof loadRepairScope>>[number];

const exactReplacements: Array<[string, string]> = [
  [
    'مواد را طبق مقدارهای نوشته‌شده آماده کن و کنار دستت بگذار.',
    'مواد را اندازه‌گیری کنید، کیفیتشان را بررسی کنید و آمادهٔ استفاده نگه دارید.',
  ],
  [
    'مواد را طبق ترتیب دستور مخلوط کنید؛ هر جا بافت شکل گرفت، بیش از اندازه هم نزنید.',
    'مواد را به همان ترتیب وارد کاسه کنید؛ وقتی بافت شکل گرفت، هم‌زدن را متوقف کنید.',
  ],
  ['مواد را طبق ترتیب دستور مخلوط کنید', 'مواد را به همان ترتیب وارد کاسه کنید'],
  ['برنج و مواد را آماده کنید', 'آماده‌سازی برنج و پایهٔ پلوف'],
  [
    'این توضیح عمومی است و با مقدار سرو و مواد تغییر می‌کند.',
    'مقدار انرژی و سیری با اندازهٔ سرو و نسبت مواد تغییر می‌کند.',
  ],
  ['شخصیت غذا', 'هویت طعمی غذا'],
  ['همان شخصیت', 'همان عمق و بافت'],
];

const generatedSignalPatterns = [
  /\s*نشانهٔ درست این مرحله باید با\s*ظاهر، عطر و بافت همین مرحله دیده شود\./g,
  /\s*نشانهٔ درست این مرحله باید باظاهر، عطر و بافت همین مرحله دیده شود\./g,
  /\s*اگر رنگ، کف یا عطر ناگهان تغییر کرد، مرحله را متوقف کن و نسبت دما\/زمان را دوباره بررسی کن\./g,
];

function cleanText(value: string) {
  let next = value;
  for (const pattern of generatedSignalPatterns) next = next.replace(pattern, '');
  for (const [from, to] of exactReplacements) next = next.split(from).join(to);
  next = next
    .replace(/\s+([.،؛])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return next;
}

function cleanDeep(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === 'string') return cleanText(value);
  if (Array.isArray(value)) return value.map((item) => cleanDeep(item));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, cleanDeep(child)]),
    );
  }
  return value;
}

function changed(a: unknown, b: unknown) {
  return JSON.stringify(a) !== JSON.stringify(b);
}

async function loadRepairScope() {
  return prisma.recipe.findMany({
    where: { OR: [{ status: 'active', isPublic: true }, { id: { startsWith: 'meze50_' } }] },
    include: { steps: { orderBy: { order: 'asc' } } },
    orderBy: { title: 'asc' },
  });
}

function buildRecipePatch(recipe: RecipeWithSteps) {
  const recipePatch: Record<string, unknown> = {};
  const rollbackRecipe: Record<string, unknown> = {};

  const scalarFields = ['description', 'tips', 'faq', 'chefTips', 'commonMistakes', 'servingSuggestions', 'substitutions'] as const;
  for (const field of scalarFields) {
    const original = recipe[field];
    if (typeof original !== 'string') continue;
    const parsed = ['tips', 'faq', 'chefTips', 'commonMistakes', 'servingSuggestions', 'substitutions'].includes(field)
      ? parseJson(original, original)
      : original;
    const cleaned = cleanDeep(parsed);
    if (changed(parsed, cleaned)) {
      rollbackRecipe[field] = original;
      recipePatch[field] = typeof cleaned === 'string' ? cleaned : JSON.stringify(cleaned);
    }
  }

  const cleanedGris = cleanDeep(recipe.gris);
  if (changed(recipe.gris, cleanedGris)) {
    rollbackRecipe.gris = recipe.gris;
    recipePatch.gris = cleanedGris;
  }

  const stepPatches = recipe.steps
    .map((step) => {
      const nextTitle = step.title == null ? step.title : cleanText(step.title);
      const nextInstruction = cleanText(step.instruction);
      const data: Record<string, string | null> = {};
      const rollback: Record<string, string | null> = {};
      if (nextTitle !== step.title) {
        data.title = nextTitle;
        rollback.title = step.title;
      }
      if (nextInstruction !== step.instruction) {
        data.instruction = nextInstruction;
        rollback.instruction = step.instruction;
      }
      return Object.keys(data).length ? { id: step.id, order: step.order, data, rollback } : null;
    })
    .filter(Boolean) as Array<{ id: string; order: number; data: Record<string, string | null>; rollback: Record<string, string | null> }>;

  return { recipePatch, rollbackRecipe, stepPatches };
}

async function main() {
  assertLocalDatabase();
  const auditPath = path.join(sprintDir, 'ai_copy_residue_audit_v1.json');
  const audit = fs.existsSync(auditPath) ? JSON.parse(fs.readFileSync(auditPath, 'utf8')) : { rows: [] };
  const criticalHigh = audit.rows.filter((r: any) =>
    ['CRITICAL_USER_VISIBLE_AI_RESIDUE', 'HIGH_REPEATED_TEMPLATE'].includes(r.classification),
  );

  const beforeCounts = await getCounts();
  const recipes = await loadRepairScope();
  const plans = recipes
    .map((recipe) => ({ recipe, ...buildRecipePatch(recipe) }))
    .filter((plan) => Object.keys(plan.recipePatch).length || plan.stepPatches.length);

  const rollback = plans.map((plan) => ({
    recipeId: plan.recipe.id,
    title: plan.recipe.title,
    recipeFields: plan.rollbackRecipe,
    steps: plan.stepPatches.map((step) => ({ id: step.id, order: step.order, ...step.rollback })),
  }));
  writeJson('ai_copy_residue_rollback.json', rollback);

  await prisma.$transaction(async (tx) => {
    for (const plan of plans) {
      if (Object.keys(plan.recipePatch).length) {
        await tx.recipe.update({ where: { id: plan.recipe.id }, data: plan.recipePatch as any });
      }
      for (const step of plan.stepPatches) {
        await tx.recipeStep.update({ where: { id: step.id }, data: step.data });
      }
    }
  });

  const afterCounts = await getCounts();
  const countStable =
    beforeCounts.totalRecipes === afterCounts.totalRecipes &&
    beforeCounts.activePublic === afterCounts.activePublic &&
    beforeCounts.ingredientCount === afterCounts.ingredientCount;
  if (!countStable) {
    throw new Error(`COUNT_DRIFT:${JSON.stringify({ beforeCounts, afterCounts })}`);
  }

  const recipeFieldUpdates = plans.filter((plan) => Object.keys(plan.recipePatch).length).length;
  const stepUpdates = plans.reduce((sum, plan) => sum + plan.stepPatches.length, 0);
  writeMd(
    'ai_copy_residue_repair_report.md',
    `# AI Copy Residue Repair Report

- generatedAt: ${new Date().toISOString()}
- CRITICAL/HIGH findings before repair: ${criticalHigh.length}
- recipes patched: ${plans.length}
- Recipe rows updated: ${recipeFieldUpdates}
- RecipeStep rows updated: ${stepUpdates}
- recipe count: ${beforeCounts.totalRecipes} -> ${afterCounts.totalRecipes}
- active public count: ${beforeCounts.activePublic} -> ${afterCounts.activePublic}
- ingredient count: ${beforeCounts.ingredientCount} -> ${afterCounts.ingredientCount}
- scope: active/public recipes plus Meze 50 draft/private rows
- changed fields: Recipe display text/json fields and RecipeStep title/instruction only
- ingredients changed: 0
- verdict: ${countStable ? 'PASS - residue phrases mechanically cleaned' : 'FAIL - count drift'}
`,
  );

  console.log(JSON.stringify({ ok: true, beforeFindings: criticalHigh.length, recipesPatched: plans.length, recipeFieldUpdates, stepUpdates }, null, 2));
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
