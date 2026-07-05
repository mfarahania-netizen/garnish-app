import { activePublicRecipes, adminSlug, archiveDir, isLiteOrSimple, parseJson, prisma, sourceRefs, writeJson, writeMd } from './culinary-authenticity-sprint-common';
import fs from 'node:fs';
import path from 'node:path';

function titleRule(recipe: any) {
  const title = recipe.title;
  const slug = adminSlug(recipe);
  const lower = `${title} ${slug}`.toLowerCase();
  if (recipe.id === 'garnish_recipe_global_143_135_2919e78e') {
    return {
      ruleStatus: 'RULED',
      cuisineCountry: 'Italy',
      region: 'Lazio',
      city: 'Rome',
      requiredCoreIngredients: ['spaghetti_dry', 'guanciale_cured_pork', 'egg_yolk_raw', 'pecorino_romano_cheese', 'black_pepper_ground'],
      forbiddenIngredients: ['heavy_cream', 'cream_cheese'],
      suspiciousIngredients: ['خامه'],
      requiredTechniques: ['off_heat_emulsion', 'pasta_water_emulsion'],
      forbiddenTechniques: ['boil_egg_sauce_on_direct_heat'],
      acceptableVariations: ['pancetta if guanciale unavailable, but mark as variation'],
      sourceRefs: sourceRefs.carbonara,
      notes: 'Roman-style carbonara rule.',
    };
  }
  if (recipe.id === 'garnish_recipe_global_143_041_33abbd3b') {
    return {
      ruleStatus: 'RULED',
      cuisineCountry: 'South Korea',
      region: '',
      city: '',
      requiredCoreIngredients: ['napa_cabbage_raw', 'salt_table', 'gochugaru', 'garlic_raw', 'ginger_root_raw'],
      forbiddenIngredients: [],
      suspiciousIngredients: ['missing fermentation/salting logic'],
      requiredTechniques: ['salting cabbage', 'seasoning paste', 'fermentation/resting'],
      forbiddenTechniques: [],
      acceptableVariations: ['vegan kimchi may omit fish sauce if umami/salt balance is handled'],
      sourceRefs: sourceRefs.kimchi,
      notes: 'Full napa cabbage kimchi rule.',
    };
  }
  if (recipe.id === 'garnish_lite_fa_079_999c19be') {
    return {
      ruleStatus: 'LITE_SIMPLE',
      cuisineCountry: 'South Korea',
      region: '',
      city: '',
      requiredCoreIngredients: ['kimchi'],
      forbiddenIngredients: [],
      suspiciousIngredients: [],
      requiredTechniques: [],
      forbiddenTechniques: ['presenting ready-made condiment as full fermentation recipe'],
      acceptableVariations: ['ready-made kimchi side item'],
      sourceRefs: sourceRefs.kimchi,
      notes: 'Lite ready-made kimchi item, not a full kimchi-making recipe.',
    };
  }
  if (recipe.id === 'garnish_recipe_fa_104_7b4ced78') {
    return {
      ruleStatus: 'RULED',
      cuisineCountry: 'Iran',
      region: 'Gilan',
      city: '',
      requiredCoreIngredients: ['lamb_meat_raw', 'walnuts_raw', 'pomegranate_molasses'],
      forbiddenIngredients: ['whole_egg_raw', 'egg_yolk_raw', 'egg_white_raw'],
      suspiciousIngredients: ['ground meat for this corrected model'],
      requiredTechniques: ['slow cooking walnut-pomegranate sauce'],
      forbiddenTechniques: [],
      acceptableVariations: ['local herbs vary by availability'],
      sourceRefs: [],
      notes: 'Regression-locked corrected model.',
    };
  }
  if (recipe.id === 'garnish_recipe_fa_170_44f0d2ad') {
    return {
      ruleStatus: 'RULED',
      cuisineCountry: 'Iran',
      region: 'Isfahan',
      city: 'Isfahan',
      requiredCoreIngredients: ['ground_lamb_raw', 'chickpea_flour', 'tomato_paste', 'potato_raw'],
      forbiddenIngredients: ['split_peas_dry'],
      suspiciousIngredients: ['dried_lime_whole'],
      requiredTechniques: ['knead small meatballs', 'simmer in tomato sauce'],
      forbiddenTechniques: ['khoresh qeymeh split-pea structure'],
      acceptableVariations: ['ground beef/lamb blend'],
      sourceRefs: [],
      notes: 'Regression-locked corrected model.',
    };
  }
  if (isLiteOrSimple(recipe)) {
    return {
      ruleStatus: recipe.category === 'lite_food' ? 'LITE_SIMPLE' : 'LOW_RISK_SIMPLE',
      cuisineCountry: recipe.region === 'persian' ? 'Iran' : recipe.region === 'international' ? '' : recipe.region ?? '',
      region: '',
      city: '',
      requiredCoreIngredients: [],
      forbiddenIngredients: [],
      suspiciousIngredients: [],
      requiredTechniques: [],
      forbiddenTechniques: [],
      acceptableVariations: [],
      sourceRefs: [],
      notes: 'Simple/lite item; authenticity review lower priority, but absurd errors still require manual review.',
    };
  }
  const canonical = /(کاربونارا|کیمچی|پلوف|پایلا|رامن|پد تای|بریانی|فسنجان|قرمه|قورمه|قیمه|کباب|باقلاقاتق|میرزا|کشک بادمجان|آش رشته|زرشک پلو|باقالی پلو|ولینگتون|کروسان|گامبو|پوتین|خینکالی|فوندو|شنیتسل|کسوله|بورگینیون|ماسامان|ناسی گورنگ)/.test(title);
  return {
    ruleStatus: canonical ? 'NEEDS_RESEARCH' : 'NEEDS_RESEARCH',
    cuisineCountry: recipe.region === 'persian' ? 'Iran' : recipe.region === 'international' ? '' : recipe.region ?? '',
    region: '',
    city: '',
    requiredCoreIngredients: [],
    forbiddenIngredients: [],
    suspiciousIngredients: [],
    requiredTechniques: [],
    forbiddenTechniques: [],
    acceptableVariations: [],
    sourceRefs: [],
    notes: canonical ? 'Tier 1 canonical dish needs source-backed rule.' : 'No source-backed rule yet.',
  };
}

