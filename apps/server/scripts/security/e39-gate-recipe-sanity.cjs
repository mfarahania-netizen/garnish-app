// E39 gate Phase 6 — READ-ONLY recipe/ingredient integrity. No writes.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const out = {};
    out.recipeTotal = await prisma.recipe.count();
    out.recipePublic = await prisma.recipe.count({ where: { isPublic: true } });
    out.ingredientTotal = await prisma.ingredient.count();
    out.recipeIngredientTotal = await prisma.recipeIngredient.count();
    out.recipeIngredientUnresolved = await prisma.recipeIngredient.count({ where: { ingredientId: null } });
    // distinct ingredientIds actually referenced
    const distinct = await prisma.recipeIngredient.findMany({ where: { ingredientId: { not: null } }, select: { ingredientId: true }, distinct: ['ingredientId'] });
    out.distinctIngredientIdsReferenced = distinct.length;
    // any referenced ingredientId NOT present in Ingredient table? (FK should make this 0)
    const ids = distinct.map((d) => d.ingredientId);
    const present = await prisma.ingredient.count({ where: { id: { in: ids } } });
    out.referencedIngredientsPresentInDict = present;
    out.referencedIngredientsMissing = ids.length - present;
    console.log(JSON.stringify(out, null, 2));
  } catch (e) {
    console.error('ERROR', e.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
