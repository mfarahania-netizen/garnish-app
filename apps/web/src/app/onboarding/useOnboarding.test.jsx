import { renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// REAL-hook test for the auth submit-validation (the part that made the button feel "dead").
// Executes the actual useOnboarding body — a mocked-hook smoke test could never reach this logic.

const { registerSpy, loginSpy, refreshUserSpy, authState } = vi.hoisted(() => ({ registerSpy: vi.fn(), loginSpy: vi.fn(), refreshUserSpy: vi.fn(), authState: { token: '' } }));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ register: registerSpy, login: loginSpy, refreshUser: refreshUserSpy, token: authState.token }),
}));
const apiMock = vi.hoisted(() => ({ post: vi.fn(), put: vi.fn(), get: vi.fn(), patch: vi.fn() }));
vi.mock('../../lib/apiClient', () => ({ default: apiMock }));

import { useOnboarding } from './useOnboarding';

const wrapper = ({ children }) => <MemoryRouter>{children}</MemoryRouter>;

beforeEach(() => {
  registerSpy.mockReset().mockResolvedValue(undefined);
  loginSpy.mockReset().mockResolvedValue(undefined);
  refreshUserSpy.mockReset().mockResolvedValue(undefined);
  authState.token = '';
  apiMock.post.mockReset().mockResolvedValue({ data: {} });
  apiMock.put.mockReset().mockResolvedValue({ data: {} });
  apiMock.get.mockReset().mockResolvedValue({ data: {} });
  apiMock.patch.mockReset().mockResolvedValue({ data: { onboardingComplete: true } });
});

describe('useOnboarding auth submit', () => {
  it('signup: submitting without consent does NOT call register and explains what is missing', async () => {
    const { result } = renderHook(() => useOnboarding(), { wrapper });
    act(() => result.current.setPhone('09123456789'));
    act(() => result.current.setPassword('password123'));
    // consent intentionally left false (the common "button does nothing" case)
    await act(async () => { await result.current.submit(); });
    expect(registerSpy).not.toHaveBeenCalled();
    expect(result.current.error).toMatch(/موافقت/);
  });

  it('signup: with phone + 8+ password + consent, calls register with the normalized phone', async () => {
    const { result } = renderHook(() => useOnboarding(), { wrapper });
    act(() => result.current.setPhone('۰۹۱۲۳۴۵۶۷۸۹')); // Persian digits accepted
    act(() => result.current.setPassword('password123'));
    act(() => result.current.toggleConsent());
    await act(async () => { await result.current.submit(); });
    expect(registerSpy).toHaveBeenCalledWith('09123456789', 'password123');
  });

  it('signup: forgives a +98 phone prefix', async () => {
    const { result } = renderHook(() => useOnboarding(), { wrapper });
    act(() => result.current.setPhone('+98 912 345 6789'));
    act(() => result.current.setPassword('password123'));
    act(() => result.current.toggleConsent());
    await act(async () => { await result.current.submit(); });
    expect(registerSpy).toHaveBeenCalledWith('09123456789', 'password123');
  });

  it('login: a 6-char password is accepted (server min is 6 — must NOT be blocked at 8)', async () => {
    const { result } = renderHook(() => useOnboarding(), { wrapper });
    act(() => result.current.goLogin()); // login mode
    act(() => result.current.setPhone('09123456789'));
    act(() => result.current.setPassword('abc123')); // 6 chars
    await act(async () => { await result.current.submit(); });
    expect(loginSpy).toHaveBeenCalledWith('09123456789', 'abc123');
    expect(registerSpy).not.toHaveBeenCalled();
  });

  it('invalid phone surfaces a friendly error and submits nothing', async () => {
    const { result } = renderHook(() => useOnboarding(), { wrapper });
    act(() => result.current.setPhone('12345'));
    act(() => result.current.setPassword('password123'));
    act(() => result.current.toggleConsent());
    await act(async () => { await result.current.submit(); });
    expect(registerSpy).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.error).toMatch(/موبایل/));
  });

  it('finish: authenticated onboarding completion persists profile and marks backend complete', async () => {
    authState.token = 'registered-token';
    const { result } = renderHook(() => useOnboarding(), { wrapper });
    await act(async () => { await result.current.finish(); });
    expect(apiMock.put).toHaveBeenCalledWith('/users/preferences', expect.any(Object));
    expect(apiMock.patch).toHaveBeenCalledWith('/users/me/onboarding-complete');
    expect(refreshUserSpy).toHaveBeenCalled();
  });
});
