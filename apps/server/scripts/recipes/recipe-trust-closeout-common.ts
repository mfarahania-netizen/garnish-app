import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
export const outDir = path.resolve(process.cwd(), '..', '..', 'docs', 'qa', 'recipes', 'recipe-trust-closeout');
export const expansionDir = path.resolve(process.cwd(), '..', '..', 'docs', 'qa', 'recipes', 'catalog-expansion-plan');
export const queueCsv = path.resolve(process.cwd(), '..', '..', 'docs', 'qa', 'recipes', 'resolve-authenticity-85-no-public-blockers', 'final_hidden_until_review.csv');

export function ensureDir(dir = outDir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function writeJson(name: string, value: unknown, dir = outDir) {
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2), 'utf8');
}

export function writeMd(name: string, value: string, dir = outDir) {
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, name), value, 'utf8');
}

export function writeCsv(name: string, rows: Record<string, unknown>[], headers?: string[], dir = outDir) {
  ensureDir(dir);
  const cols = headers ?? Object.keys(rows[0] ?? { empty: '' });
  const cell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const body = [cols.map(cell).join(',')]
    .concat(rows.map((row) => cols.map((header) => cell(row[header])).join(',')))
    .join('\n');
  fs.writeFileSync(path.join(dir, name), `${body}\n`, 'utf8');
}

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [headers = [], ...data] = rows.filter((r) => r.some((v) => v.trim()));
  return data.map((values) => Object.fromEntries(headers.map((header, i) => [header, values[i] ?? ''])));
}

export function loadQueue() {
  const rows = parseCsv(fs.readFileSync(queueCsv, 'utf8'));
  const ids = new Set(rows.map((row) => row.recipeId));
  if (rows.length !== 85 || ids.size !== 85) throw new Error(`EXPECTED_85_QUEUE_FOUND_${rows.length}_${ids.size}`);
  return rows;
}

export function getDbUrl() {
  return process.env.DATABASE_URL ?? '';
}

export function redactedDbUrl() {
  return getDbUrl().replace(/:\/\/.*@/, '://***@');
}

export function assertLocalDatabase() {
  const url = getDbUrl();
  const lower = url.toLowerCase();
  const local = lower.includes('localhost') || lower.includes('127.0.0.1') || lower.includes('host.docker.internal');
  const dangerous = /(prod|production|neon|supabase|render|railway|amazonaws|rds|azure|cloudsql)/i.test(url);
  if (!local || dangerous) throw new Error(`DATABASE_URL_NOT_LOCAL_DEV:${redactedDbUrl()}`);
}

export async function getCounts() {
  const [totalRecipes, activePublic, draftPrivate, ingredientCount, mezeTotal, mezePublic, mezeNonDraft] = await Promise.all([
    prisma.recipe.count(),
    prisma.recipe.count({ where: { status: 'active', isPublic: true } }),
    prisma.recipe.count({ where: { NOT: { status: 'active', isPublic: true } } }),
    prisma.ingredient.count(),
    prisma.recipe.count({ where: { id: { startsWith: 'meze50_' } } }),
    prisma.recipe.count({ where: { id: { startsWith: 'meze50_' }, status: 'active', isPublic: true } }),
    prisma.recipe.count({ where: { id: { startsWith: 'meze50_' }, NOT: { status: 'draft' } } }),
  ]);
  return { totalRecipes, activePublic, draftPrivate, ingredientCount, mezeTotal, mezePublic, mezeNonDraft };
}

export async function loadRecipes(ids: string[]) {
  return prisma.recipe.findMany({
    where: { id: { in: ids } },
    include: {
      ingredients: { orderBy: { order: 'asc' }, include: { ingredient: true } },
      steps: { orderBy: { order: 'asc' } },
      searchTerms: true,
      nutrition: true,
    },
  });
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
    if (Array.isArray(v)) return v.forEach(walk);
    if (typeof v === 'object') Object.values(v as Record<string, unknown>).forEach(walk);
  };
  walk(value);
  return parts.join(' ');
}

export function recipeBlob(recipe: any) {
  return textValues({
    title: recipe?.title,
    description: recipe?.description,
    category: recipe?.category,
    region: recipe?.region,
    mealType: recipe?.mealType,
    categories: parseJson(recipe?.categories, []),
    allergens: parseJson(recipe?.allergens, []),
    gris: recipe?.gris,
    ingredients: recipe?.ingredients?.map((ri: any) => ({ name: ri.name, code: ri.ingredient?.code, nameFa: ri.ingredient?.nameFa, nameEn: ri.ingredient?.nameEn, notes: parseJson(ri.notes, ri.notes) })),
    steps: recipe?.steps?.map((step: any) => ({ title: step.title, instruction: step.instruction })),
    searchTerms: recipe?.searchTerms?.map((term: any) => term.term),
  }).toLowerCase();
}

