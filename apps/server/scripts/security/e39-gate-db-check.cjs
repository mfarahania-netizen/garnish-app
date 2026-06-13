// E39 final gate — READ-ONLY DB identity + recipe sanity check. No writes, no deletes.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function redact(url) {
  if (!url) return '(unset)';
  return url.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
}

(async () => {
  const out = {};
  try {
    out.databaseUrlRedacted = redact(process.env.DATABASE_URL);
    const dbrow = await prisma.$queryRawUnsafe('SELECT current_database() AS db, current_user AS usr, inet_server_addr()::text AS host, inet_server_port() AS port');
    out.currentDatabase = dbrow[0].db;
    out.currentUser = dbrow[0].usr;
    out.host = dbrow[0].host;
    out.port = String(dbrow[0].port);
    out.isLocalDev = (out.currentDatabase === 'garnish_db');

    out.flags = {
      RETENTION_DESTRUCTIVE_ENABLED: process.env.RETENTION_DESTRUCTIVE_ENABLED ?? '(unset)',
      AI_LIVE_ENABLED: process.env.AI_LIVE_ENABLED ?? '(unset)',
      GEMINI_LIVE: process.env.GEMINI_LIVE ?? '(unset)',
      AI_PROVIDER: process.env.AI_PROVIDER ?? '(unset)',
    };

    out.recipeCount = await prisma.recipe.count();
    out.ingredientCount = await prisma.ingredient.count();
    out.recipeIngredientCount = await prisma.recipeIngredient.count();
    // sample new recipes by title.fa
    const titles = ['انارپلو شیرازی', 'ته‌انداز مرغ', 'خورشت سیب', 'انار پلو شیرازی', 'خورش سیب'];
    out.sampleRecipes = {};
    for (const t of titles) {
      const r = await prisma.recipe.findFirst({ where: { title: t }, select: { id: true, title: true, isPublic: true } });
      out.sampleRecipes[t] = r ? { id: r.id, isPublic: r.isPublic } : null;
    }
    // user interaction snapshot (proof no deletion)
    out.userInteractions = {
      users: await prisma.user.count(),
      favoriteRecipe: await prisma.favoriteRecipe.count(),
      recommendationExposure: await prisma.recommendationExposure.count(),
    };
    console.log(JSON.stringify(out, null, 2));
  } catch (e) {
    console.error('ERROR', e.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
