import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PUBLISHED_RECIPE_WHERE } from '../src/recipes/recipe-visibility';

/**
 * Recsys audit P0-1 — the HARD allergy/observance invariant must hold on the DIRECT recipe paths
 * (`GET /recipes/:id`, `/recipes/:id/full`), not just the rails/search. The cook page reads `/full`, so
 * blocking it also keeps an unsafe recipe out of cook/step mode. Proven end-to-end with a REAL allergic
 * user (UserAllergy → the same living-profile read the gate uses), not a mock.
 * NOTE: Recipe.allergens is a nullable STRING (JSON/CSV), and UserAllergy has a composite (userId,allergyId) key.
 */
function parseAllergens(s: any): string[] {
  if (Array.isArray(s)) return s.map((x) => String(x));
  if (s == null || s === '') return [];
  try { const j = JSON.parse(String(s)); return Array.isArray(j) ? j.map((x) => String(x)) : [String(j)]; }
  catch { return String(s).split(/[,،;]/).map((x) => x.trim()).filter(Boolean); }
}

describe('Recipe safety invariant (e2e) — recsys P0-1', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let allergicToken = '';
  let unsafeId = '';
  let safeId = '';
  let userId = '';
  let matchedAllergyId = '';

  beforeAll(async () => {
    const mod: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService, { strict: false });

    const recipes = await prisma.recipe.findMany({ where: { ...PUBLISHED_RECIPE_WHERE, allergens: { not: null } }, select: { id: true, allergens: true }, take: 300 });
    const allergies = await prisma.allergy.findMany({ select: { id: true, name: true } });
    for (const r of recipes) {
      const ra = parseAllergens(r.allergens).map((x) => x.toLowerCase());
      const match = allergies.find((a) => ra.includes(String(a.name).toLowerCase()));
      if (match) { unsafeId = r.id; matchedAllergyId = match.id; break; }
    }
    const safe = await prisma.recipe.findFirst({ where: { ...PUBLISHED_RECIPE_WHERE, OR: [{ allergens: null }, { allergens: '' }, { allergens: '[]' }] }, select: { id: true } });
    safeId = safe?.id ?? '';

    if (matchedAllergyId) {
      const u = await prisma.user.create({ data: { phone: `0912${String(Date.now()).slice(-7)}`, name: 'safety e2e' } });
      userId = u.id;
      await prisma.userAllergy.create({ data: { userId: u.id, allergyId: matchedAllergyId } });
      allergicToken = jwt.sign({ sub: u.id, epoch: (u as any).sessionEpoch ?? 0 });
    }
  });

  afterAll(async () => {
    if (userId && matchedAllergyId) await prisma.userAllergy.deleteMany({ where: { userId, allergyId: matchedAllergyId } }).catch(() => {});
    if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await app.close();
  });

  it('fixture: found a published recipe + matching allergy', () => {
    expect(unsafeId).toBeTruthy();
    expect(allergicToken).toBeTruthy();
  });

  it('anonymous CAN read the recipe (no declared profile — documented policy)', async () => {
    await request(app.getHttpServer()).get(`/recipes/${unsafeId}`).expect(200);
  });

  it('an allergic user is BLOCKED from the conflicting recipe — GET /recipes/:id → 403', async () => {
    await request(app.getHttpServer()).get(`/recipes/${unsafeId}`).set('Authorization', `Bearer ${allergicToken}`).expect(403);
  });

  it('an allergic user is BLOCKED from the full body (cook reads this) — GET /recipes/:id/full → 403', async () => {
    await request(app.getHttpServer()).get(`/recipes/${unsafeId}/full`).set('Authorization', `Bearer ${allergicToken}`).expect(403);
  });

  it('the gate does NOT over-block — a non-conflicting recipe is served — GET /recipes/:safe/full → 200', async () => {
    if (!safeId) return; // corpus has no allergen-free published recipe — skip rather than false-fail
    await request(app.getHttpServer()).get(`/recipes/${safeId}/full`).set('Authorization', `Bearer ${allergicToken}`).expect(200);
  });
});
