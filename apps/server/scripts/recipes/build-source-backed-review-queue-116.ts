import fs from 'node:fs';
import path from 'node:path';
import { parseJson, prisma, sprintDir } from './culinary-authenticity-sprint-common';

const sourceSprintDir = path.resolve(process.cwd(), '..', '..', 'docs', 'qa', 'recipes', 'source-backed-authenticity-116');
const authAuditPath = path.join(sprintDir, 'authenticity_audit_with_rulebook_v1.json');

type QueueRow = {
  recipeId: string;
  slug: string;
  titleFa: string;
  titleEn: string;
  country: string;
  cityRegion: string;
  sourceGroup: string;
  dishType: string;
  culinaryClass: string;
  ingredientCount: number;
  stepCount: number;
  grisCompleteness: string;
  notRuledReason: string;
  priority: 'P0_CANONICAL_HIGH_RISK' | 'P1_FAMOUS_REGIONAL' | 'P2_NORMAL_COOKED' | 'P3_SIMPLE_OR_NON_COOKING';
  recommendedAction:
    | 'SOURCE_REVIEW_REQUIRED'
    | 'LOW_RISK_RULE_ONLY'
    | 'METADATA_RULE_ONLY'
    | 'LIKELY_FIX_REQUIRED'
    | 'HUMAN_DECISION_REQUIRED';
};

const canonicalHighRiskTitles = new Set([
  'آش رشته',
  'خورشت قرمه‌سبزی',
  'خورشت فسنجان',
  'دیزی (آبگوشت)',
  'چلو کباب کوبیده',
  'کوفته تبریزی',
  'باقلاقاتُق',
  'بریانی اصفهان',
  'زرشک پلو با مرغ',
  'ته چین مرغ',
  'تیرامیسو',
  'پایلا',
  'تورتیای اسپانیایی',
  'بیف استروگانف',
  'سوپ پیاز فرانسوی',
  'بادمجان پارمیجانا',
  'پاستا آلا نورما',
  'پاستا آلا آرابیاتا',
  'بیستکا آلا فیورنتینا',
]);

const famousRegionalNeedSource = [
  /شیرازی/,
  /کرمانی/,
  /اصفهان/,
  /تبریزی/,
  /گیلانی/,
  /مازندرانی/,
  /مشهدی/,
  /بناب/,
  /لرستانی/,
  /تهرانی/,
  /قم/,
  /قنبید/,
  /بزقرمه/,
  /قیمه نثار/,
  /قنبرپلو/,
  /شله/,
  /شامی/,
  /کباب/,
  /آش/,
  /خورش/,
  /پلو/,
  /کوفته/,
];

const nonCookingOrSimple = [
  /خمیر/,
  /تبوله/,
  /فتوش|فته/,
  /پانا کوتا/,
  /کرم بروله/,
  /تارتا/,
  /باقلوا/,
  /پروفیترول/,
  /پودینگ/,
  /اشترودل سیب/,
];

function ensureDir() {
  fs.mkdirSync(sourceSprintDir, { recursive: true });
}

function writeJson(name: string, value: unknown) {
  ensureDir();
  fs.writeFileSync(path.join(sourceSprintDir, name), JSON.stringify(value, null, 2), 'utf8');
}

function writeMd(name: string, value: string) {
  ensureDir();
  fs.writeFileSync(path.join(sourceSprintDir, name), value, 'utf8');
}

function writeCsv(name: string, rows: Record<string, unknown>[]) {
  ensureDir();
  const headers = Object.keys(rows[0] ?? { empty: '' });
  const cell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const body = [headers.map(cell).join(',')]
    .concat(rows.map((row) => headers.map((header) => cell(row[header])).join(',')))
    .join('\n');
  fs.writeFileSync(path.join(sourceSprintDir, name), `${body}\n`, 'utf8');
}

function admin(recipe: any) {
  return parseJson(recipe.adminNote, {}) ?? {};
}

function slug(recipe: any) {
  return admin(recipe).slug ?? recipe.id;
}

function sourceGroup(recipe: any) {
  return admin(recipe).source ?? 'unknown';
}

function jsonArray(value: unknown): string[] {
  const parsed = parseJson(value, []);
  return Array.isArray(parsed) ? parsed.map(String) : [];
}

