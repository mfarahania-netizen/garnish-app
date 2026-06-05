import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { CONCEPT_MAP } from '../shared/constants'; // 👈 جدید

@Injectable()
export class AiService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async handlePrompt(prompt: string, userId?: string): Promise<string> {
    let userAllergies: string[] = [];
    let userProfile: any = null;

    if (userId) {
      userProfile = await this.prisma.userPreference.findUnique({
        where: { userId },
      });

      if (userProfile) {
        const allergies = await this.prisma.userAllergy.findMany({
          where: { userId },
          include: { allergy: true },
        });
        userAllergies = allergies.map(ua => ua.allergy.name);
      }
    }

    let ingredients: string[] = [];
    let fromConcept = false;

    const conceptKey = this.findConceptKey(prompt);
    if (conceptKey) {
      ingredients = CONCEPT_MAP[conceptKey];
      fromConcept = true;
    } else if (prompt.length < 3) {
      ingredients = this.extractIngredients(prompt);
    } else {
      const expanded = await this.expandConcept(prompt);
      if (expanded.length > 0) {
        ingredients = expanded;
        fromConcept = true;
      } else {
        ingredients = this.extractIngredients(prompt);
      }
    }

    const intent = this.analyzeUserIntent(prompt);
    const { mealType, diet, cost, occasion, isQuick, isEasy } = intent;

    if (diet === 'healthy' && ingredients.length === 0 && !mealType && !cost && !occasion && !isQuick && !isEasy) {
      return await this.getHealthySuggestions(prompt, userProfile, userAllergies);
    }

    if (ingredients.length === 0 && !mealType && !diet && !cost && !occasion && !isQuick && !isEasy) {
      if (this.isGreeting(prompt)) {
        return '👋 سلام! من دستیار آشپزی گارنیش هستم...';
      }
      const randomRecipes = await this.getRandomRecipes(3);
      if (randomRecipes.length > 0) {
        return `🎲 چند پیشنهاد تصادفی برای امروز:\n\n${this.formatRecipes(randomRecipes)}`;
      }
      return '❌ متأسفانه هیچ رسپی‌ای در دسترس نیست.';
    }

    const where: any = this.buildWhereClause(ingredients, intent, userProfile, userAllergies);

    let recipes = await this.prisma.recipe.findMany({
      where,
      include: { ingredients: true },
      take: 50,
    });

    if (userAllergies.length > 0) {
      recipes = recipes.filter(r => {
        const recipeAllergens = r.allergens ? JSON.parse(r.allergens) : [];
        return !userAllergies.some(allergy => recipeAllergens.includes(allergy));
      });
    }

    const personalizationReasons: string[] = [];

    if (userProfile) {
      if (userProfile.diet === 'vegetarian' || userProfile.diet === 'vegan') {
        personalizationReasons.push('رژیم گیاه‌خواری شما');
      }
      if (userAllergies.length > 0) {
        personalizationReasons.push('آلرژی‌های غذایی شما');
      }
      if (userProfile.skillLevel === 'beginner') {
        personalizationReasons.push('سطح مهارت مبتدی شما');
      }
    }

    if (recipes.length === 0) {
      const relaxedWhere: any = this.buildWhereClause(ingredients, intent, null, []);
      let relaxedRecipes = await this.prisma.recipe.findMany({
        where: relaxedWhere,
        include: { ingredients: true },
        take: 10,
      });

      if (userAllergies.length > 0) {
        relaxedRecipes = relaxedRecipes.filter(r => {
          const recipeAllergens = r.allergens ? JSON.parse(r.allergens) : [];
          return !userAllergies.some(allergy => recipeAllergens.includes(allergy));
        });
      }

      if (relaxedRecipes.length > 0) {
        return `🎯 برای «${prompt}» دقیقاً چیزی پیدا نشد، اما نزدیک‌ترین غذاها اینان:\n\n${this.formatRecipes(relaxedRecipes.slice(0, 3))}`;
      }
      return `❌ برای «${prompt}» غذایی پیدا نشد. می‌تونی با مواد دیگه‌ای امتحان کنی.`;
    }

    if (ingredients.length > 0) {
      recipes.sort((a, b) => {
        const aCount = ingredients.filter(ing => a.ingredients.some(ri => ri.name.includes(ing)) || a.title.includes(ing)).length;
        const bCount = ingredients.filter(ing => b.ingredients.some(ri => ri.name.includes(ing)) || b.title.includes(ing)).length;
        return bCount - aCount;
      });
    }

    const top = recipes.slice(0, 5);
    const lines = top.map(r => {
      const time = r.cookingTime ? `${r.cookingTime} دقیقه` : 'زمان نامشخص';
      const ingNames = r.ingredients.slice(0, 3).map(i => i.name).join('، ');
      return `**${r.title}**\n⏱ ${time} | ${r.difficulty || '؟'}${r.cost ? ` | 💰 ${r.cost}` : ''}\n📝 ${ingNames}`;
    });

