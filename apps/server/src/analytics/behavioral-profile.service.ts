import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BehavioralProfileService {
  constructor(private prisma: PrismaService) {}

  async updateOrCreateProfile(userId: string) {
    // 1. گرفتن همه رویدادهای کاربر (یا حداقل نمونه‌های اخیر)
    const events = await this.prisma.userEvent.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: 500,
    });

    // 2. محاسبه Favorite Foods (از رویدادهای favorite_add و recipe_view)
    const recipeCountMap = new Map<string, number>();
    for (const event of events) {
      try {
        const p = JSON.parse(event.payload || '{}');
        if (p.recipeId && ['recipe_view', 'favorite_add'].includes(event.type)) {
          recipeCountMap.set(p.recipeId, (recipeCountMap.get(p.recipeId) || 0) + 1);
        }
      } catch {}
    }
    const favoriteFoods = [...recipeCountMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id]) => id);

    // 3. محاسبه Shopping Pattern (از روی آیتم‌های لیست خرید)
    const shoppingItems = await this.prisma.shoppingItem.findMany({
      where: { shoppingList: { userId } },
      select: { name: true, isChecked: true },
    });
    const itemCounts = {};
    for (const item of shoppingItems) {
      itemCounts[item.name] = (itemCounts[item.name] || 0) + 1;
    }
    const shoppingPattern = Object.entries(itemCounts).map(([name, freq]) => ({ name, freq }));

    // 4. محاسبه Consistency Score (ساده: نسبت روزهای فعال به کل روزها)
    const daysWithEvents = new Set(events.map(e => e.timestamp.toISOString().slice(0, 10))).size;
    const totalDays = 30; // بازه ۳۰ روزه
    const consistencyScore = Math.min(daysWithEvents / totalDays, 1.0);

    // 5. ذخیره یا بروزرسانی پروفایل
    return this.prisma.userBehaviorProfile.upsert({
      where: { userId },
      update: {
        favoriteFoods: JSON.stringify(favoriteFoods),
        shoppingPattern: JSON.stringify(shoppingPattern),
        consistencyScore,
      },
      create: {
        userId,
        favoriteFoods: JSON.stringify(favoriteFoods),
        shoppingPattern: JSON.stringify(shoppingPattern),
        consistencyScore,
      },
    });
  }

  // متدی برای دریافت پروفایل فعلی
  async getProfile(userId: string) {
    return this.prisma.userBehaviorProfile.findUnique({ where: { userId } });
  }
}