import { generateKeyPairSync, sign } from 'crypto';
import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { GoogleIdTokenService } from './google-id-token.service';

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signingKey(kid: string) {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = publicKey.export({ format: 'jwk' }) as any;
  const token = (payload: Record<string, unknown>) => {
    const header = encode({ alg: 'RS256', kid });
    const body = encode(payload);
    const signature = sign('RSA-SHA256', Buffer.from(`${header}.${body}`), privateKey).toString('base64url');
    return `${header}.${body}.${signature}`;
  };
  return { jwk: { ...jwk, kid, kty: 'RSA', alg: 'RS256', use: 'sig' }, token };
}

function googlePayload(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: 'google-subject',
    email: 'user@example.com',
    email_verified: true,
    aud: process.env.GOOGLE_CLIENT_ID,
    iss: 'https://accounts.google.com',
    iat: now,
    exp: now + 600,
    ...overrides,
  };
}

function jwksResponse(keys: unknown[]) {
  return {
    ok: true,
    headers: { get: jest.fn().mockReturnValue('public, max-age=3600') },
    json: jest.fn().mockResolvedValue({ keys }),
  } as any;
}

describe('GoogleIdTokenService', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.GOOGLE_AUTH_ENABLED = 'true';
    process.env.GOOGLE_CLIENT_ID = 'garnish-client.apps.googleusercontent.com';
    global.fetch = jest.fn();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('verifies a current Google signature and required identity claims', async () => {
    const key = signingKey('kid-current');
    (global.fetch as jest.Mock).mockResolvedValue(jwksResponse([key.jwk]));

    const result = await new GoogleIdTokenService().verifyCredential(key.token(googlePayload()));

    expect(result).toMatchObject({ googleId: 'google-subject', email: 'user@example.com' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('refreshes cached keys once when Google rotates to an unknown kid', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-15T10:00:00Z'));
    const oldKey = signingKey('kid-old');
    const newKey = signingKey('kid-new');
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(jwksResponse([oldKey.jwk]))
      .mockResolvedValueOnce(jwksResponse([newKey.jwk]));
    const service = new GoogleIdTokenService();
    await service.verifyCredential(oldKey.token(googlePayload()));
    jest.setSystemTime(new Date('2026-07-15T10:00:31Z'));

    const result = await service.verifyCredential(newKey.token(googlePayload()));

    expect(result.googleId).toBe('google-subject');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('rejects a token whose authorized party is a different OAuth client', async () => {
    const key = signingKey('kid-azp');
    (global.fetch as jest.Mock).mockResolvedValue(jwksResponse([key.jwk]));

    await expect(new GoogleIdTokenService().verifyCredential(key.token(googlePayload({
      aud: [process.env.GOOGLE_CLIENT_ID, 'other-client.apps.googleusercontent.com'],
      azp: 'other-client.apps.googleusercontent.com',
    })))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a multi-audience token that omits the authorized party', async () => {
    const key = signingKey('kid-missing-azp');
    (global.fetch as jest.Mock).mockResolvedValue(jwksResponse([key.jwk]));

    await expect(new GoogleIdTokenService().verifyCredential(key.token(googlePayload({
      aud: [process.env.GOOGLE_CLIENT_ID, 'other-client.apps.googleusercontent.com'],
      azp: undefined,
    })))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('maps a failed JWKS fetch to a stable service-unavailable error', async () => {
    const key = signingKey('kid-network-failure');
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network down'));

    await expect(new GoogleIdTokenService().verifyCredential(key.token(googlePayload())))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('aborts a hung JWKS request instead of hanging Google login', async () => {
    jest.useFakeTimers();
    const key = signingKey('kid-timeout');
    (global.fetch as jest.Mock).mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('aborted')));
    }));

    const assertion = expect(new GoogleIdTokenService().verifyCredential(key.token(googlePayload())))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    await jest.advanceTimersByTimeAsync(5000);
    await assertion;
  });
});
