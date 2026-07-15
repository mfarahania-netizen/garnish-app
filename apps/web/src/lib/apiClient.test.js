const axiosHarness = vi.hoisted(() => {
  const requestUse = vi.fn();
  const responseUse = vi.fn();
  return {
    requestUse,
    responseUse,
    client: {
      interceptors: {
        request: { use: requestUse },
        response: { use: responseUse },
      },
    },
  };
});

const sessionHarness = vi.hoisted(() => ({
  clearPrivateSessionState: vi.fn((options = {}) => {
    if (options.clearAccountStorage) localStorage.removeItem('token');
    return Promise.resolve([]);
  }),
  resetBrowserToLogin: vi.fn(),
}));
const analyticsHarness = vi.hoisted(() => ({ disableAnalytics: vi.fn() }));

vi.mock('axios', () => ({
  default: { create: vi.fn(() => axiosHarness.client) },
}));
vi.mock('./private-session-cache', () => sessionHarness);
vi.mock('./analytics-init', () => analyticsHarness);

import './apiClient';

const requestSuccess = axiosHarness.requestUse.mock.calls[0][0];
const responseSuccess = axiosHarness.responseUse.mock.calls[0][0];
const responseError = axiosHarness.responseUse.mock.calls[0][1];

describe('apiClient 401 isolation', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionHarness.clearPrivateSessionState.mockClear();
    sessionHarness.clearPrivateSessionState.mockImplementation((options = {}) => {
      if (options.clearAccountStorage) localStorage.removeItem('token');
      return Promise.resolve([]);
    });
    sessionHarness.resetBrowserToLogin.mockClear();
    analyticsHarness.disableAnalytics.mockClear();
  });

  it('purges private state and performs a full login reset after session invalidation', async () => {
    localStorage.setItem('token', 'expired-account-a-token');
    const error = { response: { status: 401 }, config: { url: '/users/me' } };

    await expect(responseError(error)).rejects.toBe(error);

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('garnish.sessionExpired')).toBe('true');
    expect(sessionHarness.clearPrivateSessionState).toHaveBeenCalledWith({ clearAccountStorage: true });
    expect(sessionHarness.resetBrowserToLogin).toHaveBeenCalledTimes(1);
    expect(analyticsHarness.disableAnalytics).toHaveBeenCalledTimes(1);
  });

  it('ignores a delayed account-A 401 after account B has already installed its token', async () => {
    localStorage.setItem('token', 'account-b-token');
    const error = {
      response: { status: 401 },
      config: { url: '/users/me', headers: { Authorization: 'Bearer account-a-token' } },
    };

    await expect(responseError(error)).rejects.toBe(error);

    expect(localStorage.getItem('token')).toBe('account-b-token');
    expect(analyticsHarness.disableAnalytics).not.toHaveBeenCalled();
    expect(sessionHarness.clearPrivateSessionState).not.toHaveBeenCalled();
    expect(sessionHarness.resetBrowserToLogin).not.toHaveBeenCalled();
  });

  it.each([
    '/auth/login',
    '/auth/otp/request',
    '/auth/otp/verify',
    '/auth/google',
    '/auth/password-reset/confirm',
  ])('does not destroy an existing session for an expected failed auth attempt at %s', async (url) => {
    localStorage.setItem('token', 'existing-token');
    const error = { response: { status: 401 }, config: { url } };

    await expect(responseError(error)).rejects.toBe(error);

    expect(localStorage.getItem('token')).toBe('existing-token');
    expect(sessionHarness.clearPrivateSessionState).not.toHaveBeenCalled();
    expect(sessionHarness.resetBrowserToLogin).not.toHaveBeenCalled();
  });
});

describe('apiClient request session binding', () => {
  it('preserves an explicit captured-session Authorization header across a token replacement', () => {
    localStorage.setItem('token', 'account-b-token');
    const config = { headers: { Authorization: 'Bearer account-a-token' } };

    expect(requestSuccess(config)).toBe(config);
    expect(config.headers.Authorization).toBe('Bearer account-a-token');
    expect(config.garnishAuthToken).toBe('account-a-token');
  });

  it('rejects a delayed successful private response after the bound account changes', async () => {
    localStorage.setItem('token', 'account-b-token');
    const response = {
      data: { id: 'account-a' },
      config: { garnishAuthToken: 'account-a-token' },
    };

    await expect(responseSuccess(response)).rejects.toMatchObject({
      code: 'AUTH_SESSION_CHANGED',
    });
  });
});