function titleEnFromSlug(value: string) {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function localeFromRecipe(recipe: any) {
  const terms = [
    ...jsonArray(recipe.categories),
    ...recipe.searchTerms.map((s: any) => s.term),
    recipe.title,
    recipe.region,
  ].filter(Boolean);
  const joined = terms.join(' ');
  const locales = [
    'ایران',
    'تهران',
    'اصفهان',
    'شیراز',
    'کرمان',
    'تبریز',
    'گیلان',
    'مازندران',
    'مشهد',
    'قم',
    'بناب',
    'لرستان',
    'ترکیه',
    'ایتالیا',
    'اسپانیا',
    'فرانسه',
    'یونان',
    'روسیه',
    'هلند',
    'لهستان',
    'سوئد',
    'آلمان',
    'انگلیس',
    'پرتغال',
    'مجارستان',
    'مکزیک',
  ];
  const found = locales.filter((loc) => joined.includes(loc));
  if (recipe.region === 'persian' || found.includes('ایران')) {
    return { country: 'ایران', cityRegion: found.filter((x) => x !== 'ایران').join(' / ') || '' };
  }
  return { country: found[0] ?? recipe.region ?? 'unknown', cityRegion: found.slice(1).join(' / ') };
}

function culinaryClass(recipe: any) {
  const blob = [recipe.title, recipe.category, recipe.region, recipe.mealType, recipe.dishType, recipe.categories].join(' ');
  if (/نوشیدنی|drink|juice|smoothie|tea|coffee/i.test(blob)) return 'drink';
  if (/dessert|دسر|شیرینی|کیک|تارت|باقلوا|پانا کوتا|تیرامیسو|اشترودل سیب|کرم بروله|پودینگ|پاستل د ناتا|پروفیترول/.test(blob)) return 'dessert';
  if (/salad|سالاد|تبوله|فتوش|دیپ|مزه|snack|side/i.test(blob)) return 'snack_or_non_cooking';
  if (/خمیر/.test(blob)) return 'non_cooking_component';
  return 'cooked';
}

function grisCompleteness(recipe: any) {
  const required = ['story', 'glance', 'ingredients', 'steps', 'whyItWorks', 'troubleshooting', 'serveWith', 'finish', 'faq'];
  const keys = recipe.gris && typeof recipe.gris === 'object' ? Object.keys(recipe.gris) : [];
  const missing = required.filter((key) => !keys.includes(key));
  return missing.length ? `missing:${missing.join('|')}` : 'complete';
}

function priorityAndAction(recipe: any): Pick<QueueRow, 'priority' | 'recommendedAction'> {
  const cls: string = culinaryClass(recipe);
  if (canonicalHighRiskTitles.has(recipe.title)) {
    return { priority: 'P0_CANONICAL_HIGH_RISK', recommendedAction: 'SOURCE_REVIEW_REQUIRED' };
  }
  if (famousRegionalNeedSource.some((pattern) => pattern.test(recipe.title))) {
    return { priority: 'P1_FAMOUS_REGIONAL', recommendedAction: 'SOURCE_REVIEW_REQUIRED' };
  }
  if (cls === 'cooked') return { priority: 'P2_NORMAL_COOKED', recommendedAction: 'SOURCE_REVIEW_REQUIRED' };
  if (nonCookingOrSimple.some((pattern) => pattern.test(recipe.title)) || cls !== 'cooked') {
    return { priority: 'P3_SIMPLE_OR_NON_COOKING', recommendedAction: 'LOW_RISK_RULE_ONLY' };
  }
  return { priority: 'P2_NORMAL_COOKED', recommendedAction: 'SOURCE_REVIEW_REQUIRED' };
}

function countBy<T extends Record<string, any>>(rows: T[], key: keyof T) {
  return rows.reduce((acc: Record<string, number>, row) => {
    const value = String(row[key] ?? 'unknown');
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

async function main() {
  const audit = JSON.parse(fs.readFileSync(authAuditPath, 'utf8'));
  const notRuled = audit.rows.filter((row: any) => row.status === 'NOT_RULED_NEEDS_RESEARCH');
  if (notRuled.length !== 116) throw new Error(`EXPECTED_116_NOT_RULED_FOUND_${notRuled.length}`);
  const ids = notRuled.map((row: any) => row.recipeId);
  const reasonById = new Map(notRuled.map((row: any) => [row.recipeId, row.reason ?? 'No source-backed rule yet.']));
  const recipes = await prisma.recipe.findMany({
    where: { id: { in: ids }, status: 'active', isPublic: true },
    include: {
      ingredients: { include: { ingredient: true }, orderBy: { order: 'asc' } },
      steps: { orderBy: { order: 'asc' } },
      searchTerms: true,
    },
    orderBy: { title: 'asc' },
  });
  if (recipes.length !== 116) throw new Error(`EXPECTED_116_ACTIVE_PUBLIC_RECIPES_FOUND_${recipes.length}`);

  const rows: QueueRow[] = recipes.map((recipe) => {
    const s = slug(recipe);
    const loc = localeFromRecipe(recipe);
    const p = priorityAndAction(recipe);
    return {
      recipeId: recipe.id,
      slug: s,
      titleFa: recipe.title,
      titleEn: titleEnFromSlug(s),
      country: loc.country,
      cityRegion: loc.cityRegion,
      sourceGroup: sourceGroup(recipe),
      dishType: jsonArray(recipe.dishType).join('|') || recipe.category,
      culinaryClass: culinaryClass(recipe),
      ingredientCount: recipe.ingredients.length,
      stepCount: recipe.steps.length,
      grisCompleteness: grisCompleteness(recipe),
      notRuledReason: String(reasonById.get(recipe.id) ?? 'No source-backed rule yet.'),
      ...p,
    };
  });

  writeJson('review_queue_116.json', { generatedAt: new Date().toISOString(), count: rows.length, rows });
  writeCsv('review_queue_116.csv', rows);
  writeMd(
    'review_queue_116.md',
    `# Source-Backed Review Queue 116

- generatedAt: ${new Date().toISOString()}
- total: ${rows.length}

## Priority Counts

${Object.entries(countBy(rows, 'priority')).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

## Recommended Action Counts

${Object.entries(countBy(rows, 'recommendedAction')).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

## Queue

| # | Priority | Title | Slug | Country | Region/City | Source | Class | Ingredients | Steps | Action |
|---:|---|---|---|---|---|---|---|---:|---:|---|
${rows
  .map(
    (row, index) =>
      `| ${index + 1} | ${row.priority} | ${row.titleFa} | ${row.slug} | ${row.country} | ${row.cityRegion} | ${row.sourceGroup} | ${row.culinaryClass} | ${row.ingredientCount} | ${row.stepCount} | ${row.recommendedAction} |`,
  )
  .join('\n')}
`,
  );

  const activePublic = await prisma.recipe.count({ where: { status: 'active', isPublic: true } });
  const rulebookPath = path.join(sprintDir, 'culinary_authenticity_rulebook_v1.json');
  const rulebook = fs.existsSync(rulebookPath) ? JSON.parse(fs.readFileSync(rulebookPath, 'utf8')) : { rules: [] };
  const ruleStatusCounts = countBy(rulebook.rules ?? [], 'ruleStatus');
  const sourceGroupDist = countBy(rows, 'sourceGroup');
  const countryDist = countBy(rows, 'country');
  const classDist = countBy(rows, 'culinaryClass');

  writeMd(
    'rule_coverage_metric_clarification.md',
    `# Rule Coverage Metric Clarification

- generatedAt: ${new Date().toISOString()}
- active/public recipes: ${activePublic}
- already RULED: ${ruleStatusCounts.RULED ?? 0}
- LOW_RISK_SIMPLE: ${ruleStatusCounts.LOW_RISK_SIMPLE ?? 0}
- LITE_SIMPLE: ${ruleStatusCounts.LITE_SIMPLE ?? 0}
- NON_COOKING_LOW_PRIORITY: ${ruleStatusCounts.NON_COOKING_LOW_PRIORITY ?? 0}
- NOT_RULED_NEEDS_RESEARCH: ${rows.length}

## Meaning

The previous metric "rule coverage total rules/templates: 589" means the rulebook has one row per active/public recipe. It does not mean 589 recipes were source-backed. Only rows with RULED were source-backed/explicitly locked at that point. LOW_RISK_SIMPLE and LITE_SIMPLE are triage classes, not culinary authenticity research packets.

## Source Group Distribution

${Object.entries(sourceGroupDist).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

## Country/Region Distribution

${Object.entries(countryDist).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

## Cooked vs Non-Cooking Distribution

${Object.entries(classDist).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

## Exact 116 Recipe List

| # | Title | RecipeId | Slug | Priority | Source Group | Country | Region/City | Class |
|---:|---|---|---|---|---|---|---|---|
${rows
  .map(
    (row, index) =>
      `| ${index + 1} | ${row.titleFa} | ${row.recipeId} | ${row.slug} | ${row.priority} | ${row.sourceGroup} | ${row.country} | ${row.cityRegion} | ${row.culinaryClass} |`,
  )
  .join('\n')}
`,
  );

  console.log(JSON.stringify({ ok: true, count: rows.length, priorities: countBy(rows, 'priority'), actions: countBy(rows, 'recommendedAction') }, null, 2));
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
