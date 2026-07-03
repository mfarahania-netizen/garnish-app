import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

export const ROOT = path.resolve(__dirname, '../../../..');
export const BATCH_DIR = path.join(ROOT, 'docs/qa/recipes/gris-repair-batches/non-drinks');
export const STAGING_DIR = path.join(BATCH_DIR, 'staging');
export const APPLY_DIR = path.join(BATCH_DIR, 'apply');
export const STAGING_JSON = path.join(STAGING_DIR, 'gris_repair_001_110.staging.json');
export const PARSE_REPORT = path.join(STAGING_DIR, 'gris_repair_001_110.parse_report.md');
export const ROLLBACK_JSON = path.join(APPLY_DIR, 'gris_repair_001_110.rollback.json');
export const APPLY_REPORT_JSON = path.join(APPLY_DIR, 'gris_repair_001_110.apply_report.json');
export const APPLY_REPORT_MD = path.join(APPLY_DIR, 'gris_repair_001_110.apply_report.md');

export const EXPECTED_FILES = [
  'garnish_gris_repair_batch_01_02_non_drinks_20_COMPLETE.md',
  'garnish_gris_repair_batch_03_non_drinks_21_30_RTL.md',
  'garnish_gris_repair_batch_04_non_drinks_31_40_RTL.md',
  'garnish_gris_repair_batch_05_non_drinks_41_50_RTL.md',
  'garnish_gris_repair_batch_06_non_drinks_51_60_RTL.md',
  'garnish_gris_repair_batch_07_non_drinks_61_70_RTL.md',
  'garnish_gris_repair_batch_08_non_drinks_71_80_RTL.md',
  'garnish_gris_repair_batch_09_non_drinks_81_90_RTL.md',
  'garnish_gris_repair_batch_10_non_drinks_91_100_RTL.md',
  'garnish_gris_repair_batch_11_non_drinks_101_110_RTL.md',
];

export const REQUIRED_SECTIONS = [
  'story',
  'glance',
  'ingredients',
  'whyItWorks',
  'skillsLearned',
  'steps',
  'finish',
  'troubleshooting',
  'variations',
  'keep',
  'serveWith',
  'faq',
  'nourishment',
] as const;

export type RequiredSection = typeof REQUIRED_SECTIONS[number];

export type ParsedRecipe = {
  sequence: number | null;
  headingTitle: string;
  recipeId: string;
  slug: string;
  sourceFile: string;
  sourceBatch: string;
  rawSections: Record<RequiredSection, string>;
  grisPatch: any;
};

export function readJson<T = any>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function parseJson(value: any, fallback: any = null) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

export function asArray<T = any>(value: any): T[] {
  return Array.isArray(value) ? value.filter(Boolean) : value ? [value] : [];
}

export function cleanText(value: string) {
  return String(value || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

export function stripMd(value: string) {
  return cleanText(value)
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/^\d+[.)]\s+/gm, '')
    .replace(/[🎓🔑⚖️🧩🛒🔄←↕️]/g, '')
    .trim();
}

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
  return cleanText(section)
    .split('\n')
    .map((line) => stripMd(line).replace(/^#+\s*/, '').trim())
    .filter((line) => line && line !== '---');
}

function parseBoldPairs(section: string) {
  const out: any[] = [];
  const lines = cleanText(section).split('\n');
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line.startsWith('-') && !line.startsWith('**')) continue;
    const match = line.match(/^(?:-\s*)?\*\*(.+?)\*\*\s*:?\s*(.*)$/);
    if (match) out.push({ problem: stripMd(match[1]), fix: stripMd(match[2]) });
    else {
      const arrow = line.replace(/^-\s*/, '').split(/\s*[←→]\s*/);
      if (arrow.length >= 2) out.push({ problem: stripMd(arrow[0]), fix: stripMd(arrow.slice(1).join(' ← ')) });
      else out.push({ problem: stripMd(line), fix: '' });
    }
    const last = out[out.length - 1];
    if (last && !last.fix && lines[i + 1]) {
      const next = lines[i + 1].trim();
      if (/^[←→]/.test(next)) {
        last.fix = stripMd(next.replace(/^[←→]\s*/, ''));
        i++;
      }
    }
  }
  return out.filter((item) => item.problem || item.fix);
}

