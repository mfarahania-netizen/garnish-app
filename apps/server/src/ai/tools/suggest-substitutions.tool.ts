import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiTool, ToolContext } from '../ai-core.types';
import { norm, toStringArray, looseMatch, clampLimit } from './grounding-utils';
import { foldPersian, isConfidentIngredientMatch } from './persian-search';
import { allergensConflict, extractDictionaryAllergens } from '../../recipes/intelligence/recipe-integrity';

/**
 * Pick the best dictionary row for a free-text ingredient term. A bare `contains` + take-1 returns an
 * arbitrary first row, so «کره» could resolve to «کره بادام» (almond butter). Prefer, in order: an EXACT
 * fold-match; a CONFIDENT base+modifier match («کره»→«کره شور», NOT «کره سیب»), shortest first; else the
 * shortest name as a best-effort. The chat path additionally GATES on a confident match (see orchestration).
 */
function pickBestIngredientMatch(rows: any[], query: string): any | null {
  if (!rows?.length) return null;
  const fq = foldPersian(query);
  const byLenFa = (a: any, b: any) => (foldPersian(a?.nameFa).length || 9999) - (foldPersian(b?.nameFa).length || 9999);
  const exact = rows.find((r) => [r?.nameFa, r?.nameEn, r?.code].some((n) => n && foldPersian(n) === fq));
  if (exact) return exact;
  const confident = rows
    .filter((r) => [r?.nameFa, r?.nameEn].some((n) => isConfidentIngredientMatch(query, n)))
    .sort(byLenFa);
  if (confident.length) return confident[0];
  return [...rows].sort(byLenFa)[0];
}

/**
 * suggest_substitutions (E47-L4 · rebuilt 2026-06-23) — REAL, read-only, grounded in the frozen ingredient
 * dictionary. The deterministic SubstitutionEngine: ZERO LLM, world-class answers from curated data.
 *
 * Sources, in priority:
 *   1. the source ingredient's CURATED `substitutionOptions` — rich objects {replaceWithIngredientId, reason,
 *      impact{taste/texture/nutrition/allergenRisk}, confidence, notesFa, bestUseCases} (also accepts the legacy
 *      bare-string form). These are authoritative.
 *   2. same-`category` peers (same culinary role) — fallback ONLY when the ingredient has NO curated data yet.
 *
 * Rebuild fixes (the old version silently threw the curated data away):
 *   - the curated objects key the target by `replaceWithIngredientId` (often with NO `name`), so the old
 *     `toStringArray()` returned [] → curatedCount=0 → it fell through to coarse same-category junk
 *     (سیب‌زمینی→گوجه). Now we RESOLVE replaceWithIngredientId → the real ingredient name + surface the rich
 *     reason/impact/confidence/notes, and rank by confidence.
 *   - SAFETY: both the curated targets AND the same-category peers are now allergy-filtered via the canonical
 *     `allergensConflict` over the RESOLVED substitute's dictionary allergens (the old code checked neither — curated
 *     options carried allergens:[], and `toStringArray(peer.allergens)` returned [] on the {eu14,…} shape, so an
 *     allergic user could be offered an unsafe swap). Over-warn is safe; under-warn is not.
 *
 * Grounding & degradation (no fabrication): ingredient not in dictionary → 'ingredient_not_found'; found but no
 * curated + no same-category data → 'no_substitution_data'; DB error → 'unavailable'. No new ingredient IDs are
 * ever produced. No medical/health claims (the assist layer also routes NL notes through the nutrition-claim guard).
 */

type CuratedOption = {
  replaceWithIngredientId?: string;
  name?: string;
  reason?: string; // short code, e.g. 'availability', 'taste_match'
  notesFa?: string;
  note?: string;
  confidence?: string; // high | medium | low
  impact?: { taste?: string; texture?: string; nutrition?: string; allergenRisk?: string };
  bestUseCases?: string[];
};

const CONFIDENCE_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };

