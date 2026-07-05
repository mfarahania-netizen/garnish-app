import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
export const outDir = path.resolve(process.cwd(), '..', '..', 'docs', 'qa', 'recipes', 'resolve-authenticity-85-no-public-blockers');
export const previousDir = path.resolve(process.cwd(), '..', '..', 'docs', 'qa', 'recipes', 'resolve-authenticity-85');

export type BlockerRow = {
  recipeId: string;
  slug: string;
  titleFa: string;
  finalState?: string;
  isPublic?: string;
  recipeStatus?: string;
  reason?: string;
};

export function ensureOutDir() {
  fs.mkdirSync(outDir, { recursive: true });
}

export function writeJson(name: string, value: unknown) {
  ensureOutDir();
  fs.writeFileSync(path.join(outDir, name), JSON.stringify(value, null, 2), 'utf8');
}

export function writeMd(name: string, value: string) {
  ensureOutDir();
  fs.writeFileSync(path.join(outDir, name), value, 'utf8');
}

export function writeCsv(name: string, rows: Record<string, unknown>[], headers?: string[]) {
  ensureOutDir();
  const cols = headers ?? Object.keys(rows[0] ?? { empty: '' });
  const cell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const body = [cols.map(cell).join(',')]
    .concat(rows.map((row) => cols.map((header) => cell(row[header])).join(',')))
    .join('\n');
  fs.writeFileSync(path.join(outDir, name), `${body}\n`, 'utf8');
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
      } else {
        cell += ch;
      }
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
    } else if (ch !== '\r') {
      cell += ch;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [headers = [], ...data] = rows.filter((r) => r.some((v) => v.trim().length));
  return data.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

export function loadBlockers(): BlockerRow[] {
  const file = path.join(previousDir, 'final_public_launch_blockers.csv');
  const rows = parseCsv(fs.readFileSync(file, 'utf8')) as BlockerRow[];
  const uniqueIds = new Set(rows.map((row) => row.recipeId));
  if (rows.length !== 85 || uniqueIds.size !== 85) throw new Error(`EXPECTED_85_UNIQUE_BLOCKERS_FOUND_${rows.length}_${uniqueIds.size}`);
  return rows;
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

export function readJsonSafe(file: string, fallback: any = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
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
    title: recipe.title,
    description: recipe.description,
    category: recipe.category,
    region: recipe.region,
    mealType: recipe.mealType,
    categories: parseJson(recipe.categories, []),
    allergens: parseJson(recipe.allergens, []),
    gris: recipe.gris,
    ingredients: recipe.ingredients?.map((ri: any) => ({
      name: ri.name,
      amount: ri.amount,
      unit: ri.unit,
      notes: parseJson(ri.notes, ri.notes),
      ingredient: ri.ingredient,
    })),
    steps: recipe.steps?.map((step: any) => ({ title: step.title, instruction: step.instruction })),
    searchTerms: recipe.searchTerms?.map((term: any) => term.term),
  }).toLowerCase();
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

export function adminSlug(recipe: any, fallback = '') {
  return parseJson(recipe.adminNote, {})?.slug ?? fallback;
}

export function rollbackEntry(recipe: any, slugFallback = '') {
  return {
    recipeId: recipe.id,
    slug: adminSlug(recipe, slugFallback),
    titleFa: recipe.title,
    status: recipe.status,
    isPublic: recipe.isPublic,
    adminNote: recipe.adminNote,
    updatedAt: recipe.updatedAt,
  };
}

export function sourcePacket(row: BlockerRow, recipe: any) {
  return {
    recipeId: row.recipeId,
    slug: row.slug,
    titleFa: recipe?.title ?? row.titleFa,
    currentPublicStatus: { status: recipe?.status ?? null, isPublic: recipe?.isPublic ?? null },
    currentIngredientsSummary: (recipe?.ingredients ?? []).map((ri: any) => ({
      name: ri.name,
      code: ri.ingredient?.code ?? null,
      amount: ri.amount,
      unit: ri.unit,
      displayUnit: parseJson(ri.notes, {})?.displayUnit ?? null,
      preparation: parseJson(ri.notes, {})?.preparation ?? null,
    })),
    currentStepsSummary: (recipe?.steps ?? []).map((step: any) => ({ order: step.order, title: step.title, instruction: step.instruction })),
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
    confidence: 'LOW',
    decision: 'HIDE_PENDING_REVIEW',
    reason:
      'No defensible three-source packet or explicit product decision exists in the repository for launch. Per product rule, unresolved authenticity risk must not stay public.',
  };
}

export function finalStateRow(row: BlockerRow, recipe: any, state = 'HIDDEN_PENDING_REVIEW') {
  return {
    recipeId: row.recipeId,
    slug: row.slug,
    titleFa: recipe?.title ?? row.titleFa,
    finalState: state,
    status: recipe?.status ?? null,
    isPublic: recipe?.isPublic ?? null,
    reason:
      state === 'HIDDEN_PENDING_REVIEW'
        ? 'No source-backed or documented product-decision pass; hidden from public launch surfaces.'
        : '',
  };
}