function parseFaq(section: string) {
  const lines = cleanText(section).split('\n').map((line) => line.trim()).filter(Boolean);
  const out: any[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^\*\*(.+?)\*\*\s*(.*)$/);
    if (match) {
      const inlineAnswer = stripMd(match[2]);
      const nextAnswer = !inlineAnswer && lines[i + 1] && !lines[i + 1].startsWith('**') ? stripMd(lines[++i]) : inlineAnswer;
      out.push({ q: stripMd(match[1]), a: nextAnswer });
    }
    else if (line.startsWith('-')) out.push({ q: stripMd(line), a: '' });
  }
  return out;
}

function parseIngredients(section: string) {
  const out: any[] = [];
  let component = '';
  const lines = cleanText(section).split('\n');
  for (let idx = 0; idx < lines.length; idx++) {
    const raw = lines[idx];
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('####')) {
      component = stripMd(line.replace(/^####\s*/, '').replace(/^برای\s+/, ''));
      continue;
    }
    if (!line.startsWith('-') && !line.startsWith('**')) continue;
    const bold = line.match(/^(?:-\s*)?\*\*(.+?)\*\*\s*(.*)$/);
    const namePart = stripMd(bold ? bold[1] : line.replace(/^-\s*/, '').split('·')[0]);
    const rest = stripMd(bold ? bold[2] : line.replace(/^-\s*/, '').replace(namePart, ''));
    const following: string[] = [];
    if (!line.startsWith('-')) {
      let look = idx + 1;
      while (look < lines.length) {
        const next = lines[look].trim();
        if (!next) { look++; continue; }
        if (next.startsWith('**') || next.startsWith('##') || next.startsWith('- **')) break;
        following.push(stripMd(next));
        look++;
      }
    }
    const pieces = [...rest.split(/[·—]/), ...following].map((p) => p.trim()).filter(Boolean);
    const [name, prepState] = namePart.split(/\s+[—-]\s+/).map((p) => p.trim());
    const swapPiece = pieces.find((p) => p.startsWith('جایگزین'));
    out.push({
      name: name || namePart,
      prepState: prepState || null,
      volume: pieces[0] || null,
      role: pieces[1] || null,
      buyTip: pieces[2] || null,
      swap: swapPiece ? swapPiece.replace(/^جایگزین\s*:?\s*/, '') : null,
      component,
    });
  }
  return out;
}

function parseSteps(section: string) {
  const out: any[] = [];
  for (const raw of cleanText(section).split('\n')) {
    const line = raw.trim();
    const match = line.match(/^([0-9۰-۹٠-٩]+)[.)]\s*(.+)$/);
    if (!match) continue;
    out.push({
      order: Number(faDigitToEn(match[1])),
      instruction: stripMd(match[2]),
    });
  }
  return out;
}

function parseWhy(section: string) {
  return parseBoldPairs(section).map((item) => ({ point: item.problem, explanation: item.fix }));
}

function parseVariations(section: string) {
  const lines = parseList(section);
  if (lines.length === 1 && lines[0].includes('·')) {
    return lines[0].split('·').map((line) => ({ name: line.trim(), how: line.trim() })).filter((v) => v.name);
  }
  return lines.map((line) => ({ name: line, how: line }));
}

function parseKeep(section: string) {
  const text = stripMd(section);
  const keep: any = { note: text };
  const storage = text.match(/یخچال\s*:?\s*([^.]*)/);
  const reheat = text.match(/گرم‌?کردن\s*:?\s*([^.]*)/);
  const freeze = text.match(/فریز\s*:?\s*([^.]*)/);
  if (storage) keep.storage = storage[1].trim();
  if (reheat) keep.reheat = reheat[1].trim();
  if (freeze) keep.freeze = freeze[1].trim();
  return keep;
}

function parseFinish(section: string) {
  const text = stripMd(section);
  const parts = text.split(/راز\s*:/);
  return {
    finalLook: parts[0]?.trim() || text,
    chefSecret: parts[1]?.trim() || null,
  };
}

