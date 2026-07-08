import { AuthService } from './auth.service';
import * as bcrypt from 'bcryptjs';
import { UnauthorizedException } from '@nestjs/common';

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

    await makeAuth(usersService, jwtService, { userEvent: { create: jest.fn().mockResolvedValue(null) } } as any).register('+989125859634', 'password8', 'Test');

    expect(usersService.findByPhone).toHaveBeenCalledWith('09125859634');
    expect(usersService.createUser).toHaveBeenCalledWith('09125859634', 'password8', 'Test');
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

  it('verifies OTP, creates a passwordless user when phone is new, and signs in', async () => {
    const codeHash = await bcrypt.hash('123456', 10);
    const createdUser = { id: 'u-new', phone: '09125859634', isGuest: false, password: null, sessionEpoch: 0 };
    const usersService: any = {
      findByPhone: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(null),
      createPasswordlessUser: jest.fn().mockResolvedValue(createdUser),
    };
    const jwtService: any = { sign: jest.fn().mockReturnValue('tok') };
    const prisma: any = {
      authOtpCode: {
        findFirst: jest.fn().mockResolvedValue({ id: 'otp1', phone: '09125859634', codeHash, attempts: 0 }),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      user: { update: jest.fn().mockResolvedValue(createdUser) },
      $transaction: jest.fn(async (fn) => fn({ authOtpCode: prisma.authOtpCode, user: prisma.user })),
      userEvent: { create: jest.fn().mockResolvedValue(null) },
    };

    const res = await makeAuth(usersService, jwtService, prisma).verifyOtp('+989125859634', '123456', 'Test');

    expect(usersService.createPasswordlessUser).toHaveBeenCalledWith('09125859634', 'Test');
    expect(jwtService.sign).toHaveBeenCalledWith({ sub: 'u-new', epoch: 0 });
    expect(res.token).toBe('tok');
    expect(res.created).toBe(true);
    expect(res.user?.onboardingComplete).toBe(false);
    expect((res.user as any).password).toBeUndefined();
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

  it('links googleId to an existing same-email registered user', async () => {
    const existing = { id: 'u-email', email: profile.email, name: null, avatar: null, isGuest: false, sessionEpoch: 0 };
    const linked = { ...existing, googleId: profile.googleId, name: profile.name, avatar: profile.picture };
    const prisma: any = prismaBase();
    prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(existing);
    prisma.user.update.mockResolvedValue(linked);

    await makeAuth({}, { sign: jest.fn().mockReturnValue('tok') }, prisma, undefined, { verifyCredential: jest.fn().mockResolvedValue(profile) }).googleLogin('credential');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u-email' },
      data: expect.objectContaining({
        googleId: profile.googleId,
        authProvider: 'google',
        isGuest: false,
        deviceKey: null,
      }),
    });
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
