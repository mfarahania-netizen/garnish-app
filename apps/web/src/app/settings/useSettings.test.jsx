import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const h = vi.hoisted(() => ({
  states: {},
  post: vi.fn(),
  put: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
  setQueryData: vi.fn(),
  invalidateQueries: vi.fn(),
  enableAnalytics: vi.fn(),
  disableAnalytics: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }) => h.states[queryKey.join('/')],
  useQueryClient: () => ({
    setQueryData: h.setQueryData,
    invalidateQueries: h.invalidateQueries,
  }),
}));
vi.mock('../../lib/apiClient', () => ({
  default: { get: h.get, put: h.put, post: h.post, delete: h.delete },
}));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ logout: vi.fn() }) }));
vi.mock('../../lib/analytics-init', () => ({
  hasAnalyticsConsent: () => true,
  enableAnalytics: h.enableAnalytics,
  disableAnalytics: h.disableAnalytics,
}));

import { useSettings } from './useSettings';

const wrapper = ({ children }) => <MemoryRouter>{children}</MemoryRouter>;
const query = (data, overrides = {}) => ({
  data,
  isLoading: false,
  isFetching: false,
  isError: false,
  refetch: vi.fn(),
  ...overrides,
});

function ready({ analytics = false, personalization = false, runtime = true } = {}) {
  h.states['home/me'] = query({ phone: '09120000000', email: null });
  h.states['discover/preferences'] = query({ diet: 'omnivore', allergies: ['gluten'] });
  h.states['users/consent'] = query({ purposes: {
    analytics: {
      granted: analytics,
      policyVersion: 'privacy-1405-03-29',
      processingEnabled: runtime,
    },
    personalization: {
      granted: personalization,
      policyVersion: 'privacy-1405-03-29',
      processingEnabled: runtime,
    },
  } });
}

beforeEach(() => {
  ready();
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  h.post.mockImplementation((_url, body) => Promise.resolve({ data: { purposes: {
    [body.type]: {
      granted: body.granted,
      policyVersion: 'privacy-1405-03-29',
      processingEnabled: true,
    },
  } } }));
  h.put.mockImplementation((_url, body) => Promise.resolve({ data: {
    diet: body.diet,
    allergies: body.allergies,
  } }));
});

it('omits unsupported legacy allergens from preference writes', async () => {
  h.states['discover/preferences'] = query({ diet: 'omnivore', allergies: ['gluten', 'lupin'] });
  const { result } = renderHook(() => useSettings(), { wrapper });
  await waitFor(() => expect(result.current.legacyAllergenOptions.map((item) => item.id)).toContain('lupin'));

  act(() => { result.current.choosePattern('vegan'); });

  await waitFor(() => expect(h.put).toHaveBeenCalledTimes(1));
  expect(h.put).toHaveBeenCalledWith('/users/preferences', {
    diet: 'vegan',
    allergies: ['gluten'],
  });
});

it('serializes rapid full-state preference writes and keeps the latest allergen snapshot', async () => {
  const pending = [];
  h.put.mockImplementation((_url, body) => new Promise((resolve) => {
    pending.push({ body, resolve });
  }));
  const { result } = renderHook(() => useSettings(), { wrapper });
  await waitFor(() => expect(result.current.status).toBe('ready'));

  act(() => {
    result.current.toggleAllergen('dairy');
    result.current.toggleAllergen('egg');
  });

  await waitFor(() => expect(h.put).toHaveBeenCalledTimes(1));
  expect(pending[0].body.allergies).toEqual(['gluten', 'dairy']);

  await act(async () => {
    pending[0].resolve({ data: { diet: 'omnivore', allergies: pending[0].body.allergies } });
  });
  await waitFor(() => expect(h.put).toHaveBeenCalledTimes(2));
  expect(pending[1].body.allergies).toEqual(['gluten', 'dairy', 'egg']);

  await act(async () => {
    pending[1].resolve({ data: { diet: 'omnivore', allergies: pending[1].body.allergies } });
  });
  await waitFor(() => expect(result.current.busy).toBe(false));
});

