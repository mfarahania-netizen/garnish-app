import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Advisor audit P1-15 — locks in the P0 security tier so a re-audit can PROVE the guarantees hold, not take
 * them on faith. Covers: the admin role gate (RolesGuard), the owner gate on destructive ops (OwnerGuard),
 * mandatory-reason (requireReason), the erasure-proof audit trail (P0-3, keyed to the ACTOR), the workflow
 * 404, and the DTO whitelist (P1-1, forbidNonWhitelisted).
 *
 * Identity plumbing: jwt.strategy loads isAdmin from the DB on every request, so flipping isAdmin in the DB
 * is enough — no re-login. The user id is read from the JWT `sub` claim (the register response is minimized
 * and phones may be normalized, so neither the body nor a phone lookup is reliable). OwnerGuard reads
 * ADMIN_OWNER_IDS live. Phones are unique per run so a prior crashed run can't collide; teardown is by id.
 */
describe('Admin security (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  const ownerEnvBefore = process.env.ADMIN_OWNER_IDS;
  const createdIds: string[] = [];
  let RUN = '';

  /** Register a real user; read its id from the JWT sub; optionally flip isAdmin in the DB (same token then
   *  authenticates as admin, because jwt.strategy reads isAdmin from the DB on each request). */
  async function makeUser(idx: number, isAdmin = false): Promise<{ id: string; token: string }> {
    // Create the user DIRECTLY (bypassing /auth/register, which is rate-limited) and mint a JWT the same way the
    // app does — jwt.strategy then loads this user (and its isAdmin) from the DB on each request.
    const phone = `0912${RUN}${String(idx).padStart(2, '0')}`; // 11 digits, valid prefix, unique per run
    const user = await prisma.user.create({ data: { phone, name: 'sec test', isAdmin } });
    createdIds.push(user.id);
    const token = jwtService.sign({ sub: user.id, epoch: (user as any).sessionEpoch ?? 0 });
    return { id: user.id, token };
  }

  async function cleanup() {
    if (!createdIds.length) return;
    await prisma.userAuditLog.deleteMany({ where: { userId: { in: createdIds } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: createdIds } } }).catch(() => {});
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService, { strict: false });
    RUN = String(Date.now()).slice(-5); // 5-digit run segment → phone stays 11 digits, unique per run
  });

  afterAll(async () => {
    await cleanup();
    process.env.ADMIN_OWNER_IDS = ownerEnvBefore; // restore — don't leak the test allowlist
    await app.close();
  });

  it('RolesGuard: a non-admin is blocked from /admin (403)', async () => {
    const u = await makeUser(1);
    await request(app.getHttpServer()).get('/admin/users').set('Authorization', `Bearer ${u.token}`).expect(403);
  });

  it('OwnerGuard: an admin who is NOT an owner cannot delete a user (403)', async () => {
    const admin = await makeUser(2, true);
    const victim = await makeUser(3);
    process.env.ADMIN_OWNER_IDS = 'someone-else-entirely'; // this admin is deliberately not in the allowlist
    await request(app.getHttpServer())
      .delete(`/admin/users/${victim.id}`)
      .send({ reason: 'should not matter — owner gate fires first' })
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(403);
  });

  it('requireReason: even an owner cannot delete without a reason (400)', async () => {
    const admin = await makeUser(4, true);
    const victim = await makeUser(5);
    process.env.ADMIN_OWNER_IDS = admin.id; // now a genuine owner
    await request(app.getHttpServer())
      .delete(`/admin/users/${victim.id}`)
      .send({})
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(400);
  });

  it('P0-3: an owner delete succeeds AND the audit row survives keyed to the ACTOR (erasure-proof)', async () => {
    const admin = await makeUser(6, true);
    const victim = await makeUser(7);
    process.env.ADMIN_OWNER_IDS = admin.id;
    const del = await request(app.getHttpServer())
      .delete(`/admin/users/${victim.id}`)
      .send({ reason: 'e2e — erasure-proof audit' })
      .set('Authorization', `Bearer ${admin.token}`);
    expect(del.status).toBeGreaterThanOrEqual(200);
    expect(del.status).toBeLessThan(300); // 200/204 both acceptable for a successful delete

    // keyed to the admin (actor), so the victim's own erasure (which scrubs WHERE userId = victim) can't touch it
    const auditRow = await prisma.userAuditLog.findFirst({
      where: { userId: admin.id, action: 'admin_user_delete' },
      orderBy: { createdAt: 'desc' },
    });
    expect(auditRow).toBeTruthy();
    const details = JSON.parse(auditRow!.details || '{}');
    expect(details.targetId).toBe(victim.id);
    expect(details.reason).toBe('e2e — erasure-proof audit');
  });

  it('Workflow: an unknown workflow key returns 404 (not a 200 with {error})', async () => {
    const admin = await makeUser(8, true);
    await request(app.getHttpServer())
      .post('/admin/workflows/__no_such_workflow__/run')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(404);
  });

  it('P1-1 DTO: an undeclared field on user-create is rejected (400, forbidNonWhitelisted)', async () => {
    const admin = await makeUser(9, true);
    process.env.ADMIN_OWNER_IDS = admin.id;
    await request(app.getHttpServer())
      .post('/admin/users')
      .send({ phone: `0912${RUN}88`, password: 'testpass9', HACKER_FIELD: 'x' })
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(400);
  });
});
