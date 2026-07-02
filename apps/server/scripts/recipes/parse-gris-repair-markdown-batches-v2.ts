import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { ROOT, REQUIRED_SECTIONS, RequiredSection, cleanText, stripMd, writeJson, localDbGuard, readJson } from './gris-repair-common';

const BASE_DIR = path.join(ROOT, 'docs/qa/recipes/gris-repair-batches');
const NON_DRINK_DIR = path.join(BASE_DIR, 'non-drinks');
const DRINK_DIR = path.join(BASE_DIR, 'drinks');
const STAGING_DIR = path.join(BASE_DIR, 'staging');
const STAGING_JSON = path.join(STAGING_DIR, 'gris_repair_remaining_non_drinks_111_340_and_drinks_001_027.staging.json');
const PARSE_REPORT = path.join(STAGING_DIR, 'gris_repair_remaining_non_drinks_111_340_and_drinks_001_027.parse_report.md');
const PREVIOUS_REPORT = path.join(BASE_DIR, 'non-drinks/apply/gris_repair_001_110.apply_report.json');
const AUDIT_JSON = path.join(ROOT, 'docs/qa/recipes/garnish_non_lite_recipe_completeness_audit_v1.json');

const INTERNAL_TERMS = ['fdcId', 'USDA', 'nutrition engine', 'database', 'import', 'Codex', 'GRIS', 'source-backed', 'ingredientId', 'recipeId'];
const FORBIDDEN_GENERIC = [
  'کنترل حرارت، بافت را حفظ می‌کند',
  'وقتی حرارت با نوع ماده هماهنگ باشد',
  'استراحت کوتاه بعد از پخت',
  'تشخیص نشانه پایان پخت',
  'تنظیم مزه نهایی',
  'قبل از سرو بچشید',
  'ماده اصلی را اضافه کنید',
  'با توجه به نوع غذا',
  'طبق شخصیت غذا',
  'بپزید تا آماده شود',
  'مواد را آماده کنید',
  'در پایان تنظیم کنید',
  'نقش اصلی در مزه، بافت یا تعادل همین دستور دارد',
  'تازه، سالم و بدون بوی ماندگی انتخاب کنید',
];

function faDigitToEn(value: string) {
  const fa = '۰۱۲۳۴۵۶۷۸۹';
  const ar = '٠١٢٣٤٥٦٧٨٩';
  return String(value).replace(/[۰-۹٠-٩]/g, (d) => {
    const faIdx = fa.indexOf(d);
    if (faIdx >= 0) return String(faIdx);
    return String(ar.indexOf(d));
  });
}

function sectionKey(title: string): RequiredSection | null {
  const t = cleanText(title).replace(/\u200c/g, '').replace(/ي/g, 'ی').replace(/ك/g, 'ک');
  if (t.includes('داستان')) return 'story';
  if (t.includes('نگاه اول')) return 'glance';
  if (t.includes('مواد لازم')) return 'ingredients';
  if (t.includes('چرا') && t.includes('آشپزی')) return 'whyItWorks';
  if (t.includes('چی یاد میگیری') || t.includes('چی یاد می‌گیری')) return 'skillsLearned';
  if (t.includes('مراحل پخت') || t.includes('مراحل آمادهسازی') || t.includes('مراحل آماده‌سازی')) return 'steps';
  if (t.includes('پایان') && t.includes('سرآشپز')) return 'finish';
  if (t.includes('رفع مشکل')) return 'troubleshooting';
  if (t.includes('تغییرات')) return 'variations';
  if (t.includes('نگهداری') || t.includes('نگه داری') || t.includes('نگه‌داری')) return 'keep';
  if (t.includes('سرو با')) return 'serveWith';
  if (t.includes('سؤال') || t.includes('سوال')) return 'faq';
  if (t.includes('ارزش غذایی')) return 'nourishment';
  return null;
}

