// apps/server/src/behavior-engine/processors/personalization.signal-processor.ts
import { Injectable } from '@nestjs/common';
import { isOptionalPurposeRuntimeEnabled } from '../../consent/consent.constants';
import { PrismaService } from '../../prisma/prisma.service';
import { SignalCalculatorService } from '../signals/signal-calculator.service';
import { safeJsonPayload, alreadyConsumed } from './safe-payload';
import type { OptionalProcessingTransactionClient } from '../../consent/optional-processing-transaction-boundary.service';

/**
 * P0-4 (recsys audit): the strongest in-session taste signals — portion_scaled / ingredient_swapped /
 * ingredient_removed — were emitted (usePersonalization.js) but had NO processor, so the engine never learned
 * from them. This handler:
 *  - ingredient_removed → a soft ingredient AVERSION (only if the name resolves to a real Ingredient).
 *  - ingredient_swapped → `from` aversion + `to` affinity (only the resolved sides; gentler affinity to keep
 *    exploration).
 *  - portion_scaled    → a routine/serving-size signal (family-size hint), NOT a taste signal.
 * HONESTY: an unresolved ingredient name makes NO learning claim — it is captured as an observation only.
 */
@Injectable()
export class PersonalizationSignalProcessor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly signalCalculator: SignalCalculatorService,
  ) {}

  async process(event: any, userId: string, tx: OptionalProcessingTransactionClient) {
    if (!isOptionalPurposeRuntimeEnabled('personalization')) return;
    if (await alreadyConsumed(tx, event.id)) return; // P0-6: skip a redelivered (at-least-once) event
    const payload = safeJsonPayload(event);
    const recipeId: string | undefined = typeof payload.recipeId === 'string' ? payload.recipeId : undefined;

    if (event.type === 'portion_scaled') {
      const servedFor = Number(payload.servedFor);
      if (servedFor > 0) {
        await tx.signalObservation.create({
          data: { userId, signalName: 'routine.serving_size', eventId: event.id, weight: 1.0, value: String(servedFor), recipeId },
        });
      }
      return;
    }

    if (event.type === 'ingredient_removed') {
      const id = await this.resolveIngredient(tx, payload.ingredient);
      if (id) await this.signalCalculator.applyIngredientPreferenceInLockedTransaction(tx, userId, id, -0.2);
      await this.record(tx, userId, event, recipeId, !!id);
      return;
    }

    if (event.type === 'ingredient_swapped') {
      const fromId = await this.resolveIngredient(tx, payload.from);
      const toId = await this.resolveIngredient(tx, payload.to);
      if (fromId) await this.signalCalculator.applyIngredientPreferenceInLockedTransaction(tx, userId, fromId, -0.2);
      if (toId) await this.signalCalculator.applyIngredientPreferenceInLockedTransaction(tx, userId, toId, 0.15);
      await this.record(tx, userId, event, recipeId, !!(fromId || toId));
      return;
    }
  }

  /** Resolve a free-text ingredient name to a real Ingredient id, or null. No resolve → no taste claim. */
  private async resolveIngredient(tx: OptionalProcessingTransactionClient, name: any): Promise<string | null> {
    const n = String(name ?? '').trim();
    if (n.length < 2) return null;
    const ing = await tx.ingredient.findFirst({
      where: { OR: [{ nameFa: { equals: n, mode: 'insensitive' } }, { nameEn: { equals: n, mode: 'insensitive' } }] },
      select: { id: true },
    });
    return ing?.id ?? null;
  }

  /** A reconstructable record of the action — dotted (reaches taste) when resolved, observation-only when not. */
  private async record(tx: OptionalProcessingTransactionClient, userId: string, event: any, recipeId: string | undefined, resolved: boolean) {
    await tx.signalObservation.create({
      data: { userId, signalName: resolved ? 'taste.personalization' : 'personalization_unresolved', eventId: event.id, weight: resolved ? 1.0 : 0.5, recipeId },
    });
  }
}
