import { normalizeIngredientText } from './ingredient-normalize';

/**
 * Pure, DB-free resolution core (E11). Kept separate from the Nest service so it
 * can be unit-tested without a database. Maps free ingredient text -> ingredientId
 * via three normalized indexes, tried in priority order: alias -> name -> code.
 */

export type MatchType = 'alias' | 'name' | 'code' | 'miss';

export interface ResolverIngredient {
  id: string;
  nameFa?: string | null;
  nameEn?: string | null;
  code?: string | null;
  recipeInputAliases?: unknown; // string[] | null (Prisma Json)
}

export interface ResolverIndex {
  alias: Map<string, string>;
  name: Map<string, string>;
  code: Map<string, string>;
  size: number;
}

export interface ResolveResult {
  ingredientId: string | null;
  matchType: MatchType;
  input: string;
  normalized: string;
}

function asAliasArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  return [];
}

export function buildResolverIndex(ingredients: ResolverIngredient[]): ResolverIndex {
  const alias = new Map<string, string>();
  const name = new Map<string, string>();
  const code = new Map<string, string>();

  for (const ing of ingredients) {
    const id = String(ing.id);

    for (const a of asAliasArray(ing.recipeInputAliases)) {
      const key = normalizeIngredientText(a);
      if (key && !alias.has(key)) alias.set(key, id);
    }
    if (ing.nameFa) {
      const key = normalizeIngredientText(ing.nameFa);
      if (key && !name.has(key)) name.set(key, id);
    }
    if (ing.nameEn) {
      const key = normalizeIngredientText(ing.nameEn);
      if (key && !name.has(key)) name.set(key, id);
    }
    if (ing.code) {
      const key = String(ing.code).toLowerCase().trim();
      if (key && !code.has(key)) code.set(key, id);
    }
  }

  return { alias, name, code, size: ingredients.length };
}

export function resolveWithIndex(index: ResolverIndex, rawText: string): ResolveResult {
  const input = rawText ?? '';
  const normalized = normalizeIngredientText(input);
  if (!normalized) {
    return { ingredientId: null, matchType: 'miss', input, normalized };
  }

  const aliasId = index.alias.get(normalized);
  if (aliasId) return { ingredientId: aliasId, matchType: 'alias', input, normalized };

  const nameId = index.name.get(normalized);
  if (nameId) return { ingredientId: nameId, matchType: 'name', input, normalized };

  const codeId = index.code.get(normalized) ?? index.code.get(String(input).toLowerCase().trim());
  if (codeId) return { ingredientId: codeId, matchType: 'code', input, normalized };

  return { ingredientId: null, matchType: 'miss', input, normalized };
}
