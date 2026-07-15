import { AuthService } from './auth.service';
import * as bcrypt from 'bcryptjs';
import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';

function makeAuth(
  usersService: any,
  jwtService: any,
  prisma: any,
  sms: any = { sendPasswordResetCode: jest.fn() },
  googleTokens: any = { verifyCredential: jest.fn() },
) {
  return new AuthService(usersService, jwtService, prisma, sms, googleTokens);
}

describe('AuthService.guestSession (onboarding v1 guest spine)', () => {
  const OLD_ENV = process.env.ENABLE_GUEST_AUTH;
  beforeEach(() => { process.env.ENABLE_GUEST_AUTH = 'true'; });
  afterAll(() => {
    if (OLD_ENV === undefined) delete process.env.ENABLE_GUEST_AUTH;
    else process.env.ENABLE_GUEST_AUTH = OLD_ENV;
  });

  it('is disabled unless ENABLE_GUEST_AUTH is true', async () => {
    delete process.env.ENABLE_GUEST_AUTH;
    const usersService: any = { findOrCreateGuest: jest.fn() };
    const jwtService: any = { sign: jest.fn() };
    await expect(makeAuth(usersService, jwtService, { userEvent: { create: jest.fn() } } as any).guestSession()).rejects.toThrow('guest_auth_disabled');
    expect(usersService.findOrCreateGuest).not.toHaveBeenCalled();
  });

  it('mints a guest, signs a 24h JWT with sub only, returns the deviceKey at top level + a sanitized user', async () => {
    const usersService: any = {
      findOrCreateGuest: jest.fn().mockResolvedValue({ id: 'g1', isGuest: true, deviceKey: 'server-key', phone: null, password: 'secret-hash' }),
    };
    const jwtService: any = { sign: jest.fn().mockReturnValue('tok') };
    const res = await makeAuth(usersService, jwtService, { userEvent: { create: jest.fn() } } as any).guestSession('dk');

    expect(usersService.findOrCreateGuest).toHaveBeenCalledWith('dk');
    expect(jwtService.sign).toHaveBeenCalledWith({ sub: 'g1', epoch: 0 }, { expiresIn: '24h' }); // sub + invalidation epoch, short-lived
    expect(res.token).toBe('tok');
    expect(res.deviceKey).toBe('server-key'); // returned ONLY to the owning client so it can resume
    expect(res.user?.id).toBe('g1');
    expect((res.user as any)?.password).toBeUndefined(); // sanitized (allow-list)
    expect((res.user as any)?.deviceKey).toBeUndefined(); // the secret is NOT inside the user object
  });

  it('mints a fresh guest when no deviceKey is supplied', async () => {
    const usersService: any = { findOrCreateGuest: jest.fn().mockResolvedValue({ id: 'g2', isGuest: true, deviceKey: 'k2' }) };
    const jwtService: any = { sign: jest.fn().mockReturnValue('tok2') };
    const res = await makeAuth(usersService, jwtService, { userEvent: { create: jest.fn() } } as any).guestSession(undefined);
    expect(usersService.findOrCreateGuest).toHaveBeenCalledWith(undefined);
    expect(res.token).toBe('tok2');
    expect(res.deviceKey).toBe('k2');
  });
});

describe('AuthService phone normalization', () => {
  it('logs in +98 mobile input against the canonical 09 DB phone', async () => {
    const hashed = await bcrypt.hash('password8', 10);
    const user = {
      id: 'u1',
      phone: '09125859634',
      password: hashed,
      isGuest: false,
      onboardingCompletedAt: new Date(),
      sessionEpoch: 0,
    };
    const usersService: any = {
      findByPhone: jest.fn().mockResolvedValue(user),
    };
    const jwtService: any = { sign: jest.fn().mockReturnValue('tok') };

    const res = await makeAuth(usersService, jwtService, { userEvent: { create: jest.fn() } } as any).login('+989125859634', 'password8');

    expect(usersService.findByPhone).toHaveBeenCalledWith('09125859634');
    expect(res.token).toBe('tok');
    expect(res.user?.phone).toBe('09125859634');
    expect(res.user?.onboardingComplete).toBe(true);
  });

  it('registers +98 mobile input as the canonical 09 DB phone', async () => {
    const usersService: any = {
      findByPhone: jest.fn().mockResolvedValue(null),
      createUser: jest.fn().mockResolvedValue({ id: 'u2', phone: '09125859634', isGuest: false, sessionEpoch: 0 }),
    };
    const jwtService: any = { sign: jest.fn().mockReturnValue('tok') };
    const userEventCreate = jest.fn().mockResolvedValue(null);

    await makeAuth(usersService, jwtService, { userEvent: { create: userEventCreate } } as any).register('+989125859634', 'password8', 'Test');

    expect(usersService.findByPhone).toHaveBeenCalledWith('09125859634');
    expect(usersService.createUser).toHaveBeenCalledWith('09125859634', 'password8', 'Test');
    expect(userEventCreate).not.toHaveBeenCalled();
  });
});

