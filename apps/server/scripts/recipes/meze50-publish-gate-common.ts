import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
export const outDir = path.resolve(process.cwd(), '..', '..', 'docs', 'qa', 'recipes', 'meze50-publish-gate');

const REQUIRED_GRIS = ['story', 'glance', 'ingredients', 'steps', 'whyItWorks', 'skillsLearned', 'troubleshooting', 'variations', 'keep', 'serveWith', 'faq', 'nourishment', 'finish'];
const FORBIDDEN_COPY = [
  'کنار دستت بگذار',
  'مواد را آماده کنید',
  'طبق شخصیت غذا',
  'نشانهٔ درست این مرحله',
  'نشانه درست این مرحله',
  'ظاهر نهایی باید با هویت غذا هماهنگ باشد',
  'این توضیح عمومی است',
  'duplicate safety',
  'source-backed',
  'audit',
  'DB',
  'database',
  'ingredientId',
  'import',
  'USDA',
  'fdcId',
  'Codex',
];

export function ensureOutDir() { fs.mkdirSync(outDir, { recursive: true }); }
export function writeJson(name: string, value: unknown) { ensureOutDir(); fs.writeFileSync(path.join(outDir, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
export function writeMd(name: string, value: string) { ensureOutDir(); fs.writeFileSync(path.join(outDir, name), value, 'utf8'); }
export function writeCsv(name: string, rows: Record<string, unknown>[], headers: string[]) {
  ensureOutDir();
  const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.map(cell).join(',')]
    .concat(rows.map((row) => headers.map((header) => cell(row[header])).join(',')))
    .join('\n');
  fs.writeFileSync(path.join(outDir, name), `${csv}\n`, 'utf8');
}
export function getDbUrl() { return process.env.DATABASE_URL ?? ''; }
export function redactedDbUrl() { return getDbUrl().replace(/:\/\/.*@/, '://***@'); }
export function assertLocalDatabase() {
  const url = getDbUrl();
  const lower = url.toLowerCase();
  const local = lower.includes('localhost') || lower.includes('127.0.0.1') || lower.includes('host.docker.internal') || lower.includes('[::1]');
  const dangerous = /(prod|production|neon|supabase|render|railway|amazonaws|rds|azure|cloudsql|fly\.dev)/i.test(url);
  if (!local || dangerous) throw new Error(`DATABASE_URL_NOT_LOCAL_DEV:${redactedDbUrl()}`);
}
export function parseJson(value: unknown, fallback: any = null) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}
export function textValues(value: unknown): string {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (v == null) return;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') { out.push(String(v)); return; }
    if (Array.isArray(v)) return v.forEach(walk);
    if (typeof v === 'object') Object.values(v as Record<string, unknown>).forEach(walk);
  };
  walk(value);
  return out.join(' ');
}
export async function getCounts() {
  const [totalRecipes, activePublic, draftPrivate, ingredientCount, mezeTotal, mezePublic] = await Promise.all([
    prisma.recipe.count(),
    prisma.recipe.count({ where: { status: 'active', isPublic: true } }),
    prisma.recipe.count({ where: { NOT: { status: 'active', isPublic: true } } }),
    prisma.ingredient.count(),
    prisma.recipe.count({ where: { id: { startsWith: 'meze50_' } } }),
    prisma.recipe.count({ where: { id: { startsWith: 'meze50_' }, status: 'active', isPublic: true } }),
  ]);
  return { totalRecipes, activePublic, draftPrivate, ingredientCount, mezeTotal, mezePublic };
}
export async function loadMezeRecipes() {
  return prisma.recipe.findMany({
    where: { id: { startsWith: 'meze50_' } },
    orderBy: { id: 'asc' },
    include: {
      ingredients: { orderBy: { order: 'asc' }, include: { ingredient: true } },
      steps: { orderBy: { order: 'asc' } },
      searchTerms: true,
      nutrition: true,
    },
  });
}
export function slugOf(recipe: any) { return parseJson(recipe.adminNote, {})?.slug ?? recipe.id; }
export function rollbackEntry(recipe: any) {
  return {
    recipeId: recipe.id,
    slug: slugOf(recipe),
    titleFa: recipe.title,
    status: recipe.status,
    isPublic: recipe.isPublic,
    adminNote: recipe.adminNote,
    updatedAt: recipe.updatedAt,
  };
}
function publicText(recipe: any) {
  return textValues({
    title: recipe.title,
    description: recipe.description,
    category: recipe.category,
    mealType: recipe.mealType,
    categories: parseJson(recipe.categories, []),
    dishType: parseJson(recipe.dishType, []),
    allergens: parseJson(recipe.allergens, []),
    gris: recipe.gris,
    steps: recipe.steps?.map((step: any) => ({ title: step.title, instruction: step.instruction })),
    searchTerms: recipe.searchTerms?.map((term: any) => term.term),
  });
}
export function evaluateMeze(recipe: any, duplicateSlugSet: Set<string>, duplicateTitleSet: Set<string>) {
  const blockers: string[] = [];
  const slug = slugOf(recipe);
  const gris = recipe.gris && typeof recipe.gris === 'object' ? recipe.gris : null;
  const text = publicText(recipe);
  const lower = text.toLowerCase();
  const missingGris = REQUIRED_GRIS.filter((key) => !(gris && key in gris));
  const missingRelations = recipe.ingredients.filter((ri: any) => !ri.ingredientId || !ri.ingredient);
  const grisIngredientCount = Array.isArray(gris?.ingredients) ? gris.ingredients.length : 0;
  const grisStepCount = Array.isArray(gris?.steps) ? gris.steps.length : 0;
  const forbiddenTerms = FORBIDDEN_COPY.filter((term) => lower.includes(term.toLowerCase()) || text.includes(term));
  if (!recipe.id.startsWith('meze50_')) blockers.push('not a Meze 50 recipe id');
  if (!slug || duplicateSlugSet.has(slug)) blockers.push(`duplicate or missing slug: ${slug}`);
  if (!recipe.title || duplicateTitleSet.has(recipe.title.trim())) blockers.push(`duplicate or missing title: ${recipe.title}`);
  if (!recipe.ingredients.length) blockers.push('missing ingredient rows');
  if (missingRelations.length) blockers.push(`unresolved ingredient relations: ${missingRelations.map((ri: any) => ri.name).join('; ')}`);
  if (!recipe.steps.length && !grisStepCount) blockers.push('missing executable steps');
  if (!gris) blockers.push('missing GRIS payload');
  if (missingGris.length) blockers.push(`GRIS incomplete: ${missingGris.join(', ')}`);
  if (grisIngredientCount === 0) blockers.push('GRIS ingredients empty');
  if (grisStepCount === 0) blockers.push('GRIS steps empty');
  if (forbiddenTerms.length) blockers.push(`forbidden/internal copy terms: ${forbiddenTerms.join('; ')}`);
  if (/(ادعای پزشکی|توصیه پزشکی|درمان بیماری|درمان می‌کند|کاهش وزن قطعی|مناسب دیابت|مناسب بارداری)/i.test(text)) blockers.push('medical or strict diet claim risk');
  if (!/(meze|مز|مزه|snack|appetizer|پیش|دیپ|لقمه|بشقاب|سالاد|اسنک|small plate|mezze)/i.test(text)) blockers.push('meze/snack/appetizer identity not visible');
  const finalState = blockers.length ? 'KEEP_REVIEWONLY_WITH_EXACT_BLOCKER' : 'READY_TO_PUBLISH_AS_IS';
  return {
    recipeId: recipe.id,
    slug,
    titleFa: recipe.title,
    currentStatus: recipe.status,
    currentIsPublic: recipe.isPublic,
    ingredientCount: recipe.ingredients.length,
    stepCount: recipe.steps.length,
    grisIngredientCount,
    grisStepCount,
    missingGris,
    finalState,
    exactBlocker: blockers.join(' | '),
  };
}
export async function duplicateSetsForMeze(meze: any[]) {
  const mezeIds = new Set(meze.map((r) => r.id));
  const publicRows = await prisma.recipe.findMany({
    where: { status: 'active', isPublic: true, NOT: { id: { in: [...mezeIds] } } },
    select: { id: true, title: true, adminNote: true },
  });
  const publicSlugs = new Set(publicRows.map((row) => parseJson(row.adminNote, {})?.slug).filter(Boolean));
  const publicTitles = new Set(publicRows.map((row) => row.title?.trim()).filter(Boolean));
  return { duplicateSlugSet: publicSlugs, duplicateTitleSet: publicTitles };
}
export async function regressionStatus() {
  const [gamaj, qeymeh] = await Promise.all([
    prisma.recipe.findUnique({ where: { id: 'garnish_recipe_fa_104_7b4ced78' }, include: { ingredients: { include: { ingredient: true } }, searchTerms: true } }),
    prisma.recipe.findUnique({ where: { id: 'garnish_recipe_fa_170_44f0d2ad' }, include: { ingredients: { include: { ingredient: true } }, searchTerms: true } }),
  ]);
  const blob = (r: any) => textValues([...(r?.ingredients ?? []).flatMap((ri: any) => [ri.name, ri.ingredient?.code, ri.ingredient?.nameFa, ri.ingredient?.nameEn]), ...(r?.searchTerms ?? []).map((t: any) => t.term)]).toLowerCase();
  return {
    gamaj: !gamaj || /(^|[^a-z])egg([^a-z]|$)|egg_|_egg|تخم مرغ/.test(blob(gamaj)) ? 'FAIL' : 'PASS',
    qeymeh: !qeymeh || /split_pea|split peas|لپه/.test(blob(qeymeh)) ? 'FAIL' : 'PASS',
  };
}
