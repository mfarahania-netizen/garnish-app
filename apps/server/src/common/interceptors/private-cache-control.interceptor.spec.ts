import { ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { PrivateCacheControlInterceptor } from './private-cache-control.interceptor';

describe('PrivateCacheControlInterceptor', () => {
  const makeContext = (
    request: Record<string, unknown>,
    initialVary?: string,
  ) => {
    const headers = new Map<string, string>();
    if (initialVary) headers.set('vary', initialVary);
    const response = {
      getHeader: jest.fn((name: string) => headers.get(name.toLowerCase())),
      setHeader: jest.fn((name: string, value: string) => {
        headers.set(name.toLowerCase(), value);
      }),
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
    return { context, response, headers };
  };

  it('marks a user-authenticated response private and non-storeable', async () => {
    const { context, headers } = makeContext({
      user: { id: 'account-a' },
      headers: {},
    });

    await firstValueFrom(
      new PrivateCacheControlInterceptor().intercept(context, {
        handle: () => of({ ok: true }),
      }),
    );

    expect(headers.get('cache-control')).toBe('private, no-store, max-age=0');
    expect(headers.get('vary')).toBe('Authorization');
  });

  it('treats any request carrying Authorization as private and preserves existing Vary values', async () => {
    const { context, headers } = makeContext(
      { headers: { authorization: 'Bearer token' } },
      'Accept-Encoding',
    );

    await firstValueFrom(
      new PrivateCacheControlInterceptor().intercept(context, {
        handle: () => of({ ok: true }),
      }),
    );

    expect(headers.get('cache-control')).toBe('private, no-store, max-age=0');
    expect(headers.get('vary')).toBe('Accept-Encoding, Authorization');
  });

  it('does not force private headers onto anonymous public responses', async () => {
    const { context, response } = makeContext({ headers: {} });

    await firstValueFrom(
      new PrivateCacheControlInterceptor().intercept(context, {
        handle: () => of({ ok: true }),
      }),
    );

    expect(response.setHeader).not.toHaveBeenCalled();
  });

  it.each(['/auth/login', '/auth/register', '/auth/otp/verify', '/auth/google'])(
    'marks anonymous credential-bearing response %s as no-store',
    async (originalUrl) => {
      const { context, headers } = makeContext({ headers: {}, originalUrl });

      await firstValueFrom(
        new PrivateCacheControlInterceptor().intercept(context, {
          handle: () => of({ token: 'sensitive-token' }),
        }),
      );

      expect(headers.get('cache-control')).toBe('private, no-store, max-age=0');
      expect(headers.get('vary')).toBe('Authorization');
    },
  );
});