it('serializes legacy-allergen removal after an in-flight full-state write', async () => {
  h.states['discover/preferences'] = query({ diet: 'omnivore', allergies: ['gluten', 'lupin'] });
  let resolvePut;
  h.put.mockImplementation((_url, body) => new Promise((resolve) => {
    resolvePut = () => resolve({ data: { diet: body.diet, allergies: [...body.allergies, 'lupin'] } });
  }));
  h.delete.mockResolvedValue({ data: { removed: ['lupin'] } });
  const { result } = renderHook(() => useSettings(), { wrapper });
  await waitFor(() => expect(result.current.legacyAllergenOptions.map((item) => item.id)).toContain('lupin'));

  act(() => {
    result.current.toggleAllergen('dairy');
    void result.current.removeLegacyAllergen('lupin');
  });

  await waitFor(() => expect(h.put).toHaveBeenCalledTimes(1));
  expect(h.delete).not.toHaveBeenCalled();
  await act(async () => { resolvePut(); });
  await waitFor(() => expect(h.delete).toHaveBeenCalledWith('/users/allergies', {
    data: { allergies: ['lupin'] },
  }));
  await waitFor(() => expect(result.current.busy).toBe(false));
});

it('deduplicates repeated account deletion attempts while the first request is pending', async () => {
  let resolveDelete;
  h.delete.mockImplementation(() => new Promise((resolve) => { resolveDelete = resolve; }));
  const { result } = renderHook(() => useSettings(), { wrapper });
  await waitFor(() => expect(result.current.status).toBe('ready'));

  let first;
  let second;
  act(() => {
    first = result.current.deleteAccount();
    second = result.current.deleteAccount();
  });
  expect(h.delete).toHaveBeenCalledTimes(1);
  expect(h.delete).toHaveBeenCalledWith('/users/me');

  await act(async () => {
    resolveDelete({ data: null });
    await Promise.all([first, second]);
  });
});

it('never trusts persisted device mirrors before canonical consent hydration', async () => {
  localStorage.setItem('garnish.analyticsConsent', 'granted');
  localStorage.setItem('garnish.consent.personalization', 'true');

  const { result } = renderHook(() => useSettings(), { wrapper });
  await waitFor(() => expect(result.current.consentStatus).toBe('ready'));

  expect(result.current.consent).toEqual({ analytics: false, personalization: false });
  expect(result.current.consentActive).toEqual({ analytics: false, personalization: false });
  expect(h.enableAnalytics).not.toHaveBeenCalled();
  expect(localStorage.getItem('garnish.consent.personalization')).toBe('false');
});

it('activates analytics only from a current canonical grant with processing enabled', async () => {
  ready({ analytics: true, runtime: true });

  const { result } = renderHook(() => useSettings(), { wrapper });
  await waitFor(() => expect(result.current.consentStatus).toBe('ready'));

  expect(result.current.consent.analytics).toBe(true);
  expect(result.current.consentActive.analytics).toBe(true);
  expect(result.current.consentRuntimeAvailable.analytics).toBe(true);
  expect(h.enableAnalytics).toHaveBeenCalled();
});

it('keeps a recorded choice inactive when runtime processing is approval-gated off', async () => {
  ready({ analytics: true, runtime: false });

  const { result } = renderHook(() => useSettings(), { wrapper });
  await waitFor(() => expect(result.current.consentStatus).toBe('ready'));

  expect(result.current.consent.analytics).toBe(true);
  expect(result.current.consentActive.analytics).toBe(false);
  expect(result.current.consentRuntimeAvailable.analytics).toBe(false);
  expect(h.enableAnalytics).not.toHaveBeenCalled();
  expect(h.disableAnalytics).toHaveBeenCalled();
});

it('rejects a grant recorded under a stale privacy policy version', async () => {
  ready({ analytics: true });
  h.states['users/consent'].data.purposes.analytics.policyVersion = 'privacy-stale';

  const { result } = renderHook(() => useSettings(), { wrapper });
  await waitFor(() => expect(result.current.consentStatus).toBe('ready'));

  expect(result.current.consent.analytics).toBe(false);
  expect(result.current.consentActive.analytics).toBe(false);
  expect(h.disableAnalytics).toHaveBeenCalled();
});

it('does not activate an analytics grant before canonical acknowledgement', async () => {
  let resolvePost;
  h.post.mockImplementation(() => new Promise((resolve) => { resolvePost = resolve; }));
  const { result } = renderHook(() => useSettings(), { wrapper });
  await waitFor(() => expect(result.current.consentStatus).toBe('ready'));
  vi.clearAllMocks();

  let pending;
  act(() => { pending = result.current.toggleConsent('analytics'); });
  expect(result.current.consent.analytics).toBe(false);
  expect(result.current.consentBusy.analytics).toBe(true);
  expect(h.enableAnalytics).not.toHaveBeenCalled();

  await act(async () => {
    resolvePost({ data: { purposes: {
      analytics: {
        granted: true,
        policyVersion: 'privacy-1405-03-29',
        processingEnabled: true,
      },
    } } });
    await pending;
  });
  expect(result.current.consent.analytics).toBe(true);
  expect(result.current.consentActive.analytics).toBe(true);
  expect(h.enableAnalytics).toHaveBeenCalledTimes(1);
});

