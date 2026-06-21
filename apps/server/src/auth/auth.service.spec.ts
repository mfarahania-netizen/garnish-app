import { AuthService } from './auth.service';

describe('AuthService.guestSession (onboarding v1 guest spine)', () => {
  it('mints a guest, signs a 24h JWT with sub only, returns the deviceKey at top level + a sanitized user', async () => {
    const usersService: any = {
      findOrCreateGuest: jest.fn().mockResolvedValue({ id: 'g1', isGuest: true, deviceKey: 'server-key', phone: null, password: 'secret-hash' }),
    };
    const jwtService: any = { sign: jest.fn().mockReturnValue('tok') };
    const res = await new AuthService(usersService, jwtService).guestSession('dk');

    expect(usersService.findOrCreateGuest).toHaveBeenCalledWith('dk');
    expect(jwtService.sign).toHaveBeenCalledWith({ sub: 'g1' }, { expiresIn: '24h' }); // sub only, short-lived
    expect(res.token).toBe('tok');
    expect(res.deviceKey).toBe('server-key'); // returned ONLY to the owning client so it can resume
    expect(res.user?.id).toBe('g1');
    expect((res.user as any)?.password).toBeUndefined(); // sanitized (allow-list)
    expect((res.user as any)?.deviceKey).toBeUndefined(); // the secret is NOT inside the user object
  });

  it('mints a fresh guest when no deviceKey is supplied', async () => {
    const usersService: any = { findOrCreateGuest: jest.fn().mockResolvedValue({ id: 'g2', isGuest: true, deviceKey: 'k2' }) };
    const jwtService: any = { sign: jest.fn().mockReturnValue('tok2') };
    const res = await new AuthService(usersService, jwtService).guestSession(undefined);
    expect(usersService.findOrCreateGuest).toHaveBeenCalledWith(undefined);
    expect(res.token).toBe('tok2');
    expect(res.deviceKey).toBe('k2');
  });
});
