const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');
const prisma = new PrismaClient();

async function main() {
  // ---------- تنظیمات تست ----------
  const TEST_USER_ID = '76722b8e-0063-48c0-8031-71f306aad907';  // از توکن کاربر تست
  const TEST_RECIPE_ID = 'b4b80139-4758-4565-9b8e-1ff41637c940'; // یکی از غذاهای موجود

  console.log('🧪 شروع تست Exposure Penalty...\n');

  // ۱. اضافه کردن ۳ Exposure برای این غذا
  for (let i = 0; i < 3; i++) {
    await prisma.$executeRaw`
      INSERT INTO "RecommendationExposure" ("id", "userId", "recipeId", "source", "viewedAt", "scorePenalty")
      VALUES (${randomUUID()}, ${TEST_USER_ID}, ${TEST_RECIPE_ID}, 'recommendation', NOW(), 0)
    `;
  }
  console.log('✅ ۳ Exposure برای غذا اضافه شد.');

  // ۲. اضافه کردن یک رویداد recommendation_dismiss
  await prisma.userEvent.create({
    data: {
      userId: TEST_USER_ID,
      type: 'recommendation_dismiss',
      payload: JSON.stringify({ recipeId: TEST_RECIPE_ID }),
    },
  });
  console.log('✅ یک رویداد recommendation_dismiss اضافه شد.');

  // ۳. حالا بیایم Recommendation رو شبیه‌سازی کنیم
  // (همون کاری که RankingService انجام میده رو دستی تست می‌کنیم)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [exposures, dismissCount] = await Promise.all([
    prisma.$queryRaw`SELECT COUNT(*) as count FROM "RecommendationExposure" WHERE "userId" = ${TEST_USER_ID} AND "recipeId" = ${TEST_RECIPE_ID} AND "viewedAt" >= ${sevenDaysAgo}`,
    prisma.userEvent.count({
      where: {
        userId: TEST_USER_ID,
        type: 'recommendation_dismiss',
        timestamp: { gte: sevenDaysAgo },
        payload: { contains: TEST_RECIPE_ID },
      },
    }),
  ]);

  const exposureCount = Number(exposures[0]?.count || 0);
  let penalty = 0;
  if (exposureCount > 2) penalty += (exposureCount - 2) * 0.05;
  penalty += dismissCount * 0.15;
  penalty = Math.min(0.5, penalty);

  console.log('\n📊 نتایج:');
  console.log(`   نمایش‌ها: ${exposureCount}`);
  console.log(`   dismiss: ${dismissCount}`);
  console.log(`   جریمه محاسبه‌شده: ${penalty}`);
  console.log(`\n🔹 حالا می‌تونی با curl زیر recommendation واقعی رو بگیری و ببینی finalScore چقدر کم شده:`);
  console.log(`   curl -H "Authorization: Bearer <TOKEN>" http://localhost:3000/recommendations?limit=3`);
  console.log('\n📌 غذای تست‌شده باید penalty بالای 0 داشته باشه و finalScore کمتر از rawScore بشه.');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
