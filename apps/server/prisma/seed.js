const { PrismaClient } = require('@prisma/client');
const recipesClean = require('../../../packages/shared/data/recipes_clean.json');
const recipesMeta  = require('../../../packages/shared/data/recipes_metadata.json');

const prisma = new PrismaClient();

async function main() {
  const metaMap = new Map(recipesMeta.map(m => [String(m.id), m]));

  for (const r of recipesClean) {
    const c = r.content || {};
    const meta = metaMap.get(String(r.id)) || {};

    const title = r.title || '';
    const excerpt = r.excerpt || '';
    const ingredientsRaw = c['مواد اولیه'] || [];
    const stepsRaw = c['مراحل'] || [];
    const tools = c['ابزارها'] || [];
    const tips = c['نکات'] || [];
    const faqRaw = c['سوالات متداول'] || [];
    const faq = faqRaw.map(f => ({ question: f.سوال || '', answer: f.پاسخ || '' }));
    const nutritionRaw = c['ارزش غذایی'];
    const nutrition = nutritionRaw ? {
      create: {
        calories: parseFloat(nutritionRaw.کالری) || null,
        protein: parseFloat(nutritionRaw.پروتئین) || null,
        carbs: parseFloat(nutritionRaw.کربوهیدرات) || null,
        fat: parseFloat(nutritionRaw.چربی) || null,
        fiber: parseFloat(nutritionRaw.فیبر) || null,
      },
    } : undefined;

    const timeRaw = c['زمان'] || {};
    const prepTime = timeRaw['آماده‌سازی'] || '';
    const cookTimeRaw2 = timeRaw['پخت'] || timeRaw['کل'] || '';
    const totalTime = timeRaw['کل'] || '';
    const difficulty = c['سختی'] || meta.difficulty || '';
    const searchTermsRaw = r.searchableTerms || [];

    const categories = meta.categories || [];
    const allergens = meta.allergens || [];
    const occasion = meta.occasion || [];
    const cost = meta.cost || '';
    const primaryCategory = categories.length > 0 ? categories[0] : (meta.foodType || 'main');
    const mealType = meta.mealType || '';
    const diet = meta.diet || '';
    const region = meta.region || '';

    await prisma.recipe.create({
      data: {
        title,
        description: excerpt,
        category: primaryCategory,
        region,
        difficulty,
        cookingTime: parseInt(cookTimeRaw2) || null,
        servings: r.servings || null,
        prepTime,
        totalTime,
        tools: JSON.stringify(tools),
        tips: JSON.stringify(tips),
        faq: JSON.stringify(faq),
        mealType,
        diet,
        categories: JSON.stringify(categories),
        allergens: JSON.stringify(allergens),
        occasion: JSON.stringify(occasion),
        cost,
        ingredients: {
          create: ingredientsRaw.map((ing, idx) => ({
            name: ing.نام || '',
            amount: ing.مقدار || null,
            unit: ing.واحد || '',
            notes: ing.توضیح || '',
            order: idx,
          })),
        },
        steps: {
          create: stepsRaw.map((step, idx) => ({
            instruction: step,
            order: idx,
          })),
        },
        searchTerms: {
          create: searchTermsRaw.map(term => ({ term })),
        },
        nutrition,
      },
    });
  }
  console.log('✅ All recipes seeded successfully.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());