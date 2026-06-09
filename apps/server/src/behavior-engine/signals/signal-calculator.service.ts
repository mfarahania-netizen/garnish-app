// apps/server/src/behavior-engine/signals/signal-calculator.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SignalCalculatorService {
  constructor(private prisma: PrismaService) {}

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
        ingredients: { select: { name: true } },
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
  }

  async applyPositiveFeedback(userId: string, recipeId: string, factor: number) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      select: {
        ingredients: { select: { name: true } },
        categories: true,
        diet: true,
      },
    });

    if (!recipe) return;

    const signalNames = this.extractSignalsFromRecipe(recipe);

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