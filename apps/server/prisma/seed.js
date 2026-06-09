const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const recipesClean = require('../../../packages/shared/data/recipes_clean.json');
const recipesMeta = require('../../../packages/shared/data/recipes_metadata.json');

const prisma = new PrismaClient();

const REVIEW_PROFILE_TYPES = [
  { key: 'fitness', diet: 'low_carb', skillLevel: 'intermediate', budget: 'medium', familySize: 1 },
  { key: 'family', diet: 'omnivore', skillLevel: 'intermediate', budget: 'medium', familySize: 4 },
  { key: 'budget', diet: 'vegetarian', skillLevel: 'beginner', budget: 'low', familySize: 2 },
  { key: 'health', diet: 'vegan', skillLevel: 'advanced', budget: 'medium', familySize: 1 },
  { key: 'timepoor', diet: 'omnivore', skillLevel: 'beginner', budget: 'low', familySize: 1 },
];

const RECIPE_BUCKETS = {
  fitness: ['high_protein', 'post_workout', 'healthy', 'low_carb'],
  family: ['family', 'meal_plan', 'comfort', 'servings'],
  budget: ['budget', 'cheap', 'simple', 'quick'],
  health: ['healthy', 'vegan', 'gluten_free', 'dairy_free'],
  timepoor: ['quick', 'easy', 'fast', '30min'],
};

function pick(list, index) {
  return list[index % list.length];
}

function randomPick(list, seed) {
  return list[Math.abs(seed) % list.length];
}

function makeProfile(type, idx) {
  return {
    userId: `review-${type.key}-${idx}`,
    favoriteFoods: JSON.stringify(type.key === 'fitness' ? ['grilled chicken', 'salad'] : ['pasta', 'stew']),
    dislikedFoods: JSON.stringify(type.key === 'budget' ? ['expensive cuts'] : ['nothing']),
    budgetRange: type.budget,
    shoppingPattern: JSON.stringify(['weekly', 'planned']),
    mealTiming: JSON.stringify({ breakfast: 'light', lunch: 'medium', dinner: 'heavy' }),
    cookingSkill: type.skillLevel,
    healthGoals: JSON.stringify(type.key === 'fitness' ? ['muscle_gain', 'weight_loss'] : ['healthy_eating']),
    motivationStyle: type.key,
    consistencyScore: type.key === 'family' ? 82 : type.key === 'budget' ? 68 : 76,
    churnRiskScore: type.key === 'timepoor' ? 34 : 12,
    familySize: type.familySize,
    favoriteIngredients: JSON.stringify(type.key === 'fitness' ? ['chicken', 'egg'] : ['rice', 'tomato']),
    dislikedIngredients: JSON.stringify([]),
    preferredMealTimes: JSON.stringify({ breakfast: '08:00', lunch: '13:00', dinner: '19:00' }),
    weeklyPatterns: JSON.stringify({ meal_plan: type.key === 'family' || type.key === 'fitness' }),
    cookingFrequency: type.key === 'timepoor' ? 'low' : 'medium',
    budgetScore: type.budget,
    healthAdherenceScore: type.key === 'health' ? 88 : 61,
  };
}

async function seedRecipesIfNeeded() {
  const existingCount = await prisma.recipe.count();
  if (existingCount > 0) return;

  const metaMap = new Map(recipesMeta.map((m) => [String(m.id), m]));

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
    const faq = faqRaw.map((f) => ({ question: f.سوال || '', answer: f.پاسخ || '' }));
    const nutritionRaw = c['ارزش غذایی'];
    const nutrition = nutritionRaw
      ? {
          create: {
            calories: parseFloat(nutritionRaw.کالری) || null,
            protein: parseFloat(nutritionRaw.پروتئین) || null,
            carbs: parseFloat(nutritionRaw.کربوهیدرات) || null,
            fat: parseFloat(nutritionRaw.چربی) || null,
            fiber: parseFloat(nutritionRaw.فیبر) || null,
          },
        }
      : undefined;

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
          create: searchTermsRaw.map((term) => ({ term })),
        },
        nutrition,
      },
    });
  }
}

