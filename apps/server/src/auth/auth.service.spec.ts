import { AuthService } from './auth.service';

describe('AuthService.guestSession (onboarding v1 guest spine)', () => {
  it('mints a guest, signs a JWT with sub only, returns a sanitized user (no password/PII)', async () => {
    const usersService: any = {
      findOrCreateGuest: jest.fn().mockResolvedValue({ id: 'g1', isGuest: true, deviceKey: 'dk', phone: null, password: 'secret-hash' }),
    };
    const jwtService: any = { sign: jest.fn().mockReturnValue('tok') };
    const res = await new AuthService(usersService, jwtService).guestSession('dk');

    expect(usersService.findOrCreateGuest).toHaveBeenCalledWith('dk');
    expect(jwtService.sign).toHaveBeenCalledWith({ sub: 'g1' }); // sub only — no PII in the token
    expect(res.token).toBe('tok');
    expect(res.user?.id).toBe('g1');
    expect((res.user as any)?.password).toBeUndefined(); // sanitized
  });

  it('mints an ephemeral guest when no deviceKey is supplied', async () => {
    const usersService: any = { findOrCreateGuest: jest.fn().mockResolvedValue({ id: 'g2', isGuest: true }) };
    const jwtService: any = { sign: jest.fn().mockReturnValue('tok2') };
    const res = await new AuthService(usersService, jwtService).guestSession(undefined);
    expect(usersService.findOrCreateGuest).toHaveBeenCalledWith(undefined);
    expect(res.token).toBe('tok2');
  });
});
