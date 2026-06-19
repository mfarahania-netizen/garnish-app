// apps/server/src/behavior-engine/signals/signal-calculator.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ingredientSalience,
  ingredientDelta,
  clampIngredientSignal,
  SALIENCE_DEFAULT,
  ING_CONF_STEP,
  ING_CONF_FLOOR,
} from './ingredient-salience';

// FI-PHASE-2.3: corpus ingredient document-frequency cache for IDF salience. Recipes are near-static
// pre-launch, so a memoized snapshot (with a TTL) avoids a corpus scan per feedback event.
const SALIENCE_TTL_MS = 6 * 60 * 60 * 1000;

@Injectable()
export class SignalCalculatorService {
  constructor(private prisma: PrismaService) {}

  private salienceCache: { map: Map<string, number>; builtAt: number } | null = null;

  async updateSignal(
    userId: string,
    signalName: string,
    signalDomain: string,
    signalType: string,
    rawValue: number,
    eventCount: number,
  ) {
    const existing = await this.prisma.userBehaviorSignal.findUnique({
      where: { userId_signalName: { userId, signalName } },
    });

    const halfLifeDays = this.getHalfLife(signalDomain);

    let decayedValue = rawValue;
    if (existing) {
      const daysSinceLast = (Date.now() - existing.lastDetected.getTime()) / (1000 * 60 * 60 * 24);
      const decayFactor = Math.exp(-Math.LN2 * (daysSinceLast / halfLifeDays));
      decayedValue = existing.value * decayFactor + rawValue * (1 - decayFactor);
    }

    const recencyFactor = Math.exp(-0.1 * (existing ? (Date.now() - existing.lastDetected.getTime()) / (1000 * 60 * 60 * 24) : 0));
    const frequencyFactor = Math.min(1, eventCount / 20);
    const confidence = (recencyFactor * 0.4) + (frequencyFactor * 0.6);

    return this.prisma.userBehaviorSignal.upsert({
      where: { userId_signalName: { userId, signalName } },
      create: {
        userId,
        signalName,
        signalDomain,
        signalType,
        value: decayedValue,
        confidence,
        halfLifeDays,
        sampleSize: eventCount,
        lastDetected: new Date(),
      },
      update: {
        value: decayedValue,
        confidence,
        halfLifeDays,
        sampleSize: eventCount,
        lastDetected: new Date(),
      },
    });
  }

  private getHalfLife(domain: string): number {
    switch (domain) {
      case 'nutrition': return 90;
      case 'health': return 30;
      case 'engagement': return 60;
      case 'identity': return 365;
      default: return 30;
    }
  }

