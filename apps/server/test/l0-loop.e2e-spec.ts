import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * L0 EXIT GATE — FULL app-boot e2e (real Nest app + real DB + real HTTP). The capstone over the service-level
 * integration test: it proves the loop end-to-end through the actual wiring —
 *   real HTTP cook (POST /analytics/event) → durable outbox → router → signal processor → DB signal,
 *   and the serve path (GET /recommendations) runs the real ranker over that learned profile,
 *   and every event carries its GDPR consentPurpose.
 * Uses the dev DB like auth.e2e-spec; all test data is namespaced to a throwaway user and cleaned up.
 */
const PHONE = '09120000777';
const PW = 'test123456';

async function waitFor(fn: () => Promise<boolean>, timeoutMs = 9000, stepMs = 300): Promise<boolean> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  return false;
}

describe('L0 EXIT GATE (e2e — full app boot + real DB)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  let stewIds: string[] = [];

  jest.setTimeout(60000);

  const cleanup = async () => {
    try {
      const u = await prisma.user.findUnique({ where: { phone: PHONE }, select: { id: true } });
      if (!u) return;
      const events = await prisma.userEvent.findMany({ where: { userId: u.id }, select: { id: true } });
      const eventIds = events.map((e) => e.id);
      // no-FK tables → delete explicitly
      if (eventIds.length) await prisma.eventOutbox.deleteMany({ where: { eventId: { in: eventIds } } }).catch(() => {});
      await prisma.recommendationServedItem.deleteMany({ where: { userId: u.id } }).catch(() => {});
      // FK-bound tables cascade on user delete, but delete the big ones explicitly to be safe
      await prisma.userBehaviorSignal.deleteMany({ where: { userId: u.id } }).catch(() => {});
      await prisma.signalObservation.deleteMany({ where: { userId: u.id } }).catch(() => {});
      await prisma.userFeatureVector.deleteMany({ where: { userId: u.id } }).catch(() => {});
      await prisma.userEvent.deleteMany({ where: { userId: u.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
    } catch {
      /* best-effort */
    }
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    await cleanup();
    const reg = await request(app.getHttpServer()).post('/auth/register').send({ phone: PHONE, password: PW, name: 'L0 e2e' });
    token = reg.body.token;
    const u = await prisma.user.findUnique({ where: { phone: PHONE }, select: { id: true } });
    userId = u!.id;

    // distinct real stews in the corpus (categories carry «خورشت») → cooking them produces likes_stew.
    // Distinct recipes (not the same one 3×) so the deliberate-signal double-fire guard doesn't drop them.
    const stews = await prisma.recipe.findMany({ where: { categories: { contains: 'خورشت' } }, select: { id: true }, take: 3 });
    stewIds = stews.map((s) => s.id);
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('boots, authenticates, and the corpus has a stew to exercise the loop', () => {
    expect(token).toBeTruthy();
    expect(userId).toBeTruthy();
    expect(stewIds.length).toBeGreaterThanOrEqual(3); // if this fails, the dev DB lacks ≥3 enriched stews — seed before gating
  });

  it('real HTTP cooks → durable routing → stew signal in DB; every event carries consentPurpose; serve path works', async () => {
    // baseline serve works for a fresh user
    const before = await request(app.getHttpServer()).get('/recommendations?limit=30').set('Authorization', `Bearer ${token}`).expect(200);
    expect(Array.isArray(before.body)).toBe(true);

    // N real cooks of DISTINCT stews through the actual HTTP ingest (distinct → not accidental-double-fire)
    for (const rid of stewIds.slice(0, 3)) {
      await request(app.getHttpServer())
        .post('/analytics/event')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'cook_complete', payload: { recipeId: rid } })
        .expect(201);
    }

    // the outbox fast-path routes asynchronously → poll until the cook-derived signal lands (no flaky sleeps)
    const signalLanded = await waitFor(async () => {
      const sigs = await prisma.userBehaviorSignal.findMany({ where: { userId }, select: { signalName: true } });
      return sigs.some((s) => s.signalName === 'likes_stew');
    });
    expect(signalLanded).toBe(true); // cook → outbox → router → processor → DB, end-to-end through the real app

    // GDPR provenance: every cook event was stamped with a consentPurpose
    const cookEvents = await prisma.userEvent.findMany({ where: { userId, type: 'cook_complete' }, select: { consentPurpose: true } });
    expect(cookEvents.length).toBeGreaterThanOrEqual(3);
    expect(cookEvents.every((e) => !!e.consentPurpose)).toBe(true);

    // durable outbox recorded the routing (idempotent: one row per event)
    const eventIds = (await prisma.userEvent.findMany({ where: { userId }, select: { id: true } })).map((e) => e.id);
    const outboxRows = await prisma.eventOutbox.findMany({ where: { eventId: { in: eventIds } }, select: { status: true } });
    expect(outboxRows.length).toBeGreaterThanOrEqual(3);

    // serve path runs the real ranker over the learned profile and returns a ranked slate
    const after = await request(app.getHttpServer()).get('/recommendations?limit=30').set('Authorization', `Bearer ${token}`).expect(200);
    expect(Array.isArray(after.body)).toBe(true);
    expect(after.body.length).toBeGreaterThan(0);
    // the served slate is shaped (recipeId + a finalScore) — the ranker actually ran end-to-end
    expect(after.body[0]).toHaveProperty('recipeId');
    expect(typeof after.body[0].finalScore).toBe('number');
  });
});