describe('AuthService password reset', () => {
  it('returns the same request response for unknown phones and does not send SMS', async () => {
    const usersService: any = { findByPhone: jest.fn().mockResolvedValue(null) };
    const sms: any = { sendPasswordResetCode: jest.fn() };
    const prisma: any = { passwordResetCode: { count: jest.fn(), create: jest.fn() }, userEvent: { create: jest.fn() } };

    const res = await makeAuth(usersService, { sign: jest.fn() }, prisma, sms).requestPasswordReset('+989125859634');

    expect(res.ok).toBe(true);
    expect(usersService.findByPhone).toHaveBeenCalledWith('09125859634');
    expect(sms.sendPasswordResetCode).not.toHaveBeenCalled();
  });

  it('creates a hashed one-time code and sends it for a registered user', async () => {
    const usersService: any = { findByPhone: jest.fn().mockResolvedValue({ id: 'u1', phone: '09125859634', isGuest: false }) };
    const sms: any = { sendPasswordResetCode: jest.fn() };
    const prisma: any = {
      passwordResetCode: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'r1' }),
      },
      userEvent: { create: jest.fn() },
    };

    await makeAuth(usersService, { sign: jest.fn() }, prisma, sms).requestPasswordReset('+989125859634');

    expect(prisma.passwordResetCode.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1',
        phone: '09125859634',
        codeHash: expect.not.stringMatching(/^\d{6}$/),
        expiresAt: expect.any(Date),
      }),
    });
    expect(sms.sendPasswordResetCode).toHaveBeenCalledWith('09125859634', expect.stringMatching(/^\d{6}$/));
  });

  it('confirms a valid code, hashes the new password, consumes codes, and bumps session epoch', async () => {
    const codeHash = await bcrypt.hash('123456', 10);
    const usersService: any = { findByPhone: jest.fn().mockResolvedValue({ id: 'u1', phone: '09125859634', isGuest: false }) };
    const prisma: any = {
      passwordResetCode: {
        findFirst: jest.fn().mockResolvedValue({ id: 'r1', codeHash, attempts: 0 }),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      user: { update: jest.fn() },
      $transaction: jest.fn(async (ops) => Promise.all(ops)),
      userEvent: { create: jest.fn() },
    };

    const res = await makeAuth(usersService, { sign: jest.fn() }, prisma).confirmPasswordReset('+989125859634', '123456', 'newPassword8');

    expect(res.ok).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { password: expect.stringMatching(/^\$2/), sessionEpoch: { increment: 1 } },
    });
    expect(prisma.passwordResetCode.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { consumedAt: expect.any(Date) },
    });
  });
});