/** Accepts the rich object form AND the legacy bare-string form (a string becomes {name}). */
function parseCuratedOptions(raw: unknown): CuratedOption[] {
  let v: unknown = raw;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(v)) return [];
  const out: CuratedOption[] = [];
  for (const o of v) {
    if (typeof o === 'string' && o.trim()) out.push({ name: o.trim() });
    else if (o && typeof o === 'object' && !Array.isArray(o)) out.push(o as CuratedOption);
  }
  return out;
}

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
    const avoidAllergens = toStringArray(input.avoidAllergens).map((s) => s.trim()).filter(Boolean);
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
      nutritionConfidence: true,
    } as const;

    let source: any = null;
    let curatedOptions: CuratedOption[] = [];
    const refById = new Map<string, any>();
    const refByName = new Map<string, any>();
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
        take: 12, // pull a few so we can prefer an EXACT/base match over an arbitrary first compound
        select,
      });
      source = pickBestIngredientMatch(matches, input.ingredient as string);

      if (source) {
        curatedOptions = parseCuratedOptions(source.substitutionOptions);
        // batch-resolve the referenced substitute ingredients (name + allergens) in ONE query
        const refIds = [...new Set(curatedOptions.map((o) => o.replaceWithIngredientId).filter(Boolean) as string[])];
        if (refIds.length) {
          const refs = await this.prisma.ingredient.findMany({ where: { id: { in: refIds } }, select });
          for (const r of refs) refById.set(r.id, r);
        }
        // SAFETY: also resolve NAME-only curated options (no replaceWithIngredientId) by EXACT dictionary name, so
        // we recover the substitute's real allergens before the allergy filter (else they would pass unchecked).
        const nameOnly = [
          ...new Set(
            curatedOptions
              .filter((o) => !o.replaceWithIngredientId && typeof o.name === 'string')
              .map((o) => (o.name as string).trim())
              .filter(Boolean),
          ),
        ];
        if (nameOnly.length) {
          const byNameRefs = await this.prisma.ingredient.findMany({
            where: { OR: [{ nameFa: { in: nameOnly } }, { nameEn: { in: nameOnly } }] },
            select,
          });
          const ambiguous = new Set<string>();
          for (const r of byNameRefs) {
            for (const n of [r.nameFa, r.nameEn]) {
              if (!n) continue;
              const k = norm(n);
              const existing = refByName.get(k);
              if (existing && existing.id !== r.id) ambiguous.add(k); // two DIFFERENT ingredients share a name
              else refByName.set(k, r);
            }
          }
          // SAFETY: an ambiguous name has no single allergen profile → drop it from the resolver so the candidate
          // becomes allergensKnown=false → fail-closed under an active allergy filter (never guess the safe twin).
          for (const k of ambiguous) refByName.delete(k);
        }
        // same-category peers ONLY when there is no curated data (pre-enrichment long tail)
        const sourceLocked =
          typeof source.nutritionConfidence === 'string' && source.nutritionConfidence.startsWith('source_locked');
        const useCuratedOnly = curatedOptions.length > 0 || sourceLocked;
        if (source.category && !useCuratedOnly) {
          categoryPeers = await this.prisma.ingredient.findMany({
            where: { category: source.category, NOT: { id: source.id } },
            take: 24,
            select,
          });
        }
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
    const isDisliked = (name: string) => dislikes.some((d) => looseMatch(name, d));

    type Cand = {
      name: string;
      ingredientId: string | null;
      basis: 'explicit_option' | 'same_category';
      sharedCategory: string | null;
      allergens: string[]; // canonical dictionary allergens of the SUBSTITUTE
      allergensKnown: boolean; // true iff resolved to a dictionary entry (else allergens are UNVERIFIED → fail-closed)
      confidence: string | null;
      reasonCode: string | null;
      why: string | null; // human Persian explanation (curated notesFa) or a generated same-role reason
      impact: CuratedOption['impact'] | null;
      bestUseCases: string[];
      rank: number;
    };

    const seen = new Set<string>([norm(sourceName)]);
    const candidates: Cand[] = [];

    // 1) CURATED options (authoritative) — resolve name + allergens from the referenced ingredient
    for (const opt of curatedOptions) {
      // resolve by id first, then by exact name (recovers allergens for the name-only shape)
      const ref =
        (opt.replaceWithIngredientId && refById.get(opt.replaceWithIngredientId)) ||
        (opt.name && refByName.get(norm(opt.name))) ||
        null;
      // prefer the RESOLVED name so the displayed substitute always matches the entry whose allergens we filtered
      const name = (ref?.nameFa || ref?.nameEn || opt.name || '').trim();
      if (!name) continue;
      const key = norm(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      candidates.push({
        name,
        ingredientId: ref?.id ?? opt.replaceWithIngredientId ?? null,
        basis: 'explicit_option',
        sharedCategory: source.category ?? null,
        allergens: ref ? extractDictionaryAllergens(ref.allergens) : [],
        allergensKnown: !!ref,
        confidence: typeof opt.confidence === 'string' ? opt.confidence : null,
        reasonCode: typeof opt.reason === 'string' ? opt.reason : null,
        why: (opt.notesFa || opt.note || '').trim() || null,
        impact: opt.impact && typeof opt.impact === 'object' ? opt.impact : null,
        bestUseCases: Array.isArray(opt.bestUseCases) ? opt.bestUseCases.map(String) : [],
        rank: CONFIDENCE_RANK[String(opt.confidence)] ?? 2, // default mid
      });
    }
    // 2) same-category peers (only populated when there is no curated data)
    for (const peer of categoryPeers) {
      const name = peer.nameFa || peer.nameEn || peer.code;
      const key = norm(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      candidates.push({
        name,
        ingredientId: peer.id,
        basis: 'same_category',
        sharedCategory: peer.category ?? null,
        allergens: extractDictionaryAllergens(peer.allergens),
        allergensKnown: true, // peers always come from a resolved dictionary row
        confidence: null,
        reasonCode: null,
        why: `هم‌نقش با «${sourceName}» (هر دو در دستهٔ «${peer.category ?? '؟'}»)`,
        impact: null,
        bestUseCases: [],
        rank: 0,
      });
    }

    // curated first, then by confidence (stable for equal rank)
    candidates.sort((a, b) => (a.basis === b.basis ? b.rank - a.rank : a.basis === 'explicit_option' ? -1 : 1));

    const dropped: { name: string; allergen: string }[] = [];
    const substitutions: Array<{
      name: string;
      ingredientId: string | null;
      basis: 'explicit_option' | 'same_category';
      sharedCategory: string | null;
      confidence: string | null;
      reasonCode: string | null;
      reason: string;
      why: string | null;
      impact: CuratedOption['impact'] | null;
      bestUseCases: string[];
      allergenNote: string | null;
    }> = [];

    for (const c of candidates) {
      if (isDisliked(c.name)) continue;
      // SAFETY (fail-closed): when an allergy filter is active, NEVER offer a swap whose allergens we could not
      // verify against the dictionary — drop the unverifiable ones (over-warn), then canonical-match the rest.
      if (avoidAllergens.length) {
        if (!c.allergensKnown) {
          dropped.push({ name: c.name, allergen: 'نامشخص (آلرژنِ تأییدنشده)' });
          continue;
        }
        const conflicts = allergensConflict(c.allergens, avoidAllergens);
        if (conflicts.length) {
          dropped.push({ name: c.name, allergen: conflicts[0] });
          continue;
        }
      }
      const reason =
        c.basis === 'explicit_option'
          ? `جایگزینِ ثبت‌شده برای «${sourceName}»${c.confidence ? ` (اطمینان: ${c.confidence})` : ''}`
          : `هم‌نقش با «${sourceName}» (دستهٔ «${c.sharedCategory ?? '؟'}»)`;
      substitutions.push({
        name: c.name,
        ingredientId: c.ingredientId,
        basis: c.basis,
        sharedCategory: c.sharedCategory,
        confidence: c.confidence,
        reasonCode: c.reasonCode,
        reason,
        why: c.why,
        impact: c.impact,
        bestUseCases: c.bestUseCases,
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