async function main() {
  const recipes = await activePublicRecipes();
  const rules = recipes.map((r) => {
    const base = titleRule(r);
    return {
      recipeId: r.id,
      slug: adminSlug(r),
      titleFa: r.title,
      titleEn: parseJson(r.adminNote, {})?.titleEn ?? '',
      sourceGroup: parseJson(r.adminNote, {})?.source ?? 'unknown',
      originConfidence: base.ruleStatus === 'RULED' ? 'HIGH' : base.ruleStatus.includes('SIMPLE') ? 'MEDIUM' : 'LOW',
      authenticityConfidence: base.ruleStatus === 'RULED' ? 'HIGH' : base.ruleStatus.includes('SIMPLE') ? 'MEDIUM' : 'LOW',
      ...base,
    };
  });
  const coverage = {
    generatedAt: new Date().toISOString(),
    total: rules.length,
    counts: rules.reduce((acc: Record<string, number>, r) => {
      acc[r.ruleStatus] = (acc[r.ruleStatus] ?? 0) + 1;
      return acc;
    }, {}),
    archiveAuditSummary: fs.existsSync(path.join(archiveDir, 'recipe_archive_content_audit_v1.json'))
      ? JSON.parse(fs.readFileSync(path.join(archiveDir, 'recipe_archive_content_audit_v1.json'), 'utf8')).summary
      : null,
  };
  writeJson('culinary_authenticity_rulebook_v1.json', { generatedAt: coverage.generatedAt, rules });
  writeMd('culinary_authenticity_rulebook_v1.md', `# Culinary Authenticity Rulebook v1

- total active/public recipes: ${coverage.total}
- RULED: ${coverage.counts.RULED ?? 0}
- LITE_SIMPLE: ${coverage.counts.LITE_SIMPLE ?? 0}
- LOW_RISK_SIMPLE: ${coverage.counts.LOW_RISK_SIMPLE ?? 0}
- NEEDS_RESEARCH: ${coverage.counts.NEEDS_RESEARCH ?? 0}

Reality check: this is a first rulebook, not full authenticity certification. Every NEEDS_RESEARCH recipe remains unproven from an authenticity standpoint.
`);
  writeMd('rule_coverage_report_v1.md', `# Rule Coverage Report v1

| Status | Count |
|---|---:|
${Object.entries(coverage.counts).map(([k, v]) => `| ${k} | ${v} |`).join('\n')}

Minimum viable outcome: known P1 and regression-locked recipes are ruled. Full archive authenticity remains incomplete while NEEDS_RESEARCH is high.
`);
  console.log(JSON.stringify({ ok: true, coverage }, null, 2));
}

main().finally(async () => prisma.$disconnect()).catch((err) => {
  console.error(err);
  process.exit(1);
});