function parseList(section: string) {
  return cleanText(section).split('\n').map((line) => stripMd(line).replace(/^#+\s*/, '').trim()).filter((line) => line && line !== '---');
}

function parseBoldPairs(section: string) {
  const out: any[] = [];
  const lines = cleanText(section).split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const match = line.match(/^(?:-\s*)?\*\*(.+?)\*\*\s*:?\s*(.*)$/);
    if (match) {
      const item = { problem: stripMd(match[1]), fix: stripMd(match[2]) };
      if (!item.fix && lines[i + 1]) {
        const next = lines[i + 1].trim();
        if (/^[←→]/.test(next)) {
          item.fix = stripMd(next.replace(/^[←→]\s*/, ''));
          i++;
        }
      }
      out.push(item);
      continue;
    }
    const arrow = line.replace(/^-\s*/, '').split(/\s*[←→]\s*/);
    if (arrow.length >= 2) out.push({ problem: stripMd(arrow[0]), fix: stripMd(arrow.slice(1).join(' ← ')) });
  }
  return out.filter((item) => item.problem || item.fix);
}

function parseFaq(section: string) {
  const lines = cleanText(section).split('\n').map((line) => line.trim()).filter(Boolean);
  const out: any[] = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^\*\*(.+?)\*\*\s*(.*)$/);
    if (match) {
      const inlineAnswer = stripMd(match[2]);
      const nextAnswer = !inlineAnswer && lines[i + 1] && !lines[i + 1].startsWith('**') ? stripMd(lines[++i]) : inlineAnswer;
      out.push({ q: stripMd(match[1]), a: nextAnswer });
    } else if (lines[i].startsWith('-')) {
      out.push({ q: stripMd(lines[i]), a: '' });
    }
  }
  return out;
}

function parseIngredients(section: string) {
  const out: any[] = [];
  let component = '';
  const lines = cleanText(section).split('\n');
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx].trim();
    if (!line) continue;
    if (line.startsWith('####')) {
      component = stripMd(line.replace(/^####\s*/, '').replace(/^برای\s+/, ''));
      continue;
    }
    const bold = line.match(/^(?:-\s*)?\*\*(.+?)\*\*\s*(.*)$/);
    if (!bold) continue;
    const namePart = stripMd(bold[1]);
    const rest = stripMd(bold[2]);
    const following: string[] = [];
    let look = idx + 1;
    while (look < lines.length) {
      const next = lines[look].trim();
      if (!next) { look++; continue; }
      if (next.startsWith('**') || next.startsWith('##') || next.startsWith('- **')) break;
      following.push(stripMd(next));
      look++;
    }
    const pieces = [...rest.split(/[·—]/), ...following].map((p) => p.trim()).filter(Boolean);
    const [name, prepState] = namePart.split(/\s+[—-]\s+/).map((p) => p.trim());
    const swapPiece = pieces.find((p) => p.includes('جایگزین'));
    out.push({
      name: name || namePart,
      prepState: prepState || null,
      volume: pieces.find((p) => /^مقدار\s*:/.test(p))?.replace(/^مقدار\s*:?\s*/, '') || pieces[0] || null,
      role: pieces.find((p) => /^نقش/.test(p)) || pieces[1] || null,
      buyTip: pieces.find((p) => /^نکته/.test(p)) || pieces[2] || null,
      swap: swapPiece ? swapPiece.replace(/^جایگزین(?: واقعی)?\s*:?\s*/, '') : null,
      component,
    });
  }
  return out;
}

function parseSteps(section: string) {
  const out: any[] = [];
  const lines = cleanText(section).split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const inline = line.match(/^([0-9۰-۹٠-٩]+)[.)]\s*(.+)$/);
    if (inline) {
      out.push({ order: Number(faDigitToEn(inline[1])), instruction: stripMd(inline[2]) });
      continue;
    }
    const headed = line.match(/^####\s*([0-9۰-۹٠-٩]+)[.)]\s*(.+)$/);
    if (headed) {
      const body: string[] = [];
      let look = i + 1;
      while (look < lines.length && !/^####\s*[0-9۰-۹٠-٩]+[.)]/.test(lines[look].trim())) {
        if (lines[look].trim()) body.push(lines[look].trim());
        look++;
      }
      out.push({ order: Number(faDigitToEn(headed[1])), title: stripMd(headed[2]), instruction: stripMd(body.join(' ')) });
      i = look - 1;
    }
  }
  return out.filter((s) => s.instruction);
}

