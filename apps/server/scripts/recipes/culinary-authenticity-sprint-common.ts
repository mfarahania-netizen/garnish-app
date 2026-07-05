import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
export const sprintDir = path.resolve(process.cwd(), '..', '..', 'docs', 'qa', 'recipes', 'culinary-authenticity-sprint');
export const archiveDir = path.resolve(process.cwd(), '..', '..', 'docs', 'qa', 'recipes', 'archive-content-risk-audit-v1');

export function ensureDir() {
  fs.mkdirSync(sprintDir, { recursive: true });
}

export function writeJson(name: string, value: unknown) {
  ensureDir();
  fs.writeFileSync(path.join(sprintDir, name), JSON.stringify(value, null, 2), 'utf8');
}

export function writeMd(name: string, value: string) {
  ensureDir();
  fs.writeFileSync(path.join(sprintDir, name), value, 'utf8');
}

export function writeCsv(name: string, rows: Record<string, unknown>[]) {
  ensureDir();
  const headers = Object.keys(rows[0] ?? { empty: '' });
  const cell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const body = [headers.map(cell).join(',')]
    .concat(rows.map((row) => headers.map((h) => cell(row[h])).join(',')))
    .join('\n');
  fs.writeFileSync(path.join(sprintDir, name), `${body}\n`, 'utf8');
}

export function parseJson(value: unknown, fallback: any = null) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function textValues(value: unknown): string {
  const parts: string[] = [];
  const walk = (v: unknown) => {
    if (v == null) return;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      parts.push(String(v));
      return;
    }
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    if (typeof v === 'object') Object.values(v as Record<string, unknown>).forEach(walk);
  };
  walk(value);
  return parts.join(' ');
}

export function getDbUrl() {
  return process.env.DATABASE_URL ?? '';
}

export function assertLocalDatabase() {
  const url = getDbUrl();
  const lower = url.toLowerCase();
  const local = lower.includes('localhost') || lower.includes('127.0.0.1') || lower.includes('host.docker.internal');
  const dangerous = /(prod|production|neon|supabase|render|railway|amazonaws|rds|azure|cloudsql)/i.test(url);
  if (!local || dangerous) {
    throw new Error(`DATABASE_URL_NOT_LOCAL_DEV:${url.replace(/:\/\/.*@/, '://***@')}`);
  }
  return url;
}

export async function getCounts() {
  const [totalRecipes, activePublic, draftPrivate, ingredientCount, mezeTotal, mezePublic, mezeNonDraft] = await Promise.all([
    prisma.recipe.count(),
    prisma.recipe.count({ where: { status: 'active', isPublic: true } }),
    prisma.recipe.count({ where: { NOT: { status: 'active', isPublic: true } } }),
    prisma.ingredient.count(),
    prisma.recipe.count({ where: { id: { startsWith: 'meze50_' } } }),
    prisma.recipe.count({ where: { id: { startsWith: 'meze50_' }, isPublic: true } }),
    prisma.recipe.count({ where: { id: { startsWith: 'meze50_' }, NOT: { status: 'draft' } } }),
  ]);
  return { totalRecipes, activePublic, draftPrivate, ingredientCount, mezeTotal, mezePublic, mezeNonDraft };
}

export const requiredGrisKeys = ['story', 'glance', 'ingredients', 'steps', 'whyItWorks', 'troubleshooting', 'serveWith', 'finish', 'faq'];

export function grisCompleteness(gris: any) {
  const keys = gris && typeof gris === 'object' ? Object.keys(gris) : [];
  const missing = requiredGrisKeys.filter((key) => !keys.includes(key));
  return { ok: !!gris && missing.length === 0, keys, missing };
}

export async function loadRecipeById(id: string) {
  return prisma.recipe.findUnique({
    where: { id },
    include: {
      ingredients: { orderBy: { order: 'asc' }, include: { ingredient: true } },
      steps: { orderBy: { order: 'asc' } },
      searchTerms: true,
      nutrition: true,
    },
  });
}