export function rollbackEntry(recipe: any, slug = '') {
  return {
    recipeId: recipe.id,
    slug,
    titleFa: recipe.title,
    status: recipe.status,
    isPublic: recipe.isPublic,
    adminNote: recipe.adminNote,
    updatedAt: recipe.updatedAt,
  };
}

export function grisCompleteness(recipe: any) {
  const required = ['story', 'glance', 'ingredients', 'steps', 'whyItWorks', 'troubleshooting', 'serveWith', 'finish', 'faq'];
  const gris = recipe?.gris;
  const keys = gris && typeof gris === 'object' ? Object.keys(gris) : [];
  const missing = required.filter((key) => !keys.includes(key));
  return { ok: !!gris && missing.length === 0, missing, keys };
}

export function closeoutDecision(row: any, recipe: any) {
  const completeness = grisCompleteness(recipe);
  const reasons = [
    'No three-source reputable evidence packet is attached for this recipe.',
    'No documented product-decision pass proves the current public identity is safe.',
  ];
  if (!completeness.ok) reasons.push(`GRIS completeness is not independently revalidated for restore (${completeness.missing.join(', ') || 'unknown'}).`);
  return {
    recipeId: row.recipeId,
    slug: row.slug,
    titleFa: recipe?.title ?? row.titleFa,
    titleEn: row.slug?.split('-').join(' ') ?? '',
    currentStatus: recipe?.status ?? row.status,
    currentIsPublic: recipe?.isPublic ?? row.isPublic,
    currentIngredientsSummary: (recipe?.ingredients ?? []).map((ri: any) => ({
      name: ri.name,
      code: ri.ingredient?.code ?? null,
      amount: ri.amount,
      unit: ri.unit,
      displayUnit: parseJson(ri.notes, {})?.displayUnit ?? null,
      preparation: parseJson(ri.notes, {})?.preparation ?? null,
    })),
    currentStepsSummary: (recipe?.steps ?? []).map((step: any) => ({ order: step.order, title: step.title, instruction: step.instruction })),
    currentGrisCompleteness: completeness,
    sourceRefs: [],
    canonicalIdentity: recipe?.title ?? row.titleFa,
    country: recipe?.region === 'persian' ? 'Iran' : recipe?.region ?? 'unknown',
    region: recipe?.region ?? '',
    city: '',
    requiredCoreIngredients: [],
    forbiddenIngredients: [],
    suspiciousIngredients: [],
    requiredTechniques: [],
    acceptableVariants: [],
    variantDecision: 'No safe variant decision established in this sprint.',
    confidence: 'LOW',
    decision: 'KEEP_REVIEWONLY_INSUFFICIENT_EVIDENCE',
    finalState: 'STILL_REVIEWONLY_WITH_EXACT_BLOCKER',
    exactBlocker: reasons.join(' '),
  };
}

export async function regressionStatus() {
  const [gamaj, qeymeh] = await Promise.all([
    prisma.recipe.findUnique({ where: { id: 'garnish_recipe_fa_104_7b4ced78' }, include: { ingredients: { include: { ingredient: true } }, steps: true, searchTerms: true } }),
    prisma.recipe.findUnique({ where: { id: 'garnish_recipe_fa_170_44f0d2ad' }, include: { ingredients: { include: { ingredient: true } }, steps: true, searchTerms: true } }),
  ]);
  const blob = (r: any) => [
    ...(r?.ingredients ?? []).flatMap((ri: any) => [ri.name, ri.ingredient?.code, ri.ingredient?.nameFa, ri.ingredient?.nameEn]),
    ...(r?.searchTerms ?? []).map((t: any) => t.term),
  ].filter(Boolean).join(' ').toLowerCase();
  const gamajFailures: string[] = [];
  const qeymehFailures: string[] = [];
  if (!gamaj) gamajFailures.push('missing');
  if (gamaj && /(^|[^a-z])egg([^a-z]|$)|egg_|_egg|تخم مرغ/.test(blob(gamaj))) gamajFailures.push('egg ingredient/search marker detected');
  if (!qeymeh) qeymehFailures.push('missing');
  if (qeymeh && /split_pea|split peas|لپه/.test(blob(qeymeh))) qeymehFailures.push('split pea ingredient/search marker detected');
  return {
    gamaj: { status: gamajFailures.length ? 'FAIL' : 'PASS', failures: gamajFailures },
    qeymeh: { status: qeymehFailures.length ? 'FAIL' : 'PASS', failures: qeymehFailures },
  };
}