function parseFinish(section: string) {
  const text = stripMd(section);
  const parts = text.split(/راز\s*:/);
  return { finalLook: parts[0]?.trim() || text, chefSecret: parts[1]?.trim() || null };
}

function parseKeep(section: string) {
  const text = stripMd(section);
  return { note: text };
}

function grisPatchFromSections(recipeId: string, title: string, sections: Record<RequiredSection, string>) {
  const nourishmentText = stripMd(sections.nourishment);
  return {
    schemaVersion: 'gris_repair_remaining_and_drinks_v1',
    recipeId,
    title,
    story: { origin: stripMd(sections.story), occasion: null, hook: null },
    glance: { promise: stripMd(sections.glance) },
    firstLook: stripMd(sections.glance),
    ingredients: parseIngredients(sections.ingredients),
    whyItWorks: parseBoldPairs(sections.whyItWorks).map((item) => ({ point: item.problem, explanation: item.fix })),
    skillsLearned: parseList(sections.skillsLearned),
    steps: parseSteps(sections.steps),
    finish: parseFinish(sections.finish),
    troubleshooting: parseBoldPairs(sections.troubleshooting),
    variations: parseList(sections.variations).map((line) => ({ name: line, how: line })),
    keep: parseKeep(sections.keep),
    serveWith: stripMd(sections.serveWith).split('·').map((v) => v.trim()).filter(Boolean),
    faq: parseFaq(sections.faq),
    nourishment: { note: nourishmentText, qualitative: [nourishmentText].filter(Boolean), medicalClaimsAllowed: false, strictDietPlanningAllowed: false },
  };
}

function listInputFiles() {
  const nonDrinks = fs.readdirSync(NON_DRINK_DIR)
    .filter((name) => /^garnish_gris_repair_batch_(1[2-9]|2[0-9]|3[0-4])_non_drinks_.*\.md$/.test(name))
    .sort()
    .map((name) => ({ file: path.join(NON_DRINK_DIR, name), kind: 'non-drink' as const }));
  const drinks = fs.readdirSync(DRINK_DIR)
    .filter((name) => /^garnish_gris_repair_drinks_batch_.*\.md$/.test(name))
    .sort()
    .map((name) => ({ file: path.join(DRINK_DIR, name), kind: 'drink' as const }));
  return [...nonDrinks, ...drinks];
}