async function seedReviewDataset() {
  const reviewUsers = [];

  await prisma.user.deleteMany({
    where: {
      OR: [
        { email: { startsWith: 'review-' } },
        { phone: { startsWith: '+98999' } },
      ],
    },
  });

  for (const profile of REVIEW_PROFILE_TYPES) {
    for (let i = 1; i <= 12; i++) {
      const id = `review-${profile.key}-${i}`;
      reviewUsers.push({
        id,
        phone: `+98999${String(100000 + i).slice(-6)}`,
        email: `${id}@garnish.review`,
        name: `${profile.key.toUpperCase()} ${i}`,
        password: 'review-only',
        isAdmin: false,
      });
    }
  }

  await prisma.user.createMany({ data: reviewUsers, skipDuplicates: true });

  await prisma.userPreference.createMany({
    data: REVIEW_PROFILE_TYPES.flatMap((profile) =>
      Array.from({ length: 12 }, (_, idx) => ({
        userId: `review-${profile.key}-${idx + 1}`,
        diet: profile.diet,
        skillLevel: profile.skillLevel,
        budget: profile.budget,
      })),
    ),
    skipDuplicates: true,
  });

  await prisma.userBehaviorProfile.createMany({
    data: REVIEW_PROFILE_TYPES.flatMap((profile) =>
      Array.from({ length: 12 }, (_, idx) => makeProfile(profile, idx + 1)),
    ),
    skipDuplicates: true,
  });

  const recipeIds = (await prisma.recipe.findMany({ select: { id: true } })).map((r) => r.id);

  const events = [];
  const attributionEvents = [];
  const outcomes = [];
  const exposures = [];
  const featureLogs = [];
  const signals = [];
  const metrics = [];

  for (const profile of REVIEW_PROFILE_TYPES) {
    for (let i = 1; i <= 12; i++) {
      const userId = `review-${profile.key}-${i}`;
      const selectedRecipes = recipeIds.filter((_, idx) => idx % REVIEW_PROFILE_TYPES.length === REVIEW_PROFILE_TYPES.indexOf(profile)).slice(0, 30);

      for (const [idx, recipeId] of selectedRecipes.entries()) {
        const bucket = profile.key;
        const tone = RECIPE_BUCKETS[bucket];
        const now = new Date(Date.now() - idx * 3600 * 1000);
        const type = idx % 6 === 0
          ? 'recommendation_impression'
          : idx % 6 === 1
            ? 'recommendation_click'
            : idx % 6 === 2
              ? 'recommendation_save'
              : idx % 6 === 3
                ? 'recommendation_cook'
                : idx % 6 === 4
                  ? 'recommendation_ignore'
                  : 'recommendation_dismiss';

        events.push({
          id: uuidv4(),
          userId,
          type: idx % 2 === 0 ? 'recipe_view' : 'search_query',
          timestamp: now,
          payload: JSON.stringify({
            recipeId,
            query: `${bucket} ${tone[idx % tone.length]}`,
          }),
          page: '/home',
          duration: 30 + idx,
        });

        attributionEvents.push({
          id: uuidv4(),
          userId,
          recipeId,
          eventType: type,
          value:
            type === 'recommendation_impression'
              ? 0.1
              : type === 'recommendation_click'
                ? 0.3
                : type === 'recommendation_save'
                  ? 0.6
                  : type === 'recommendation_cook'
                    ? 1
                    : type === 'recommendation_ignore'
                      ? -0.5
                      : -1,
          source: 'review_seed',
          occurredAt: now,
        });

        if (type === 'recommendation_impression' || type === 'recommendation_click') {
          exposures.push({
            id: uuidv4(),
            userId,
            recipeId,
            source: 'review_seed',
            viewedAt: now,
            scorePenalty: type === 'recommendation_impression' ? 0.04 : 0.08,
          });
        }

        if (type === 'recommendation_click' || type === 'recommendation_save' || type === 'recommendation_cook') {
          featureLogs.push({
            id: uuidv4(),
            userId,
            recipeId,
            featureKey: `signal_${bucket}`,
            contribution: type === 'recommendation_cook' ? 0.9 : type === 'recommendation_save' ? 0.6 : 0.35,
            finalScore: 0.5 + idx * 0.01,
            createdAt: now,
          });
        }
      }

      outcomes.push({
        id: uuidv4(),
        userId,
      metricName: 'recommendation_quality',
      metricValue: profile.key === 'fitness' ? 88 : profile.key === 'family' ? 81 : profile.key === 'budget' ? 76 : 83,
      period: 'daily',
      sources: { profile: profile.key, sampleSize: 30 },
      recordedAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
    });

      signals.push({
        userId,
        signalName: `likes_${profile.key === 'timepoor' ? 'fast_meals' : profile.key === 'budget' ? 'budget_meals' : profile.key}`,
        signalDomain: profile.key === 'fitness' ? 'health' : 'cooking',
        signalType: 'behavior',
        value: profile.key === 'fitness' ? 0.9 : 0.8,
        confidence: 0.85,
        sampleSize: 30,
        consistency: 0.8,
        halfLifeDays: 45,
        lastDetected: new Date(),
      });

      metrics.push({
        id: uuidv4(),
        metricDate: new Date(Date.UTC(2026, 5, 7)),
        windowDays: 7,
        totalImpressions: 500,
        totalClicks: 180,
        totalSaves: 120,
        totalCooks: 60,
        totalDismisses: 40,
        totalExposures: 520,
        clickThroughRate: 0.36,
        saveRate: 0.66,
        cookRate: 0.5,
        frictionRate: 0.08,
        recommendationQuality: 82,
        recommendationReward: 61,
        topSignals: [{ signalName: `likes_${profile.key}` }],
        topFeatures: [{ featureKey: 'tasteAffinity', contribution: 0.72 }],
        createdAt: new Date(),
      });
    }
  }

  await prisma.userEvent.createMany({ data: events, skipDuplicates: true });
  await prisma.recommendationAttributionEvent.createMany({ data: attributionEvents, skipDuplicates: true });
  await prisma.recommendationExposure.createMany({ data: exposures, skipDuplicates: true });
  await prisma.userOutcome.createMany({ data: outcomes, skipDuplicates: true });
  await prisma.userBehaviorSignal.createMany({ data: signals, skipDuplicates: true });
  await prisma.featureContributionLog.createMany({ data: featureLogs, skipDuplicates: true });
  await prisma.recommendationMetrics.createMany({ data: metrics, skipDuplicates: true });
}

async function main() {
  await seedRecipesIfNeeded();

  if (process.env.REVIEW_SEED === '1') {
    await seedReviewDataset();
    console.log('✅ Review dataset seeded successfully.');
  } else {
    console.log('✅ Recipes seeded successfully.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
