// apps/server/src/behavior-engine/signals/taste-correction.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { clampIngredientSignal } from './ingredient-salience';

/**
 * TasteCorrectionService (FI-PHASE-4.1) — let the user SEE and CORRECT the soft per-ingredient taste the
 * engine inferred from behavior ("به‌نظر عدس را دوست نداری — درسته؟").
 *
 * SAFE + ADDITIVE: a correction writes the SAME signed `UserBehaviorSignal` row the FI-2.3 ranker already
 * reads (signalName = ingredientId → feature `signal_ing_*`), so it takes effect with NO change to the
 * ranker or the feature-vector. It carries `signalType='ingredient_correction'`, which the behavioral
 * write-path (SignalCalculatorService.upsertIngredientSignal) treats as locked — an explicit user
 * statement is never silently overwritten by later behavior. This is SOFT taste only; it never touches the
 * declared-allergy hard filter (which reads only declared allergies, by design).
 */

export type TasteStance = 'like' | 'dislike' | 'neutral';

/** the signalType discriminator that marks a row as a durable, user-stated correction. */
export const CORRECTION_SIGNAL_TYPE = 'ingredient_correction';
/** the signalType the FI-2.3 behavioral path writes for inferred per-ingredient taste. */
export const INFERRED_SIGNAL_TYPE = 'ingredient_preference';

// correction magnitudes — within the FI-2.3 signed bounds [-1, +0.6]; a like stays gentle (preserves
// exploration), a stated dislike is firmer but still soft (down-ranks, never excludes).
const LIKE_VALUE = 0.5;
const DISLIKE_VALUE = -0.7;
// ignore negligible inferred noise in the user-facing list (corrections are always shown).
const SHOW_FLOOR = 0.05;
const MAX_ITEMS = 12;

export interface TastePreference {
  ingredientId: string;
  name: string;
  stance: 'like' | 'dislike';
  strength: number; // 0..1 magnitude of the signal
  confidence: number; // 0..1
  source: 'inferred' | 'you'; // learned from behavior vs. explicitly stated by the user
}

@Injectable()
export class TasteCorrectionService {
  constructor(private readonly prisma: PrismaService) {}

  /** Owner read: the inferred + user-stated per-ingredient taste, resolved to Persian names, most-salient first. */
  async listTastePreferences(userId: string): Promise<TastePreference[]> {
    const signals = await this.prisma.userBehaviorSignal.findMany({
      where: { userId, signalType: { in: [INFERRED_SIGNAL_TYPE, CORRECTION_SIGNAL_TYPE] } },
    });
    const meaningful = signals.filter(
      (s) => s.signalType === CORRECTION_SIGNAL_TYPE || Math.abs(s.value) >= SHOW_FLOOR,
    );
    if (meaningful.length === 0) return [];

    const ids = meaningful.map((s) => s.signalName);
    const ingredients = await this.prisma.ingredient.findMany({
      where: { id: { in: ids } },
      select: { id: true, nameFa: true, nameEn: true },
    });
    const nameById = new Map(ingredients.map((i) => [i.id, i.nameFa || i.nameEn || i.id]));

    return meaningful
      .filter((s) => nameById.has(s.signalName)) // only ingredients we can name honestly
      .map((s) => ({
        ingredientId: s.signalName,
        name: nameById.get(s.signalName) as string,
        stance: (s.value >= 0 ? 'like' : 'dislike') as 'like' | 'dislike',
        strength: Math.min(1, Math.abs(s.value)),
        confidence: Math.min(1, Math.max(0, s.confidence)),
        source: (s.signalType === CORRECTION_SIGNAL_TYPE ? 'you' : 'inferred') as 'inferred' | 'you',
      }))
      .sort((a, b) => b.strength * b.confidence - a.strength * a.confidence)
      .slice(0, MAX_ITEMS);
  }

  /**
   * Owner write: record an explicit correction for one ingredient.
   *  - 'like' / 'dislike' → a locked correction signal the ranker reads and behavior won't overwrite.
   *  - 'neutral' → delete the row, re-enabling behavioral learning for that ingredient (fully reversible).
   */
  async correctTastePreference(userId: string, ingredientId: string, stance: TasteStance) {
    if (!ingredientId || !['like', 'dislike', 'neutral'].includes(stance)) {
      return { ok: false as const, reason: 'invalid input' };
    }
    // never write an arbitrary/unknown signal name — the id must be a real ingredient.
    const ingredient = await this.prisma.ingredient.findUnique({
      where: { id: ingredientId },
      select: { id: true },
    });
    if (!ingredient) return { ok: false as const, reason: 'unknown ingredient' };

    if (stance === 'neutral') {
      await this.prisma.userBehaviorSignal.deleteMany({ where: { userId, signalName: ingredientId } });
      return { ok: true as const, ingredientId, stance };
    }

    const value = clampIngredientSignal(stance === 'like' ? LIKE_VALUE : DISLIKE_VALUE);
    await this.prisma.userBehaviorSignal.upsert({
      where: { userId_signalName: { userId, signalName: ingredientId } },
      create: {
        userId,
        signalName: ingredientId,
        signalDomain: 'taste',
        signalType: CORRECTION_SIGNAL_TYPE,
        value,
        confidence: 1,
        halfLifeDays: 365,
        sampleSize: 1,
        lastDetected: new Date(),
      },
      update: {
        signalType: CORRECTION_SIGNAL_TYPE,
        value,
        confidence: 1,
        halfLifeDays: 365,
        lastDetected: new Date(),
      },
    });
    return { ok: true as const, ingredientId, stance };
  }
}