  async applyNegativeFeedback(userId: string, recipeId: string, factor: number) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      select: {
        ingredients: { select: { name: true, ingredientId: true } },
        categories: true,
        diet: true,
      },
    });

    if (!recipe) return;

    const signalNames = this.extractSignalsFromRecipe(recipe);

    for (const signalName of signalNames) {
      const existing = await this.prisma.userBehaviorSignal.findUnique({
        where: { userId_signalName: { userId, signalName } },
      });

      if (existing) {
        const newValue = Math.max(0, existing.value + factor);
        await this.prisma.userBehaviorSignal.update({
          where: { userId_signalName: { userId, signalName } },
          data: {
            value: newValue,
            confidence: existing.confidence * 0.9,
            updatedAt: new Date(),
          },
        });
      }
    }

    // FI-PHASE-2.3: weak, salience-weighted per-ingredient AVERSION (additive, soft — never a hard veto).
    await this.applyIngredientSignals(userId, recipe.ingredients, -1);
  }

  async applyPositiveFeedback(userId: string, recipeId: string, factor: number) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      select: {
        ingredients: { select: { name: true, ingredientId: true } },
        categories: true,
        diet: true,
      },
    });

    if (!recipe) return;

    const signalNames = this.extractSignalsFromRecipe(recipe);

    // FI-PHASE-2.3: weak, salience-weighted per-ingredient AFFINITY (additive, soft).
    await this.applyIngredientSignals(userId, recipe.ingredients, +1);

    for (const signalName of signalNames) {
      const newValue = Math.min(1, 0.5 + factor);
      await this.prisma.userBehaviorSignal.upsert({
        where: { userId_signalName: { userId, signalName } },
        create: {
          userId,
          signalName,
          signalDomain: 'taste',
          signalType: 'behavior',
          value: 0.5 + factor,
          confidence: 0.3,
          sampleSize: 1,
          lastDetected: new Date(),
        },
        update: {
          value: newValue,
          sampleSize: { increment: 1 },
          lastDetected: new Date(),
        },
      });
    }
  }

  /**
   * FI-PHASE-2.3 — write the SOFT per-ingredient signal. For each ingredient that has an `ing_*` id, apply a
   * weak, IDF-salience-weighted, √K-attributed signed delta (direction -1 reject / +1 cook) to a signed
   * UserBehaviorSignal whose name IS the ingredientId (round-trips to `signal_ing_*`). Confidence accumulates
   * with repeated evidence. ADDITIVE: the coarse likes_* signals are untouched; this never reaches a hard veto.
   */
  private async applyIngredientSignals(
    userId: string,
    ingredients: Array<{ ingredientId?: string | null }> | undefined,
    direction: number,
  ) {
    const ided = (ingredients || []).filter((i) => i.ingredientId);
    if (ided.length === 0) return;

    const salienceMap = await this.getIngredientSalienceMap();
    for (const ing of ided) {
      const ingredientId = ing.ingredientId as string;
      const salience = salienceMap.get(ingredientId) ?? SALIENCE_DEFAULT;
      const delta = ingredientDelta(direction, salience, ided.length);
      if (Math.abs(delta) < 1e-4) continue; // ubiquitous ingredient → negligible, skip the write
      await this.upsertIngredientSignal(userId, ingredientId, delta);
    }
  }

  private async upsertIngredientSignal(userId: string, signalName: string, delta: number) {
    const existing = await this.prisma.userBehaviorSignal.findUnique({
      where: { userId_signalName: { userId, signalName } },
    });
    // FI-PHASE-4.1: an explicit user correction outranks inferred behavior — never silently overwrite it.
    if (existing?.signalType === 'ingredient_correction') return;
    const value = clampIngredientSignal((existing?.value ?? 0) + delta);
    const confidence = Math.min(1, (existing?.confidence ?? ING_CONF_FLOOR) + ING_CONF_STEP);
    await this.prisma.userBehaviorSignal.upsert({
      where: { userId_signalName: { userId, signalName } },
      create: {
        userId,
        signalName,
        signalDomain: 'taste',
        signalType: 'ingredient_preference',
        value,
        confidence: ING_CONF_FLOOR + ING_CONF_STEP,
        halfLifeDays: 30,
        sampleSize: 1,
        lastDetected: new Date(),
      },
      update: {
        value,
        confidence,
        sampleSize: { increment: 1 },
        lastDetected: new Date(),
      },
    });
  }

  /** corpus ingredient document-frequency → IDF salience map, memoized with a TTL. */
  private async getIngredientSalienceMap(): Promise<Map<string, number>> {
    if (this.salienceCache && Date.now() - this.salienceCache.builtAt < SALIENCE_TTL_MS) {
      return this.salienceCache.map;
    }
    const map = new Map<string, number>();
    try {
      const n = await this.prisma.recipe.count();
      const groups = await this.prisma.recipeIngredient.groupBy({
        by: ['ingredientId'],
        _count: { recipeId: true },
      } as any);
      for (const g of groups as Array<{ ingredientId: string | null; _count: { recipeId: number } }>) {
        if (!g.ingredientId) continue;
        map.set(g.ingredientId, ingredientSalience(g._count.recipeId, n));
      }
    } catch {
      // resilient: if the corpus can't be read, every ingredient falls back to neutral salience
    }
    this.salienceCache = { map, builtAt: Date.now() };
    return map;
  }

  private extractSignalsFromRecipe(recipe: any): string[] {
    const signals = new Set<string>();

    for (const ing of recipe.ingredients) {
      const name = (ing.name as string).toLowerCase();
      if (name.includes('مرغ')) signals.add('likes_chicken');
      if (name.includes('گوشت')) signals.add('likes_beef');
      if (name.includes('فلفل') || name.includes('تند')) signals.add('likes_spicy');
      if (name.includes('پنیر')) signals.add('likes_cheese');
      if (name.includes('ماهی') || name.includes('میگو')) signals.add('likes_seafood');
      if (name.includes('بادمجان')) signals.add('likes_eggplant');
      if (name.includes('قارچ')) signals.add('likes_mushroom');
    }

    // تشخیص روش پخت از categories (JSON string)
    try {
      const cats = typeof recipe.categories === 'string' ? JSON.parse(recipe.categories) : recipe.categories;
      if (Array.isArray(cats)) {
        if (cats.some(c => c.includes('کباب') || c.includes('گریل'))) signals.add('likes_grilled');
        if (cats.some(c => c.includes('سرخ‌کردنی') || c.includes('سوخاری'))) signals.add('likes_fried');
        if (cats.some(c => c.includes('خورشت') || c.includes('آب‌پز'))) signals.add('likes_stew');
        if (cats.some(c => c.includes('فر'))) signals.add('likes_baked');
        if (cats.some(c => c.includes('بخارپز'))) signals.add('likes_steamed');
      }
    } catch {}

    if (recipe.diet === 'vegetarian' || recipe.diet === 'vegan') signals.add('prefers_vegetarian');
    if (recipe.diet === 'ketogenic') signals.add('prefers_keto');

    return Array.from(signals);
  }
}