    let response = `🔍 ${this.describeFilters(intent)}:\n\n${lines.join('\n\n')}`;
    if (personalizationReasons.length > 0) {
      response += `\n\n💡 (بر اساس ${personalizationReasons.join(' و ')} فیلتر شده است.)`;
    }

    return response;
  }

  private buildWhereClause(ingredients: string[], intent: any, userProfile: any, userAllergies: string[]) {
    const where: any = {};

    if (ingredients.length > 0) {
      where.ingredients = {
        some: {
          name: { in: ingredients },
        },
      };
    }

    if (intent.mealType) {
      where.mealType = { contains: intent.mealType };
    }

    if (intent.diet === 'vegetarian') {
      where.diet = { in: ['vegetarian', 'vegan'] };
    } else if (intent.diet === 'healthy') {
      where.OR = [
        { diet: { in: ['vegetarian', 'vegan'] } },
        { categories: { contains: 'سالم' } },
        { categories: { contains: 'رژیمی' } },
      ];
    } else if (intent.diet) {
      where.diet = intent.diet;
    }

    if (intent.cost) {
      where.cost = intent.cost;
    }

    if (intent.occasion) {
      where.occasion = { contains: intent.occasion };
    }

    if (intent.isQuick) {
      where.cookingTime = { lte: 30 };
    }

    if (intent.isEasy) {
      where.difficulty = 'آسان';
    }

    if (userProfile?.diet === 'vegetarian' || userProfile?.diet === 'vegan') {
      where.diet = { in: ['vegetarian', 'vegan'] };
    }

    if (userProfile?.skillLevel === 'beginner') {
      where.difficulty = { not: 'سخت' };
    }

    return where;
  }

  private findConceptKey(prompt: string): string | null {
    const lower = prompt.toLowerCase();
    for (const key of Object.keys(CONCEPT_MAP)) {
      if (lower.includes(key)) return key;
    }
    return null;
  }

  private async getHealthySuggestions(prompt: string, userProfile: any, userAllergies: string[] = []): Promise<string> {
    const where: any = {
      OR: [
        { diet: { in: ['vegetarian', 'vegan'] } },
        { categories: { contains: 'سالم' } },
        { categories: { contains: 'رژیمی' } },
      ],
    };
    if (userProfile?.diet === 'vegetarian' || userProfile?.diet === 'vegan') {
      where.diet = { in: ['vegetarian', 'vegan'] };
    }

    let recipes = await this.prisma.recipe.findMany({
      where,
      include: { ingredients: true },
      take: 20,
    });

    if (userAllergies.length > 0) {
      recipes = recipes.filter(r => {
        const recipeAllergens = r.allergens ? JSON.parse(r.allergens) : [];
        return !userAllergies.some(allergy => recipeAllergens.includes(allergy));
      });
    }

    if (recipes.length === 0) return '❌ متأسفانه هیچ غذای سالمی در دیتابیس پیدا نشد.';
    const top = recipes.slice(0, 5);
    const lines = top.map(r => {
      const time = r.cookingTime ? `${r.cookingTime} دقیقه` : 'زمان نامشخص';
      const ingNames = r.ingredients.slice(0, 3).map(i => i.name).join('، ');
      return `**${r.title}**\n⏱ ${time} | ${r.difficulty || '؟'}${r.cost ? ` | 💰 ${r.cost}` : ''}\n📝 ${ingNames}`;
    });
    return `🥗 پیشنهادهای سالم و رژیمی:\n\n${lines.join('\n\n')}\n\n💡 این غذاها کم‌چرب و پرخاصیت هستن.`;
  }

  private async expandConcept(prompt: string): Promise<string[]> {
    const cacheKey = `ai:concept:${prompt}`;
    const cached = await this.cacheManager.get<string[]>(cacheKey);
    if (cached) return cached;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY is not set');
      return [];
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `تو یک آشپز حرفه‌ای ایرانی هستی. کاربر جمله‌ای نوشته: "${prompt}". وظیفه تو این است که مفهوم کلی این جمله را درک کنی و ۵ مادهٔ اولیه یا کلمهٔ کلیدی که در آشپزی ایرانی برای این مفهوم به کار می‌روند را به صورت یک آرایه JSON برگردانی. این کلمات را طوری انتخاب کن که اگر در یک پایگاه دادهٔ غذا جستجو شوند، غذاهای مرتبط با آن مفهوم پیدا شوند. فقط آرایه JSON را برگردان، بدون هیچ توضیح اضافی. مثال: برای "کبابی" → ["گوشت چرخ‌کرده", "زعفران", "پیاز", "نان", "گوجه"]. برای "رژیمی" → ["سینه مرغ", "سبزیجات", "ماهی", "سالاد", "کم‌چرب"]. برای "درباری" → ["زعفران", "گردو", "رب انار", "آلو", "ته‌چین"]. اگر مفهومی متوجه نشدی، آرایه خالی برگردان: []`
            }]
          }]
        }),
      });
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
      const match = text.match(/\[.*?\]/s);
      const result = match ? JSON.parse(match[0]) : [];

      await this.cacheManager.set(cacheKey, result, 60 * 60 * 1000);
      return result;
    } catch (e) {
      console.error('expandConcept failed:', e);
    }
    return [];
  }

  private analyzeUserIntent(prompt: string) {
    const ingredients = this.extractIngredients(prompt);
    const lower = prompt.toLowerCase();
    let mealType: string | null = null;
    let diet: string | null = null;
    let cost: string | null = null;
    let occasion: string | null = null;
    let isQuick = false;
    let isEasy = false;

    if (lower.includes('صبحانه')) mealType = 'breakfast';
    else if (lower.includes('ناهار')) mealType = 'lunch';
    else if (lower.includes('شام')) mealType = 'dinner';
    else if (lower.includes('عصرانه') || lower.includes('میان‌وعده')) mealType = 'snack';

    if (lower.includes('گیاهی') || lower.includes('وجترین')) diet = 'vegetarian';
    else if (lower.includes('سالم') || lower.includes('رژیمی')) diet = 'healthy';
    else if (lower.includes('ورزشکاری')) { diet = 'healthy'; isQuick = true; }

    if (lower.includes('ارزون') || lower.includes('کم‌هزینه')) cost = 'کم‌هزینه';
    else if (lower.includes('متوسط') && (lower.includes('هزینه') || lower.includes('قیمت'))) cost = 'متوسط';
    else if (lower.includes('گرون')) cost = 'گران';

    if (lower.includes('مهمونی') || lower.includes('مهمانی') || lower.includes('جشن')) occasion = 'مهمانی';
    else if (lower.includes('پیک‌نیک') || lower.includes('طبیعت')) occasion = 'پیک‌نیک';
    else if (lower.includes('یلدا') || lower.includes('شب یلدا')) occasion = 'شب یلدا';
    else if (lower.includes('افطار')) occasion = 'افطار';
    else if (lower.includes('نذری')) occasion = 'نذری';

    if (lower.includes('سریع') || lower.includes('فوری') || lower.includes('زیر ۳۰ دقیقه')) isQuick = true;
    if (lower.includes('آسون') || lower.includes('راحت') || lower.includes('ساده')) isEasy = true;

    return { ingredients, mealType, diet, cost, occasion, isQuick, isEasy };
  }

  private extractIngredients(text: string): string[] {
    const foodList = [
      'مرغ', 'گوشت', 'برنج', 'زعفران', 'پیاز', 'سیر', 'گوجه', 'سیب‌زمینی',
      'عدس', 'لوبیا', 'ماهی', 'میگو', 'قارچ', 'پنیر', 'تخم‌مرغ', 'ماست',
      'بادمجان', 'کدو', 'هویج', 'فلفل', 'سبزی', 'نخود', 'لپه', 'گردو',
      'زرشک', 'آلبالو', 'آلو', 'به', 'انار', 'رب', 'شوید', 'تره',
    ];
    return foodList.filter(f => text.includes(f));
  }

  private isGreeting(text: string): boolean {
    const greetings = ['سلام', 'خوبی', 'چطوری', 'خوب هستی', 'درود', 'خدا قوت', 'خوبم'];
    return greetings.some(g => text.includes(g));
  }

  private describeFilters(intent: ReturnType<AiService['analyzeUserIntent']>): string {
    const parts: string[] = [];
    if (intent.ingredients.length > 0) parts.push(`دارای «${intent.ingredients.join('، ')}»`);
    if (intent.mealType) parts.push(`وعدهٔ «${this.mealLabel(intent.mealType)}»`);
    if (intent.diet === 'vegetarian') parts.push('گیاهی');
    if (intent.diet === 'healthy') parts.push('سالم');
    if (intent.cost) parts.push(`هزینهٔ «${intent.cost}»`);
    if (intent.occasion) parts.push(`مناسب «${intent.occasion}»`);
    if (intent.isQuick) parts.push('سریع');
    if (intent.isEasy) parts.push('آسان');
    if (parts.length === 0) parts.push('همهٔ غذاها');
    return 'غذاهای ' + parts.join('، ');
  }

  private mealLabel(type: string): string {
    const map: Record<string, string> = {
      breakfast: 'صبحانه',
      lunch: 'ناهار',
      dinner: 'شام',
      snack: 'میان‌وعده',
    };
    return map[type] || type;
  }

  private formatRecipes(recipes: any[]): string {
    return recipes.map(r => {
      const time = r.cookingTime ? `${r.cookingTime} دقیقه` : '؟';
      const ingNames = r.ingredients.slice(0, 2).map(i => i.name).join('، ');
      return `🔥 **${r.title}** (${time}) - ${ingNames}`;
    }).join('\n\n');
  }

  private async getRandomRecipes(count: number) {
    const all = await this.prisma.recipe.findMany({ take: 50, include: { ingredients: true } });
    if (all.length === 0) return [];
    const shuffled = all.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }
}