const { PrismaClient } = require('@prisma/client');
const http = require('http');
const { randomUUID } = require('crypto');

const prisma = new PrismaClient();

async function main() {
  // ---------- تنظیمات تست ----------
  const TEST_USER_ID = '76722b8e-0063-48c0-8031-71f306aad907'; // کاربر تست
  // انتخاب یک غذای واقعی که در لیست پیشنهادات آمده بود (جوجه کباب زعفرانی)
  const TEST_RECIPE_ID = '8cae757c-91e7-4a5d-bca3-af2fde6193d7'; 
  const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjcyMmI4ZS0wMDYzLTQ4YzAtODAzMS03MWYzMDZhYWQ5MDciLCJwaG9uZSI6IjA5MTIzNDU2Nzg5IiwiaWF0IjoxNzgwODI0MDI0LCJleHAiOjE3ODE0Mjg4MjR9.ha0ntP0w0NDdX8xT4HhsRq1e3H5Fe-uhTW6hZi07_z8';

  console.log('🧪 شروع تست نهایی Exposure Penalty...\n');

  // ۱. حذف Exposure و Dismiss‌های قبلی برای این غذای خاص (برای تست تمیز)
  await prisma.$executeRaw`DELETE FROM "RecommendationExposure" WHERE "userId" = ${TEST_USER_ID} AND "recipeId" = ${TEST_RECIPE_ID}`;
  await prisma.userEvent.deleteMany({
    where: {
      userId: TEST_USER_ID,
      type: 'recommendation_dismiss',
      payload: { contains: TEST_RECIPE_ID },
    },
  });
  console.log('🧹 داده‌های قبلی پاک شد.');

  // ۲. اضافه کردن ۳ Exposure
  for (let i = 0; i < 3; i++) {
    await prisma.$executeRaw`
      INSERT INTO "RecommendationExposure" ("id", "userId", "recipeId", "source", "viewedAt", "scorePenalty")
      VALUES (${randomUUID()}, ${TEST_USER_ID}, ${TEST_RECIPE_ID}, 'recommendation', NOW(), 0)
    `;
  }
  console.log('✅ ۳ Exposure اضافه شد.');

  // ۳. اضافه کردن یک dismiss
  await prisma.userEvent.create({
    data: {
      userId: TEST_USER_ID,
      type: 'recommendation_dismiss',
      payload: JSON.stringify({ recipeId: TEST_RECIPE_ID }),
    },
  });
  console.log('✅ یک رویداد dismiss اضافه شد.');

  // ۴. صدا زدن API Recommendation
  console.log('⏳ در حال دریافت پیشنهادها...');
  const recommendations = await new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/recommendations?limit=20',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Invalid JSON response'));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });

  // ۵. جستجوی غذای تست‌شده در نتایج
  const target = recommendations.find(r => r.recipeId === TEST_RECIPE_ID);
  if (!target) {
    console.log('❌ غذای تست‌شده در لیست پیشنهادات نیامد. (ممکن است کاندیدا نبوده)');
    return;
  }

  console.log('\n📊 نتایج برای', target.title, ':');
  console.log('   rawScore:', target.rawScore);
  console.log('   exposurePenalty:', target.exposurePenalty);
  console.log('   finalScore:', target.finalScore);

  if (target.exposurePenalty > 0) {
    console.log('\n✅ تست موفقیت‌آمیز بود! Exposure Penalty اعمال شده است.');
  } else {
    console.log('\n⚠️ Penalty صفر است. ممکن است داده‌ها ذخیره نشده باشند.');
    // می‌تونیم اینجا بررسی کنیم
    const exposures = await prisma.$queryRaw`SELECT COUNT(*) FROM "RecommendationExposure" WHERE "userId" = ${TEST_USER_ID} AND "recipeId" = ${TEST_RECIPE_ID}`;
    const dismissCount = await prisma.userEvent.count({
      where: {
        userId: TEST_USER_ID,
        type: 'recommendation_dismiss',
        payload: { contains: TEST_RECIPE_ID },
      },
    });
    console.log('   Exposure count:', Number(exposures[0]?.count || 0));
    console.log('   Dismiss count:', dismissCount);
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