describe('AuthService OTP login/signup', () => {
  const OLD_ENV = { ...process.env };

  beforeEach(() => {
    process.env.OTP_TTL_SECONDS = '120';
    process.env.OTP_RESEND_COOLDOWN_SECONDS = '60';
    process.env.OTP_MAX_ATTEMPTS = '5';
    process.env.OTP_DAILY_LIMIT_PER_PHONE = '10';
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('creates a hashed OTP and sends one pattern variable', async () => {
    const usersService: any = { findByPhone: jest.fn().mockResolvedValue(null) };
    const sms: any = { sendOtpCode: jest.fn() };
    const prisma: any = {
      authOtpCode: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'otp1' }),
      },
      $transaction: jest.fn(async (fn) => fn({ authOtpCode: prisma.authOtpCode })),
      userEvent: { create: jest.fn() },
    };

    const res = await makeAuth(usersService, { sign: jest.fn() }, prisma, sms).requestOtp('+989125859634');

    expect(res.ok).toBe(true);
    expect(res.ttlSeconds).toBe(120);
    expect(res.resendCooldownSeconds).toBe(60);
    expect(prisma.authOtpCode.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        phone: '09125859634',
        codeHash: expect.not.stringMatching(/^\d{6}$/),
        purpose: 'login',
        expiresAt: expect.any(Date),
      }),
    });
    expect(sms.sendOtpCode).toHaveBeenCalledWith('09125859634', expect.stringMatching(/^\d{6}$/));
  });

  it('uses launch OTP defaults when env does not override ttl or cooldown', async () => {
    delete process.env.OTP_TTL_SECONDS;
    delete process.env.OTP_RESEND_COOLDOWN_SECONDS;
    const usersService: any = { findByPhone: jest.fn().mockResolvedValue(null) };
    const sms: any = { sendOtpCode: jest.fn() };
    const prisma: any = {
      authOtpCode: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'otp-defaults' }),
      },
      $transaction: jest.fn(async (fn) => fn({ authOtpCode: prisma.authOtpCode })),
      userEvent: { create: jest.fn() },
    };

    const res = await makeAuth(usersService, { sign: jest.fn() }, prisma, sms).requestOtp('09125859634');

    expect(res.ttlSeconds).toBe(120);
    expect(res.resendCooldownSeconds).toBe(60);
  });

  it('returns the generic OTP acknowledgement for a banned phone without persisting or sending a code', async () => {
    const usersService: any = {
      findByPhone: jest.fn().mockResolvedValue({ id: 'u-banned', isBanned: true }),
    };
    const sms: any = { sendOtpCode: jest.fn() };
    const prisma: any = {
      authOtpCode: {
        count: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    await expect(makeAuth(usersService, { sign: jest.fn() }, prisma, sms).requestOtp('09125859634'))
      .resolves.toEqual({
        ok: true,
        ttlSeconds: 120,
        resendCooldownSeconds: 60,
        message: 'کد ورود برای شما ارسال شد.',
      });

    expect(prisma.authOtpCode.count).not.toHaveBeenCalled();
    expect(prisma.authOtpCode.findFirst).not.toHaveBeenCalled();
    expect(prisma.authOtpCode.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(sms.sendOtpCode).not.toHaveBeenCalled();
  });

  it('preserves the previous live OTP when the SMS provider rejects the new send', async () => {
    const usersService: any = { findByPhone: jest.fn().mockResolvedValue({ id: 'u1', isBanned: false }) };
    const smsError = new Error('provider unavailable');
    const sms: any = { sendOtpCode: jest.fn().mockRejectedValue(smsError) };
    const prisma: any = {
      authOtpCode: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'otp-unsent' }),
        updateMany: jest.fn(),
        delete: jest.fn().mockResolvedValue({ id: 'otp-unsent' }),
      },
      $transaction: jest.fn(async (fn) => fn({ authOtpCode: prisma.authOtpCode })),
    };

    await expect(makeAuth(usersService, { sign: jest.fn() }, prisma, sms).requestOtp('09125859634'))
      .rejects.toBe(smsError);

    expect(prisma.authOtpCode.delete).toHaveBeenCalledWith({ where: { id: 'otp-unsent' } });
    expect(prisma.authOtpCode.updateMany).not.toHaveBeenCalled();
  });

  it('returns success with a usable newest OTP when post-send retirement cleanup fails', async () => {
    let createdCodeHash = '';
    let sentCode = '';
    const sms: any = {
      sendOtpCode: jest.fn(async (_phone: string, code: string) => {
        sentCode = code;
      }),
    };
    const prisma: any = {
      authOtpCode: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: any) => {
          createdCodeHash = data.codeHash;
          return { id: 'otp-provider-accepted' };
        }),
        updateMany: jest.fn().mockRejectedValue(new Error('database cleanup failed')),
        delete: jest.fn(),
      },
      $transaction: jest.fn(async (fn) => fn({ authOtpCode: prisma.authOtpCode })),
    };
    const service = makeAuth(
      { findByPhone: jest.fn().mockResolvedValue(null) },
      { sign: jest.fn() },
      prisma,
      sms,
    );
    const warn = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);

    await expect(service.requestOtp('09125859634')).resolves.toEqual(expect.objectContaining({ ok: true }));

    expect(sms.sendOtpCode).toHaveBeenCalledTimes(1);
    expect(sentCode).toMatch(/^\d{6}$/);
    await expect(bcrypt.compare(sentCode, createdCodeHash)).resolves.toBe(true);
    expect(prisma.authOtpCode.delete).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('Failed to retire prior login OTP codes after SMS acceptance');
  });

  it('serializes concurrent requests for one phone so only one SMS is sent', async () => {
    let created = false;
    let transactionQueue = Promise.resolve();
    const authOtpCode: any = {
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn(async () => (created ? { id: 'otp-winner', createdAt: new Date() } : null)),
      create: jest.fn(async () => {
        created = true;
        return { id: 'otp-winner' };
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    };
    const prisma: any = {
      authOtpCode,
      $transaction: jest.fn((fn) => {
        const result = transactionQueue.then(() => fn({ authOtpCode }));
        transactionQueue = result.then(() => undefined, () => undefined);
        return result;
      }),
    };
    const sms: any = { sendOtpCode: jest.fn().mockResolvedValue(undefined) };
    const service = makeAuth({ findByPhone: jest.fn().mockResolvedValue(null) }, { sign: jest.fn() }, prisma, sms);

    const outcomes = await Promise.allSettled([
      service.requestOtp('09125859634'),
      service.requestOtp('09125859634'),
    ]);

    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1);
    expect((outcomes.find((outcome) => outcome.status === 'rejected') as PromiseRejectedResult).reason)
      .toBeInstanceOf(ForbiddenException);
    expect(sms.sendOtpCode).toHaveBeenCalledTimes(1);
    expect(authOtpCode.create).toHaveBeenCalledTimes(1);
  });

  it('maps a Serializable OTP request conflict to the stable cooldown response', async () => {
    const sms: any = { sendOtpCode: jest.fn() };
    const prisma: any = {
      authOtpCode: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn().mockRejectedValue({ code: 'P2034' }),
    };

    await expect(makeAuth({ findByPhone: jest.fn().mockResolvedValue(null) }, { sign: jest.fn() }, prisma, sms)
      .requestOtp('09125859634')).rejects.toThrow('otp_resend_cooldown');
    expect(sms.sendOtpCode).not.toHaveBeenCalled();
  });

  it('verifies OTP, creates a passwordless user when phone is new, and signs in', async () => {
    const codeHash = await bcrypt.hash('123456', 10);
    const createdUser = {
      id: 'u-new',
      phone: '09125859634',
      isGuest: false,
      password: null,
      sessionEpoch: 0,
      onboardingCompletedAt: null,
    };
    const usersService: any = {
      findById: jest.fn().mockResolvedValue(createdUser),
    };
    const jwtService: any = { sign: jest.fn().mockReturnValue('tok') };
    const prisma: any = {
      authOtpCode: {
        findFirst: jest.fn().mockResolvedValue({ id: 'otp1', phone: '09125859634', codeHash, attempts: 0 }),
        updateMany: jest.fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue(createdUser),
      },
      $transaction: jest.fn(async (fn) => fn({ authOtpCode: prisma.authOtpCode, user: prisma.user })),
      userEvent: { create: jest.fn().mockResolvedValue(null) },
    };

    const res = await makeAuth(usersService, jwtService, prisma).verifyOtp('+989125859634', '123456', 'Test');

    expect(prisma.user.upsert).toHaveBeenCalledWith({
      where: { phone: '09125859634' },
      create: {
        phone: '09125859634',
        password: null,
        isGuest: false,
        name: 'Test',
      },
      update: { isGuest: false, deviceKey: null },
    });
    expect(usersService.findById).toHaveBeenCalledWith('u-new');
    expect(jwtService.sign).toHaveBeenCalledWith({ sub: 'u-new', epoch: 0 });
    expect(res.token).toBe('tok');
    expect(res.created).toBe(true);
    expect(res.user?.onboardingComplete).toBe(false);
    expect((res.user as any).password).toBeUndefined();
    expect(prisma.userEvent.create).not.toHaveBeenCalled();
  });

  it('atomically consumes a valid OTP so exactly one concurrent verifier receives a token', async () => {
    const codeHash = await bcrypt.hash('123456', 10);
    const user = {
      id: 'u-race',
      phone: '09125859634',
      isGuest: false,
      sessionEpoch: 0,
      onboardingCompletedAt: new Date(),
    };
    let consumed = false;
    const updateMany = jest.fn(async ({ where, data }: any) => {
      if (where.id === 'otp-race' && data.consumedAt) {
        if (consumed) return { count: 0 };
        consumed = true;
        return { count: 1 };
      }
      return { count: 0 };
    });
    const prisma: any = {
      authOtpCode: {
        findFirst: jest.fn().mockResolvedValue({ id: 'otp-race', phone: user.phone, codeHash, attempts: 0 }),
        updateMany,
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
        upsert: jest.fn().mockResolvedValue(user),
      },
      $transaction: jest.fn(async (fn) => fn({ authOtpCode: prisma.authOtpCode, user: prisma.user })),
    };
    const jwtService: any = { sign: jest.fn().mockReturnValue('tok-race') };
    const usersService: any = { findById: jest.fn().mockResolvedValue(user) };
    const service = makeAuth(usersService, jwtService, prisma);

    const outcomes = await Promise.allSettled([
      service.verifyOtp(user.phone, '123456'),
      service.verifyOtp(user.phone, '123456'),
    ]);

    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1);
    expect((outcomes.find((outcome) => outcome.status === 'rejected') as PromiseRejectedResult).reason)
      .toBeInstanceOf(UnauthorizedException);
    expect(jwtService.sign).toHaveBeenCalledTimes(1);
    expect(prisma.user.upsert).toHaveBeenCalledTimes(1);
  });

  it('keeps concurrent wrong guesses within the configured attempt budget', async () => {
    const codeHash = await bcrypt.hash('123456', 10);
    let attempts = 0;
    const updateMany = jest.fn(async () => {
      if (attempts >= 5) return { count: 0 };
      attempts += 1;
      return { count: 1 };
    });
    const prisma: any = {
      authOtpCode: {
        findFirst: jest.fn().mockResolvedValue({ id: 'otp-attempts', phone: '09125859634', codeHash, attempts: 0 }),
        updateMany,
      },
    };
    const service = makeAuth({}, { sign: jest.fn() }, prisma);

    const outcomes = await Promise.allSettled(
      Array.from({ length: 8 }, () => service.verifyOtp('09125859634', '000000')),
    );

    expect(outcomes.every((outcome) => outcome.status === 'rejected')).toBe(true);
    expect(attempts).toBe(5);
    expect(updateMany).toHaveBeenCalledTimes(8);
  });

  it('revalidates expiry and attempt state in the atomic claim before issuing a token', async () => {
    const codeHash = await bcrypt.hash('123456', 10);
    const prisma: any = {
      authOtpCode: {
        findFirst: jest.fn().mockResolvedValue({ id: 'otp-expired-race', phone: '09125859634', codeHash, attempts: 0 }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      user: { findUnique: jest.fn(), upsert: jest.fn() },
      $transaction: jest.fn(async (fn) => fn({ authOtpCode: prisma.authOtpCode, user: prisma.user })),
    };
    const jwtService: any = { sign: jest.fn() };

    await expect(makeAuth({}, jwtService, prisma).verifyOtp('09125859634', '123456'))
      .rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.upsert).not.toHaveBeenCalled();
    expect(jwtService.sign).not.toHaveBeenCalled();
  });
});

