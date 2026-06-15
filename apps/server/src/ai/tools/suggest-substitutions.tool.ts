import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiTool, ToolContext } from '../ai-core.types';
import { norm, toStringArray, looseMatch, clampLimit } from './grounding-utils';

/**
 * suggest_substitutions (E47-L4) — REAL, read-only, grounded in the frozen ingredient dictionary.
 *
 * Given an ingredient (+ optional allergen / dislike constraints), returns safe substitutions drawn
 * ONLY from ingredients that already exist in the dictionary:
 *   1. the source ingredient's own `substitutionOptions` (explicit, highest-confidence), then
 *   2. other ingredients sharing its `category`/`subCategory` (same culinary role).
 * Allergen-aware: any candidate whose allergens intersect the user's `avoidAllergens` is dropped.
 * Explainable: each result states WHY (explicit option vs same-role) and any allergen note.
 *
 * Grounding & degradation (no fabrication):
 *   - ingredient not in the dictionary            -> resultStatus 'ingredient_not_found'
 *   - found but no options + no same-category data -> resultStatus 'no_substitution_data'
 *   - DB error                                     -> resultStatus 'unavailable'
 * NO new ingredient IDs are ever produced. NO medical/health claims (the assist layer also routes the
 * NL `note` through the nutrition-claim guard).
 */
@Injectable()
export class SuggestSubstitutionsTool implements AiTool {
  readonly name = 'suggest_substitutions';
  readonly description =
    'Suggest safe ingredient substitutions from the existing ingredient dictionary, allergen-aware and explainable. Read-only.';
  readonly inputSchema = {
    ingredient: 'string',
    avoidAllergens: 'string[]?',
    dislikes: 'string[]?',
    limit: 'number?',
  };

  constructor(private readonly prisma: PrismaService) {}

  async handler(input: Record<string, unknown>, _ctx: ToolContext) {
    const query = norm(input.ingredient);
    const avoidAllergens = toStringArray(input.avoidAllergens).map(norm);
    const dislikes = toStringArray(input.dislikes).map(norm);
    const limit = clampLimit(input.limit, 6, 12);

    if (query.length < 2) {
      return { tool: this.name, ingredient: query, resolved: null, substitutions: [], resultStatus: 'empty_query' };
    }

    const select = {
      id: true,
      nameFa: true,
      nameEn: true,
      code: true,
      category: true,
      subCategory: true,
      allergens: true,
      dietFlags: true,
      substitutionOptions: true,
    } as const;

    let source: any = null;
    let categoryPeers: any[] = [];
    try {
      const matches = await this.prisma.ingredient.findMany({
        where: {
          OR: [
            { nameFa: { contains: input.ingredient as string } },
            { nameEn: { contains: input.ingredient as string } },
            { code: { contains: input.ingredient as string } },
          ],
        },
        take: 1,
        select,
      });
      source = matches[0] ?? null;
      if (source?.category) {
        categoryPeers = await this.prisma.ingredient.findMany({
          where: { category: source.category, NOT: { id: source.id } },
          take: 24,
          select,
        });
      }
    } catch {
      return { tool: this.name, ingredient: query, resolved: null, substitutions: [], resultStatus: 'unavailable' };
    }

    if (!source) {
      return {
        tool: this.name,
        ingredient: query,
        resolved: null,
        substitutions: [],
        note: `«${input.ingredient}» در فرهنگ مواد اولیه پیدا نشد؛ نمی‌توانم جایگزینی بسازم.`,
        resultStatus: 'ingredient_not_found',
      };
    }

    const sourceName = source.nameFa || source.nameEn || source.code;
    const dropForAllergen = (allergens: string[]): string | null => {
      for (const a of allergens) if (avoidAllergens.some((av) => looseMatch(a, av))) return a;
      return null;
    };
    const isDisliked = (name: string) => dislikes.some((d) => looseMatch(name, d));

    type Cand = { name: string; basis: 'explicit_option' | 'same_category'; sharedCategory: string | null; allergens: string[] };
    const seen = new Set<string>([norm(sourceName)]);
    const candidates: Cand[] = [];

    // 1) explicit substitutionOptions (grounded in the source ingredient's own curated data)
    for (const optName of toStringArray(source.substitutionOptions)) {
      const key = norm(optName);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      candidates.push({ name: optName, basis: 'explicit_option', sharedCategory: source.category ?? null, allergens: [] });
    }
    // 2) same-category peers (same culinary role)
    for (const peer of categoryPeers) {
      const name = peer.nameFa || peer.nameEn || peer.code;
      const key = norm(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      candidates.push({ name, basis: 'same_category', sharedCategory: peer.category ?? null, allergens: toStringArray(peer.allergens) });
    }

    const dropped: { name: string; allergen: string }[] = [];
    const substitutions: {
      name: string;
      basis: 'explicit_option' | 'same_category';
      sharedCategory: string | null;
      reason: string;
      allergenNote: string | null;
    }[] = [];
    for (const c of candidates) {
      if (isDisliked(c.name)) continue;
      const blockedBy = dropForAllergen(c.allergens);
      if (blockedBy) {
        dropped.push({ name: c.name, allergen: blockedBy });
        continue;
      }
      const reason =
        c.basis === 'explicit_option'
          ? `جایگزین ثبت‌شده برای «${sourceName}»`
          : `هم‌نقش با «${sourceName}» (هر دو در دستهٔ «${c.sharedCategory ?? '؟'}»)`;
      substitutions.push({
        name: c.name,
        basis: c.basis,
        sharedCategory: c.sharedCategory,
        reason,
        allergenNote: avoidAllergens.length ? `بدون آلرژن‌های اعلام‌شده (${avoidAllergens.join('، ')})` : null,
      });
      if (substitutions.length >= limit) break;
    }

    if (substitutions.length === 0) {
      return {
        tool: this.name,
        ingredient: query,
        resolved: { id: source.id, name: sourceName, category: source.category ?? null },
        substitutions: [],
        dropped,
        note: `برای «${sourceName}» جایگزین مناسبی در داده‌ها ثبت نشده است.`,
        resultStatus: 'no_substitution_data',
      };
    }

    return {
      tool: this.name,
      ingredient: query,
      resolved: { id: source.id, name: sourceName, category: source.category ?? null },
      substitutions,
      dropped,
      note: `${substitutions.length} جایگزین برای «${sourceName}» از فرهنگ مواد اولیهٔ گارنیش پیشنهاد شد${dropped.length ? ` (${dropped.length} گزینه به‌خاطر آلرژن کنار گذاشته شد)` : ''}.`,
      resultStatus: 'ok',
    };
  }
}