function grisPatchFromSections(recipeId: string, title: string, sections: Record<RequiredSection, string>) {
  const nourishmentText = stripMd(sections.nourishment);
  return {
    schemaVersion: 'gris_repair_001_110_v1',
    recipeId,
    title,
    story: { origin: stripMd(sections.story), occasion: null, hook: null },
    glance: { promise: stripMd(sections.glance) },
    firstLook: stripMd(sections.glance),
    ingredients: parseIngredients(sections.ingredients),
    whyItWorks: parseWhy(sections.whyItWorks),
    skillsLearned: parseList(sections.skillsLearned),
    steps: parseSteps(sections.steps),
    finish: parseFinish(sections.finish),
    troubleshooting: parseBoldPairs(sections.troubleshooting),
    variations: parseVariations(sections.variations),
    keep: parseKeep(sections.keep),
    serveWith: stripMd(sections.serveWith).split('·').map((v) => v.trim()).filter(Boolean),
    faq: parseFaq(sections.faq),
    nourishment: {
      note: nourishmentText,
      qualitative: [nourishmentText].filter(Boolean),
      medicalClaimsAllowed: false,
      strictDietPlanningAllowed: false,
    },
  };
}

export function normalizeBatchFiles() {
  fs.mkdirSync(BATCH_DIR, { recursive: true });
  const existing = fs.readdirSync(BATCH_DIR).filter((name) => name.endsWith('.md'));
  for (const expected of EXPECTED_FILES) {
    if (fs.existsSync(path.join(BATCH_DIR, expected))) continue;
    const stem = expected.replace(/\.md$/, '');
    const candidate = existing.find((name) => name.replace(/\s*\(\d+\)(?=\.md$)/, '').replace(/\.md$/, '') === stem);
    if (candidate) fs.copyFileSync(path.join(BATCH_DIR, candidate), path.join(BATCH_DIR, expected));
  }
}

export function parseMarkdownBatches(): ParsedRecipe[] {
  normalizeBatchFiles();
  const missing = EXPECTED_FILES.filter((file) => !fs.existsSync(path.join(BATCH_DIR, file)));
  if (missing.length) throw new Error(`Missing expected markdown files: ${missing.join(', ')}`);
  const recipes: ParsedRecipe[] = [];
  for (const file of EXPECTED_FILES) {
    const fullPath = path.join(BATCH_DIR, file);
    const md = fs.readFileSync(fullPath, 'utf8').replace(/\r/g, '');
    const blocks = md.split(/\n(?=#{1,2}\s+[0-9۰-۹٠-٩]+\))/g).filter((block) => /`recipeId:\s*[^`]+`/.test(block));
    for (const block of blocks) {
      const heading = block.match(/^#{1,2}\s+([0-9۰-۹٠-٩]+)\)\s+(.+)\s*$/m);
      const recipeId = block.match(/`recipeId:\s*([^`]+?)\s*`/)?.[1]?.trim();
      const slug = block.match(/`slug:\s*([^`]+?)\s*`/)?.[1]?.trim();
      if (!recipeId || !slug) throw new Error(`Missing recipeId/slug in ${file}`);
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
          if (key) {
            flush();
            currentKey = key;
            continue;
          }
          flush();
          currentKey = null;
          continue;
        }
        if (currentKey) buffer.push(line);
      }
      flush();
      const rawSections = Object.fromEntries(REQUIRED_SECTIONS.map((key) => [key, sections[key] || ''])) as Record<RequiredSection, string>;
      recipes.push({
        sequence: heading ? Number(faDigitToEn(heading[1])) : null,
        headingTitle: heading ? cleanText(heading[2]) : '',
        recipeId,
        slug,
        sourceFile: file,
        sourceBatch: file.replace(/^garnish_gris_repair_/, '').replace(/\.md$/, ''),
        rawSections,
        grisPatch: grisPatchFromSections(recipeId, heading ? cleanText(heading[2]) : recipeId, rawSections),
      });
    }
  }
  return recipes;
}

const INTERNAL_TERMS = [
  'fdcId', 'USDA', 'nutrition engine', 'database', 'import', 'Codex', 'GRIS', 'source-backed',
  'قفل‌شده به منبع', 'قفل شده به منبع', 'موتور قفل‌شده', 'موتور قفل شده',
];

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
];

const DRINK_RE = /(mojito|smoothie|sharbat|lemonade|water|juice|milkshake|موهیتو|اسموتی|شربت|لیموناد|آبمیوه|نوشیدنی|میلک)/i;

function duplicateValues(values: string[]) {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) dup.add(value);
    seen.add(value);
  }
  return [...dup];
}