it('records a canonical choice but leaves runtime off when acknowledgement says processing is disabled', async () => {
  h.post.mockResolvedValue({ data: { purposes: {
    analytics: {
      granted: true,
      policyVersion: 'privacy-1405-03-29',
      processingEnabled: false,
    },
  } } });
  const { result } = renderHook(() => useSettings(), { wrapper });
  await waitFor(() => expect(result.current.consentStatus).toBe('ready'));
  vi.clearAllMocks();

  await act(async () => { await result.current.toggleConsent('analytics'); });

  expect(result.current.consent.analytics).toBe(true);
  expect(result.current.consentActive.analytics).toBe(false);
  expect(result.current.consentRuntimeAvailable.analytics).toBe(false);
  expect(h.enableAnalytics).not.toHaveBeenCalled();
  expect(h.disableAnalytics).toHaveBeenCalled();
});

it('fails closed when acknowledgement does not match the requested grant', async () => {
  h.post.mockResolvedValue({ data: { purposes: {
    analytics: {
      granted: false,
      policyVersion: 'privacy-1405-03-29',
      processingEnabled: true,
    },
  } } });
  const { result } = renderHook(() => useSettings(), { wrapper });
  await waitFor(() => expect(result.current.consentStatus).toBe('ready'));
  vi.clearAllMocks();

  await act(async () => { await result.current.toggleConsent('analytics'); });

  expect(result.current.consent.analytics).toBe(false);
  expect(result.current.consentStatus).toBe('error');
  expect(h.enableAnalytics).not.toHaveBeenCalled();
  expect(h.disableAnalytics).toHaveBeenCalled();

  await act(async () => { await result.current.toggleConsent('analytics'); });
  expect(h.post).toHaveBeenCalledTimes(1);
});

it('disables analytics immediately and never restores it when withdrawal acknowledgement fails', async () => {
  ready({ analytics: true });
  h.post.mockRejectedValue(new Error('timeout'));
  const { result } = renderHook(() => useSettings(), { wrapper });
  await waitFor(() => expect(result.current.consentStatus).toBe('ready'));
  vi.clearAllMocks();

  let pending;
  act(() => { pending = result.current.toggleConsent('analytics'); });
  expect(result.current.consent.analytics).toBe(false);
  expect(result.current.consentActive.analytics).toBe(false);
  expect(h.disableAnalytics).toHaveBeenCalled();
  expect(h.enableAnalytics).not.toHaveBeenCalled();

  await act(async () => { await pending; });
  expect(result.current.consentStatus).toBe('error');
  expect(result.current.consent.analytics).toBe(false);
  expect(h.enableAnalytics).not.toHaveBeenCalled();
});

it('fails closed and locks writes when a later canonical refresh becomes unknown', async () => {
  ready({ analytics: true });
  const { result, rerender } = renderHook(() => useSettings(), { wrapper });
  await waitFor(() => expect(result.current.consentActive.analytics).toBe(true));
  vi.clearAllMocks();

  h.states['users/consent'] = query(undefined, { isError: true });
  rerender();
  await waitFor(() => expect(result.current.consentStatus).toBe('error'));

  expect(result.current.consent.analytics).toBe(false);
  expect(result.current.consentActive.analytics).toBe(false);
  expect(h.disableAnalytics).toHaveBeenCalled();
  await act(async () => { await result.current.toggleConsent('analytics'); });
  expect(h.post).not.toHaveBeenCalled();
});

it('clears recommendation attribution synchronously on personalization withdrawal', async () => {
  ready({ analytics: true, personalization: true });
  let resolveWithdrawal;
  h.post.mockImplementation(() => new Promise((resolve) => { resolveWithdrawal = resolve; }));
  const { result } = renderHook(() => useSettings(), { wrapper });
  await waitFor(() => expect(result.current.consentActive.personalization).toBe(true));
  localStorage.setItem('garnish:rec-attribution', JSON.stringify({
    'recipe-1': { requestId: 'request-before-withdrawal', ts: Date.now() },
  }));

  let pending;
  act(() => { pending = result.current.toggleConsent('personalization'); });
  expect(result.current.consent.personalization).toBe(false);
  expect(localStorage.getItem('garnish:rec-attribution')).toBeNull();

  await act(async () => {
    resolveWithdrawal({ data: { purposes: {
      personalization: {
        granted: false,
        policyVersion: 'privacy-1405-03-29',
        processingEnabled: true,
      },
    } } });
    await pending;
  });
  expect(localStorage.getItem('garnish:rec-attribution')).toBeNull();
});