export function recipeBlob(recipe: any) {
  return textValues({
    title: recipe.title,
    description: recipe.description,
    category: recipe.category,
    region: recipe.region,
    categories: parseJson(recipe.categories, []),
    tips: parseJson(recipe.tips, []),
    faq: parseJson(recipe.faq, []),
    chefTips: parseJson(recipe.chefTips, []),
    commonMistakes: parseJson(recipe.commonMistakes, []),
    servingSuggestions: parseJson(recipe.servingSuggestions, []),
    substitutions: parseJson(recipe.substitutions, []),
    gris: recipe.gris,
    ingredients: recipe.ingredients?.map((ri: any) => ({
      name: ri.name,
      ingredientNameFa: ri.ingredient?.nameFa,
      ingredientNameEn: ri.ingredient?.nameEn,
      code: ri.ingredient?.code,
      amount: ri.amount,
      unit: ri.unit,
      preparation: parseJson(ri.notes, {})?.preparation ?? null,
    })),
    steps: recipe.steps?.map((s: any) => ({ title: s.title, instruction: s.instruction })),
    searchTerms: recipe.searchTerms?.map((s: any) => s.term),
  }).toLowerCase();
}

export const sourceRefs = {
  carbonara: [
    {
      title: 'Accademia Italiana della Cucina - Carbonara identity',
      url: 'https://www.accademiaitalianacucina.it/en/recipes/recipe/spaghetti-carbonara',
      note: 'Traditional carbonara centers pasta, eggs, cured pork, cheese, black pepper; no cream.',
    },
    {
      title: 'La Cucina Italiana - Carbonara',
      url: 'https://www.lacucinaitaliana.com/recipe/pasta/spaghetti-carbonara',
      note: 'Established Italian food publication; technique depends on eggs/cheese and pasta water.',
    },
    {
      title: 'Serious Eats - Pasta Carbonara',
      url: 'https://www.seriouseats.com/pasta-carbonara-sauce-recipe',
      note: 'Food education source; explains off-heat emulsion and no cream requirement for classic style.',
    },
  ],
  kimchi: [
    {
      title: 'Maangchi - Tongbaechu-kimchi',
      url: 'https://www.maangchi.com/recipe/tongbaechu-kimchi',
      note: 'Canonical home-cooking source: napa cabbage, salting, gochugaru, garlic, ginger, fermented paste.',
    },
    {
      title: 'Korean Bapsang - Mak Kimchi / Napa Cabbage Kimchi',
      url: 'https://www.koreanbapsang.com/mak-kimchi-simple-kimchi/',
      note: 'Korean recipe source: salting cabbage and chili-garlic-ginger seasoning are core.',
    },
    {
      title: 'The Korean Vegan / Kimchi basics',
      url: 'https://thekoreanvegan.com/vegan-kimchi/',
      note: 'Shows acceptable variation: vegan kimchi can omit fish sauce, but still needs cabbage, salting, chili, garlic, ginger.',
    },
  ],
};

export async function activePublicRecipes() {
  return prisma.recipe.findMany({
    where: { status: 'active', isPublic: true },
    include: {
      ingredients: { orderBy: { order: 'asc' }, include: { ingredient: true } },
      steps: { orderBy: { order: 'asc' } },
      searchTerms: true,
      nutrition: true,
    },
    orderBy: { title: 'asc' },
  });
}

export function isLiteOrSimple(recipe: any) {
  const blob = recipeBlob(recipe);
  return recipe.category === 'lite_food'
    || recipe.id.includes('lite')
    || /drink|beverage|smoothie|juice|coffee|tea|sauce|dip|side|snack|assemble/.test(blob)
    || /نوشیدنی|اسموتی|شربت|قهوه|چای|لیموناد|لاته|موهیتو|آیران|آگوا|سس|دیپ/.test(recipe.title);
}

export function adminSlug(recipe: any) {
  return parseJson(recipe.adminNote, {})?.slug ?? '';
}

