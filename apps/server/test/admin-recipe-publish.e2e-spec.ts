import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AdminService } from '../src/admin/admin.service';

// re-audit P0-1: admin "approve" must ACTUALLY publish — the public surfaces (Home/Discover/Search/AI/MealPlan)
// read status:'active' + isPublic:true (recipe-visibility PUBLISHED_RECIPE_WHERE). Before the fix, approve wrote
// status:'approved' (a dead status no surface reads) and never touched isPublic, so an "approved" recipe stayed
// invisible. This test drives the REAL AdminService against the REAL DB + the REAL published condition.
describe('Admin approve → real public visibility (re-audit P0-1)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: AdminService;
  let recipeId: string;
  let orig: { status: string | null; isPublic: boolean };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    admin = app.get(AdminService);
    const r = await prisma.recipe.findFirst({ select: { id: true, status: true, isPublic: true } });
    if (!r) throw new Error('no recipe to test with');
    recipeId = r.id;
    orig = { status: r.status, isPublic: r.isPublic };
  });

  afterAll(async () => {
    if (recipeId) await prisma.recipe.update({ where: { id: recipeId }, data: orig }).catch(() => {});
    await app?.close();
  });

  const inPublishedQuery = async () =>
    !!(await prisma.recipe.findFirst({ where: { id: recipeId, status: 'active', isPublic: true }, select: { id: true } }));

  it('a pending recipe is NOT in the published query', async () => {
    await prisma.recipe.update({ where: { id: recipeId }, data: { status: 'pending', isPublic: false } });
    expect(await inPublishedQuery()).toBe(false);
  });

  it('approve (updateRecipeStatus → active) makes it publicly visible immediately', async () => {
    await admin.updateRecipeStatus(recipeId, 'active');
    expect(await inPublishedQuery()).toBe(true);
  });

  it('reject (updateRecipeStatus → rejected) unpublishes it', async () => {
    await admin.updateRecipeStatus(recipeId, 'rejected', 'spam');
    expect(await inPublishedQuery()).toBe(false);
  });
});
