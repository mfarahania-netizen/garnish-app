import { renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// REAL-hook test for the auth submit-validation (the part that made the button feel "dead").
// Executes the actual useOnboarding body — a mocked-hook smoke test could never reach this logic.

const { registerSpy, loginSpy } = vi.hoisted(() => ({ registerSpy: vi.fn(), loginSpy: vi.fn() }));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ register: registerSpy, login: loginSpy, token: '' }),
}));
vi.mock('../../lib/apiClient', () => ({
  default: { post: vi.fn().mockResolvedValue({ data: {} }), put: vi.fn().mockResolvedValue({ data: {} }), get: vi.fn().mockResolvedValue({ data: {} }) },
}));

import { useOnboarding } from './useOnboarding';

const wrapper = ({ children }) => <MemoryRouter>{children}</MemoryRouter>;

beforeEach(() => {
  registerSpy.mockReset().mockResolvedValue(undefined);
  loginSpy.mockReset().mockResolvedValue(undefined);
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
});
