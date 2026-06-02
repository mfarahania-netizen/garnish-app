import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface FilterRule {
  name: string;
  apply: (recipes: any[]) => any[];
}

@Injectable()
export class PersonalizationService {
  constructor(private prisma: PrismaService) {}

  async getUserRules(userId: string): Promise<FilterRule[]> {
    const profile = await this.prisma.userPreference.findUnique({
      where: { userId },
    });

    const rules: FilterRule[] = [];
    if (!profile) return rules;

    // آلرژی‌ها از جدول واسط
    const userAllergies = await this.prisma.userAllergy.findMany({
      where: { userId },
      include: { allergy: true },
    });
    const allergyNames = userAllergies.map(ua => ua.allergy.name);

    if (allergyNames.length > 0) {
      rules.push({
        name: 'allergy-filter',
        apply: (recipes) =>
          recipes.filter((recipe) => {
            const recipeAllergens = recipe.allergens ? JSON.parse(recipe.allergens) : [];
            return !allergyNames.some((allergy) => recipeAllergens.includes(allergy));
          }),
      });
    }

    if (profile.diet) {
      if (profile.diet === 'vegetarian') {
        rules.push({
          name: 'diet-vegetarian',
          apply: (recipes) => recipes.filter((r) => r.diet === 'vegetarian' || r.diet === 'vegan'),
        });
      } else if (profile.diet === 'vegan') {
        rules.push({
          name: 'diet-vegan',
          apply: (recipes) => recipes.filter((r) => r.diet === 'vegan'),
        });
      }
    }

    if (profile.budget) {
      rules.push({
        name: 'budget-priority',
        apply: (recipes) => {
          const costOrder: Record<string, number> = { 'کم‌هزینه': 1, 'متوسط': 2, 'گران': 3 };
          recipes.sort((a, b) => (costOrder[a.cost] || 99) - (costOrder[b.cost] || 99));
          return recipes;
        },
      });
    }

    if (profile.skillLevel === 'beginner') {
      rules.push({
        name: 'skill-beginner',
        apply: (recipes) => recipes.filter((r) => r.difficulty !== 'سخت'),
      });
    }

    return rules;
  }

  applyRules(recipes: any[], rules: FilterRule[]): any[] {
    let result = [...recipes];
    for (const rule of rules) {
      result = rule.apply(result);
    }
    return result;
  }
}