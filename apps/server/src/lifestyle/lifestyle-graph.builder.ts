// apps/server/src/lifestyle/lifestyle-graph.builder.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LifestyleGraphBuilder {
  constructor(private prisma: PrismaService) {}

  async build(userId: string): Promise<Record<string, number>> {
    // گرفتن ابعاد هویت و سیگنال‌های کاربر
    const [dimensions, signals] = await Promise.all([
      this.prisma.userIdentityDimension.findMany({ where: { userId } }),
      this.prisma.userBehaviorSignal.findMany({ where: { userId } }),
    ]);

    const dimMap = new Map(dimensions.map(d => [d.dimensionKey, d.value]));
    const signalMap = new Map(signals.map(s => [s.signalName, s.value]));

    const lifestyle: Record<string, number> = {};

    // ۱. Time Rich / Time Poor (بر اساس consistency و cooking frequency)
    const consistency = dimMap.get('consistency') || 0;
    lifestyle['time_poor'] = consistency > 0.7 ? 0.8 : 0.2; // کاربر منظم = احتمالاً وقت‌شناس

    // ۲. Budget Sensitive (حساسیت به قیمت)
    const budgetSensitivity = dimMap.get('budget_sensitivity') || 0;
    lifestyle['budget_sensitive'] = budgetSensitivity > 0.5 ? 0.8 : 0.3;

    // ۳. Health Driven (سلامت‌محور)
    const healthConsciousness = dimMap.get('health_consciousness') || 0;
    lifestyle['health_driven'] = healthConsciousness > 0.5 ? 0.9 : 0.2;

    // ۴. Family Driven (خانواده‌محور)
    const familyCoordinator = dimMap.get('family_coordinator') || 0;
    lifestyle['family_driven'] = familyCoordinator > 0.5 ? 0.85 : 0.15;

    // ۵. Convenience Driven (راحت‌طلب)
    // اگر کاربر وقت‌شناس باشد و به دنبال غذاهای سریع
    const cookingFrequency = signalMap.get('cooking_frequency') || 0;
    lifestyle['convenience_driven'] = (consistency > 0.7 && cookingFrequency > 0.6) ? 0.7 : 0.3;

    // ۶. Explorer (کاوشگر)
    const foodExplorer = dimMap.get('food_explorer') || 0;
    lifestyle['explorer'] = foodExplorer > 0.5 ? 0.9 : 0.2;

    // ۷. Routine Oriented (روال‌گرا)
    lifestyle['routine_oriented'] = consistency > 0.8 ? 0.9 : 0.3;

    return lifestyle;
  }

  /**
   * تعیین برچسب اصلی سبک زندگی
   */
  async getPrimaryLabel(userId: string): Promise<string> {
    const lifestyle = await this.build(userId);
    const entries = Object.entries(lifestyle);
    entries.sort((a, b) => b[1] - a[1]);
    const topLabel = entries[0][0];
    
    const labels: Record<string, string> = {
      'time_poor': 'Busy Professional',
      'budget_sensitive': 'Budget Planner',
      'health_driven': 'Health Optimizer',
      'family_driven': 'Family Coordinator',
      'convenience_driven': 'Convenience Seeker',
      'explorer': 'Food Explorer',
      'routine_oriented': 'Routine Lover',
    };

    return labels[topLabel] || 'Balanced User';
  }
}