export async function validateParsedRecipes(recipes: ParsedRecipe[], prisma: PrismaClient) {
  const ids = recipes.map((r) => r.recipeId);
  const slugs = recipes.map((r) => r.slug);
  const dbRows = await prisma.recipe.findMany({
    where: { id: { in: ids } },
    select: { id: true, title: true, adminNote: true, category: true, mealType: true, dishType: true },
  });
  const allDbRows = await prisma.recipe.findMany({
    select: { id: true, adminNote: true },
  });
  const dbIds = new Set(dbRows.map((r) => r.id));
  const errors: string[] = [];
  if (recipes.length !== 110) errors.push(`expected 110 parsed recipes, got ${recipes.length}`);
  for (const id of duplicateValues(ids)) errors.push(`duplicate recipeId: ${id}`);
  for (const slug of duplicateValues(slugs)) errors.push(`duplicate slug: ${slug}`);
  if (new Set(ids).size !== 110) errors.push(`expected 110 unique recipeIds, got ${new Set(ids).size}`);
  if (new Set(slugs).size !== 110) errors.push(`expected 110 unique slugs, got ${new Set(slugs).size}`);
  const dbAdminSlugs = allDbRows
    .map((row) => ({ id: row.id, slug: parseJson(row.adminNote, {})?.slug }))
    .filter((row) => typeof row.slug === 'string' && row.slug.trim());
  const dbSlugDuplicates = duplicateValues(dbAdminSlugs.map((row) => row.slug));
  for (const slug of dbSlugDuplicates) errors.push(`duplicate DB adminNote.slug: ${slug}`);
  for (const recipe of recipes) {
    if (!dbIds.has(recipe.recipeId)) errors.push(`missing DB recipe: ${recipe.recipeId}`);
    if (recipe.recipeId.startsWith('garnish_lite_')) errors.push(`Lite recipe included: ${recipe.recipeId}`);
    const db = dbRows.find((row) => row.id === recipe.recipeId);
    const adminNote = parseJson(db?.adminNote, {});
    const dishType = parseJson(db?.dishType, []);
    const mealType = parseJson(db?.mealType, []);
    const drinkSurface = [recipe.headingTitle, recipe.slug, db?.title, db?.category, ...asArray(dishType), ...asArray(mealType), adminNote?.source].join(' ');
    if (DRINK_RE.test(drinkSurface)) errors.push(`drink/beverage excluded item included: ${recipe.recipeId} ${recipe.headingTitle}`);
    for (const section of REQUIRED_SECTIONS) {
      if (!stripMd(recipe.rawSections[section])) errors.push(`empty/missing section ${section}: ${recipe.recipeId}`);
    }
    const fullText = Object.values(recipe.rawSections).join('\n');
    for (const term of INTERNAL_TERMS) if (fullText.includes(term)) errors.push(`internal term "${term}": ${recipe.recipeId}`);
    for (const term of FORBIDDEN_GENERIC) if (fullText.includes(term)) errors.push(`forbidden generic phrase "${term}": ${recipe.recipeId}`);
    for (const line of fullText.split('\n')) {
      const cleaned = stripMd(line);
      if (!cleaned || cleaned === '---') continue;
      if (/^[←→\-–—\s]+$/.test(cleaned)) errors.push(`arrow-only item: ${recipe.recipeId}`);
    }
    if (!recipe.grisPatch.ingredients.length) errors.push(`parsed ingredients empty: ${recipe.recipeId}`);
    if (!recipe.grisPatch.steps.length) errors.push(`parsed steps empty: ${recipe.recipeId}`);
    if (!recipe.grisPatch.whyItWorks.length) errors.push(`parsed whyItWorks empty: ${recipe.recipeId}`);
    if (!recipe.grisPatch.faq.length) errors.push(`parsed faq empty: ${recipe.recipeId}`);
  }
  return {
    ok: errors.length === 0,
    errors,
    counts: {
      parsedRecipes: recipes.length,
      uniqueRecipeIds: new Set(ids).size,
      uniqueSlugs: new Set(slugs).size,
      dbExisting: dbRows.length,
      dbAdminNoteSlugDuplicates: dbSlugDuplicates.length,
      protectedReviewLiteCheck: 'audit files intentionally not used; only garnish_lite_ recipeId prefix is checked',
    },
  };
}

export function localDbGuard() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  const parsed = new URL(url);
  const db = parsed.pathname.replace(/^\//, '');
  const local = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  if (db !== 'garnish_db' || !local) throw new Error(`SAFETY STOP: expected local/dev garnish_db, got ${db}@${parsed.hostname}`);
  return { database: db, host: parsed.hostname, redacted: `${parsed.protocol}//${parsed.username}:***@${parsed.hostname}:${parsed.port}${parsed.pathname}` };
}