function parseFile(file: string, kind: 'non-drink' | 'drink') {
  const sourceFile = path.basename(file);
  const md = fs.readFileSync(file, 'utf8').replace(/\r/g, '');
  const blocks = md.split(/\n(?=#{1,2}\s+[0-9۰-۹٠-٩]+\))/g).filter((block) => /`recipeId:\s*[^`]+`/.test(block));
  return blocks.map((block) => {
    const heading = block.match(/^#{1,2}\s+([0-9۰-۹٠-٩]+)\)\s+(.+)\s*$/m);
    const recipeId = block.match(/`recipeId:\s*([^`]+?)\s*`/)?.[1]?.trim();
    const slug = block.match(/`slug:\s*([^`]+?)\s*`/)?.[1]?.trim();
    if (!recipeId || !slug) throw new Error(`Missing recipeId/slug in ${sourceFile}`);
    const sections: Partial<Record<RequiredSection, string>> = {};
    let currentKey: RequiredSection | null = null;
    let buffer: string[] = [];
    const flush = () => {
      if (currentKey) sections[currentKey] = cleanText(buffer.join('\n'));
      buffer = [];
    };
    for (const line of block.split('\n')) {
      const recipeHeading = line.match(/^#{1,2}\s+[0-9۰-۹٠-٩]+\)/);
      const sectionHeading = recipeHeading ? null : line.match(/^#{2,3}\s+(.+?)\s*$/);
      if (sectionHeading) {
        const key = sectionKey(sectionHeading[1]);
        flush();
        currentKey = key;
        continue;
      }
      if (currentKey) buffer.push(line);
    }
    flush();
    const rawSections = Object.fromEntries(REQUIRED_SECTIONS.map((key) => [key, sections[key] || ''])) as Record<RequiredSection, string>;
    const sequence = heading ? Number(faDigitToEn(heading[1])) : null;
    const headingTitle = heading ? cleanText(heading[2]) : recipeId;
    return {
      sequence,
      headingTitle,
      recipeId,
      slug,
      sourceFile,
      sourceKind: kind,
      sourceBatch: sourceFile.replace(/^garnish_gris_repair_/, '').replace(/\.md$/, ''),
      rawSections,
      grisPatch: grisPatchFromSections(recipeId, headingTitle, rawSections),
    };
  });
}

function duplicateValues(values: string[]) {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) dup.add(value);
    seen.add(value);
  }
  return [...dup];
}

function fullText(recipe: any) {
  return Object.values(recipe.rawSections || {}).join('\n');
}

async function main() {
  const db = localDbGuard();
  const prisma = new PrismaClient();
  try {
    const previous = fs.existsSync(PREVIOUS_REPORT) ? readJson<any>(PREVIOUS_REPORT) : {};
    const previousIds = new Set<string>(previous.recipeIdsToUpdate || []);
    const audit = fs.existsSync(AUDIT_JSON) ? readJson<any>(AUDIT_JSON) : {};
    const protectedIds = new Set<string>((audit.completeDoNotTouch || []).map((r: any) => r.recipeId));
    const reviewIds = new Set<string>((audit.reviewRequired || []).map((r: any) => r.recipeId));
    const inputFiles = listInputFiles();
    const recipes = inputFiles.flatMap(({ file, kind }) => parseFile(file, kind));
    const ids = recipes.map((r: any) => r.recipeId);
    const slugs = recipes.map((r: any) => r.slug);
    const dbRows = await prisma.recipe.findMany({ where: { id: { in: ids } }, select: { id: true, title: true, adminNote: true } });
    const dbIds = new Set(dbRows.map((r) => r.id));
    const errors: string[] = [];
    const requiredSectionFailures: any[] = [];
    const internalLeakFailures: any[] = [];
    const forbiddenGenericPhraseFailures: any[] = [];
    for (const id of duplicateValues(ids)) errors.push(`duplicate parsed recipeId: ${id}`);
    for (const slug of duplicateValues(slugs)) errors.push(`duplicate parsed slug: ${slug}`);
    for (const recipe of recipes) {
      if (!recipe.recipeId || !recipe.slug || !recipe.headingTitle) errors.push(`missing identity: ${recipe.sourceFile}`);
      if (!dbIds.has(recipe.recipeId)) errors.push(`missing DB recipeId: ${recipe.recipeId}`);
      if (previousIds.has(recipe.recipeId)) errors.push(`previously applied 001-110 recipeId included: ${recipe.recipeId}`);
      if (protectedIds.has(recipe.recipeId)) errors.push(`complete_do_not_touch recipeId included: ${recipe.recipeId}`);
      if (reviewIds.has(recipe.recipeId)) errors.push(`reviewRequired recipeId included without targeted patch mode: ${recipe.recipeId}`);
      for (const section of REQUIRED_SECTIONS) {
        if (!stripMd(recipe.rawSections[section])) {
          requiredSectionFailures.push({ recipeId: recipe.recipeId, section });
          errors.push(`empty/missing section ${section}: ${recipe.recipeId}`);
        }
      }
      const text = fullText(recipe);
      for (const term of INTERNAL_TERMS) {
        if (text.includes(term)) {
          internalLeakFailures.push({ recipeId: recipe.recipeId, term });
          errors.push(`internal/debug term "${term}" in ${recipe.recipeId}`);
        }
      }
      for (const phrase of FORBIDDEN_GENERIC) {
        if (text.includes(phrase)) {
          forbiddenGenericPhraseFailures.push({ recipeId: recipe.recipeId, phrase });
          errors.push(`forbidden generic phrase "${phrase}" in ${recipe.recipeId}`);
        }
      }
      for (const item of recipe.grisPatch.troubleshooting || []) {
        if (!stripMd(item.problem) || !stripMd(item.fix)) errors.push(`arrow-only/empty troubleshooting item: ${recipe.recipeId}`);
      }
      if (!recipe.grisPatch.ingredients.length) errors.push(`parsed ingredients empty: ${recipe.recipeId}`);
      if (!recipe.grisPatch.steps.length) errors.push(`parsed steps empty: ${recipe.recipeId}`);
    }
    const payload = {
      schemaVersion: 'gris_repair_remaining_and_drinks_staging_v1',
      generatedAt: new Date().toISOString(),
      db,
      source: {
        nonDrinkDir: path.relative(ROOT, NON_DRINK_DIR),
        drinkDir: path.relative(ROOT, DRINK_DIR),
        files: inputFiles.map((f) => path.relative(ROOT, f.file)),
      },
      counts: {
        previousApplied001110: previousIds.size,
        parsedRecipes: recipes.length,
        nonDrinkParsed: recipes.filter((r: any) => r.sourceKind === 'non-drink').length,
        drinkParsed: recipes.filter((r: any) => r.sourceKind === 'drink').length,
        uniqueRecipeIds: new Set(ids).size,
        uniqueSlugs: new Set(slugs).size,
        dbExisting: dbRows.length,
        missingDbRecipeIds: recipes.filter((r: any) => !dbIds.has(r.recipeId)).length,
        duplicateRecipeIds: duplicateValues(ids).length,
        duplicateSlugs: duplicateValues(slugs).length,
        requiredSectionFailures: requiredSectionFailures.length,
        internalLeakFailures: internalLeakFailures.length,
        forbiddenGenericPhraseFailures: forbiddenGenericPhraseFailures.length,
      },
      validation: {
        ok: errors.length === 0,
        errors,
        requiredSectionFailures,
        internalLeakFailures,
        forbiddenGenericPhraseFailures,
      },
      recipes,
    };
    writeJson(STAGING_JSON, payload);
    fs.mkdirSync(path.dirname(PARSE_REPORT), { recursive: true });
    fs.writeFileSync(PARSE_REPORT, [
      '# GRIS Repair Remaining + Drinks Parse Report',
      '',
      `- generatedAt: ${payload.generatedAt}`,
      `- database: ${db.redacted}`,
      `- input files: ${inputFiles.length}`,
      `- previous applied 001-110 count: ${previousIds.size}`,
      `- parsed recipes: ${payload.counts.parsedRecipes}`,
      `- non-drink parsed: ${payload.counts.nonDrinkParsed}`,
      `- drink parsed: ${payload.counts.drinkParsed}`,
      `- existing in DB: ${payload.counts.dbExisting}`,
      `- required section failures: ${payload.counts.requiredSectionFailures}`,
      `- internal leak failures: ${payload.counts.internalLeakFailures}`,
      `- forbidden generic phrase failures: ${payload.counts.forbiddenGenericPhraseFailures}`,
      `- validation: ${payload.validation.ok ? 'PASS' : 'FAIL'}`,
      '',
      '## Errors',
      '',
      errors.length ? errors.slice(0, 250).map((e) => `- ${e}`).join('\n') : '- none',
      '',
    ].join('\n'), 'utf8');
    console.log(JSON.stringify({ ok: payload.validation.ok, counts: payload.counts, staging: STAGING_JSON, report: PARSE_REPORT, errors: errors.slice(0, 30) }, null, 2));
    if (!payload.validation.ok) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, message: error.message }, null, 2));
  process.exit(1);
});