describe('AuthService Google Sign-In', () => {
  const profile = {
    googleId: 'google-sub-1',
    email: 'user@example.com',
    name: 'Google User',
    picture: 'https://lh3.googleusercontent.com/a/test',
  };

  function prismaBase(overrides: any = {}) {
    return {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      userEvent: { create: jest.fn().mockResolvedValue(null) },
      ...overrides,
    };
  }

  it('creates a new registered user from a verified Google token', async () => {
    const created = { id: 'u-google', ...profile, avatar: profile.picture, isGuest: false, sessionEpoch: 0, onboardingCompletedAt: null };
    const prisma: any = prismaBase();
    prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    prisma.user.create.mockResolvedValue(created);
    const jwtService: any = { sign: jest.fn().mockReturnValue('tok') };
    const googleTokens: any = { verifyCredential: jest.fn().mockResolvedValue(profile) };

    const res = await makeAuth({}, jwtService, prisma, undefined, googleTokens).googleLogin('credential');

    expect(googleTokens.verifyCredential).toHaveBeenCalledWith('credential');
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        googleId: profile.googleId,
        email: profile.email,
        authProvider: 'google',
        password: null,
        isGuest: false,
      }),
    });
    expect(res.token).toBe('tok');
    expect(res.user?.onboardingComplete).toBe(false);
    expect((res.user as any).isGuest).toBe(false);
    expect(prisma.userEvent.create).not.toHaveBeenCalled();
  });

  it('logs in an existing googleId user', async () => {
    const user = { id: 'u1', googleId: profile.googleId, email: profile.email, isGuest: false, sessionEpoch: 0, onboardingCompletedAt: new Date() };
    const prisma: any = prismaBase();
    prisma.user.findUnique.mockResolvedValueOnce(user);
    const jwtService: any = { sign: jest.fn().mockReturnValue('tok') };
    const res = await makeAuth({}, jwtService, prisma, undefined, { verifyCredential: jest.fn().mockResolvedValue(profile) }).googleLogin('credential');

    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(res.user?.onboardingComplete).toBe(true);
  });

  it('never auto-links Google to an existing same-email account without a verified link ceremony', async () => {
    const existing = { id: 'u-email', email: profile.email, name: null, avatar: null, isGuest: false, sessionEpoch: 0 };
    const prisma: any = prismaBase();
    prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(existing);
    const jwtService: any = { sign: jest.fn() };

    const error = await makeAuth({}, jwtService, prisma, undefined, { verifyCredential: jest.fn().mockResolvedValue(profile) })
      .googleLogin('credential')
      .catch((caught) => caught);

    expect(error).toBeInstanceOf(ConflictException);
    expect(error.getResponse()).toMatchObject({ code: 'google_account_link_required' });
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(jwtService.sign).not.toHaveBeenCalled();
  });

  it('recovers safely when two first-time callbacks race to create the same Google subject', async () => {
    const winner = {
      id: 'u-google-race',
      googleId: profile.googleId,
      email: profile.email,
      isGuest: false,
      sessionEpoch: 0,
      onboardingCompletedAt: null,
    };
    const prisma: any = prismaBase();
    prisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(winner);
    prisma.user.create.mockRejectedValue({ code: 'P2002' });
    const jwtService: any = { sign: jest.fn().mockReturnValue('tok-race') };

    const result = await makeAuth({}, jwtService, prisma, undefined, { verifyCredential: jest.fn().mockResolvedValue(profile) })
      .googleLogin('credential');

    expect(result.token).toBe('tok-race');
    expect(result.user?.id).toBe('u-google-race');
    expect(jwtService.sign).toHaveBeenCalledTimes(1);
  });

  it('fails closed when a create race is an email collision without the same Google subject', async () => {
    const prisma: any = prismaBase();
    prisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prisma.user.create.mockRejectedValue({ code: 'P2002' });
    const jwtService: any = { sign: jest.fn() };

    const error = await makeAuth({}, jwtService, prisma, undefined, { verifyCredential: jest.fn().mockResolvedValue(profile) })
      .googleLogin('credential')
      .catch((caught) => caught);

    expect(error).toBeInstanceOf(ConflictException);
    expect(error.getResponse()).toMatchObject({ code: 'google_account_link_required' });
    expect(jwtService.sign).not.toHaveBeenCalled();
  });

  it('rejects invalid audience, unverified email, or invalid token through the verifier', async () => {
    const prisma: any = prismaBase();
    await expect(
      makeAuth({}, { sign: jest.fn() }, prisma, undefined, { verifyCredential: jest.fn().mockRejectedValue(new UnauthorizedException('invalid_google_token')) }).googleLogin('bad-aud'),
    ).rejects.toThrow('invalid_google_token');
    await expect(
      makeAuth({}, { sign: jest.fn() }, prisma, undefined, { verifyCredential: jest.fn().mockRejectedValue(new UnauthorizedException('invalid_google_token')) }).googleLogin('unverified-email'),
    ).rejects.toThrow('invalid_google_token');
    await expect(
      makeAuth({}, { sign: jest.fn() }, prisma, undefined, { verifyCredential: jest.fn().mockRejectedValue(new UnauthorizedException('invalid_google_token')) }).googleLogin('invalid'),
    ).rejects.toThrow('invalid_google_token');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
