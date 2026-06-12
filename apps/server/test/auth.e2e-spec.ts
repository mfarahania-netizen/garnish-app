import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest'; // 👈 ایمپورت به صورت default import
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { phone: '09123456789' } });
  });

  it('/auth/register (POST) should create a new user', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ phone: '09123456789', password: '123456', name: 'کاربر تست' })
      .expect(201);

    expect(res.body.token).toBeDefined();
    expect(res.body.user.phone).toBe('09123456789');
    // E2: no password/hash must leak in the register response
    expect(res.body.user.password).toBeUndefined();
  });

  it('/auth/login (POST) should login with correct credentials', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ phone: '09123456789', password: '123456', name: 'کاربر تست' });

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ phone: '09123456789', password: '123456' })
      .expect(201);

    expect(res.body.token).toBeDefined();
  });

  it('/auth/login (POST) should fail with wrong password', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ phone: '09123456789', password: '123456', name: 'کاربر تست' });

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ phone: '09123456789', password: 'wrong' })
      .expect(401);
  });

  it('should get user profile with token', async () => {
    const { body } = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ phone: '09123456789', password: '123456', name: 'کاربر تست' });

    const token = body.token;

    const res = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.phone).toBe('09123456789');
  });

  // E2: no sensitive field may leave the server on any auth/user surface.
  it('should never leak password/hash in register, login, or /users/me', async () => {
    const FORBIDDEN = ['password', 'hash', 'passwordHash'];
    const assertClean = (user: any) => {
      expect(user).toBeDefined();
      for (const key of FORBIDDEN) expect(user[key]).toBeUndefined();
    };

    const reg = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ phone: '09123456789', password: '123456', name: 'کاربر تست' })
      .expect(201);
    assertClean(reg.body.user);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ phone: '09123456789', password: '123456' })
      .expect(201);
    assertClean(login.body.user);

    const me = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${login.body.token}`)
      .expect(200);
    assertClean(me.body);
  });
});