import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { navigateSpy, refreshUserSpy, authState } = vi.hoisted(() => ({
  navigateSpy: vi.fn(),
  refreshUserSpy: vi.fn(),
  authState: { token: '' },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateSpy };
});

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ token: authState.token, refreshUser: refreshUserSpy }),
}));

const apiMock = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn() }));
vi.mock('../../lib/apiClient', () => ({ default: apiMock }));
vi.mock('../../lib/consent-policy', () => ({
  CURRENT_PRIVACY_POLICY_VERSION: 'privacy-1405-03-29',
  CURRENT_TERMS_POLICY_VERSION: 'terms-1405-03-29',
  OPTIONAL_PERSONALIZATION_UI_ENABLED: true,
}));

import { useOnboarding } from './useOnboarding';
import {
  CURRENT_PRIVACY_POLICY_VERSION,
  CURRENT_TERMS_POLICY_VERSION,
} from '../../lib/consent-policy';

const wrapper = ({ children }) => <MemoryRouter>{children}</MemoryRouter>;

const emptyProfile = (overrides = {}) => ({
  schemaVersion: 2,
  revision: 0,
  status: 'draft',
  completedAt: null,
  updatedAt: null,
  safety: { status: 'unknown', allergyIds: [], intoleranceIds: [], dietaryRules: [] },
  preferences: { dietPattern: '', weekdayTimeBucket: '', cooksForCount: '' },
  taste: { likedRecipeIds: [], dislikedRecipeIds: [] },
  ...overrides,
});

beforeAll(() => {
  if (!globalThis.requestAnimationFrame) globalThis.requestAnimationFrame = (callback) => callback();
});

beforeEach(() => {
  authState.token = '';
  navigateSpy.mockReset();
  refreshUserSpy.mockReset().mockResolvedValue(undefined);
  apiMock.get.mockReset().mockImplementation((url) => {
    if (url === '/onboarding/v2') return Promise.resolve({ data: emptyProfile() });
    if (url === '/users/consent') {
      return Promise.resolve({
        data: {
          purposes: {
            terms: {
              granted: true,
              policyVersion: CURRENT_TERMS_POLICY_VERSION,
            },
            personalization: {
              granted: false,
              policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
              processingEnabled: true,
            },
          },
        },
      });
    }
    if (url === '/recommendations?limit=3') return Promise.resolve({ data: { items: [{ id: 'r1', title: 'عدس‌پلو' }] } });
    return Promise.resolve({ data: { items: [] } });
  });
  apiMock.patch.mockReset().mockResolvedValue({ data: { profile: emptyProfile({ revision: 1, updatedAt: '2026-07-14T00:00:00Z' }) } });
  apiMock.post.mockReset().mockResolvedValue({
    data: {
      profileRevision: 2,
      completedAt: '2026-07-14T00:00:01Z',
      nextPath: '/app',
      recommendationsEndpoint: '/recommendations?limit=3',
      replayed: false,
    },
  });
  sessionStorage.clear();
  localStorage.clear();
});

describe('useOnboarding V2 state and contract', () => {
  it('keeps unauthenticated entry session-only and redirects to login with return path', () => {
    const { result } = renderHook(() => useOnboarding(), { wrapper });
    act(() => result.current.start());
    expect(navigateSpy).toHaveBeenCalledWith('/login?mode=signup&from=/onboarding', { replace: true });
    expect(result.current.step).toBe(1);
    expect(apiMock.patch).not.toHaveBeenCalled();
  });

  it('blocks start, continue, and complete until canonical hydration finishes', async () => {
    authState.token = 'hydrating-user-token';
    let resolveProfile;
    apiMock.get.mockImplementation((url) => {
      if (url === '/onboarding/v2') {
        return new Promise((resolve) => { resolveProfile = resolve; });
      }
      if (url === '/users/consent') return Promise.resolve({ data: { purposes: { personalization: { granted: false } } } });
      return Promise.resolve({ data: { items: [] } });
    });

    const { result } = renderHook(() => useOnboarding(), { wrapper });
    expect(result.current.hydrating).toBe(true);
    act(() => result.current.start());
    expect(result.current.step).toBe(1);
    await act(async () => {
      await result.current.continueStep();
      await result.current.complete();
    });
    expect(apiMock.patch).not.toHaveBeenCalled();
    expect(apiMock.post).not.toHaveBeenCalled();

    await act(async () => resolveProfile({ data: emptyProfile() }));
    await waitFor(() => expect(result.current.hydrating).toBe(false));
  });

  it('uses explicit unknown/none/declared safety states without erasing an independent dietary rule', () => {
    const { result } = renderHook(() => useOnboarding(), { wrapper });
    act(() => result.current.setTermsAccepted(true));
    act(() => result.current.go(2));
    expect(result.current.answers.safety.status).toBe('unknown');
    expect(result.current.canContinue).toBe(false);

    act(() => result.current.toggleAllergy('gluten'));
    expect(result.current.answers.safety).toMatchObject({ status: 'declared', allergyIds: ['gluten'] });
    expect(result.current.canContinue).toBe(true);

    act(() => result.current.toggleDietaryRule('no_pork'));
    act(() => result.current.setSafetyNone());
    expect(result.current.answers.safety).toEqual({ status: 'none', allergyIds: [], intoleranceIds: [] });
    expect(result.current.answers.dietaryRules).toEqual(['no_pork']);
  });

  it('prevents the same token from being silently classified as allergy and intolerance', () => {
    const { result } = renderHook(() => useOnboarding(), { wrapper });
    act(() => result.current.toggleAllergy('dairy'));
    act(() => result.current.toggleIntolerance('dairy'));
    expect(result.current.answers.safety.allergyIds).toEqual(['dairy']);
    expect(result.current.answers.safety.intoleranceIds).toEqual([]);
    expect(result.current.statusMessage).toMatch(/ابتدا/);
  });

  it('locks a same-frame double continue to one mutation', async () => {
    authState.token = 'double-submit-token';
    let resolvePatch;
    apiMock.patch.mockImplementation(() => new Promise((resolve) => { resolvePatch = resolve; }));
    const { result } = renderHook(() => useOnboarding(), { wrapper });
    await waitFor(() => expect(result.current.hydrating).toBe(false));
    act(() => result.current.start());
    act(() => result.current.setSafetyNone());

    let first;
    let second;
    act(() => {
      first = result.current.continueStep();
      second = result.current.continueStep();
    });
    expect(apiMock.patch).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolvePatch({ data: { profile: emptyProfile({ revision: 1, updatedAt: 'saved' }) } });
      await Promise.all([first, second]);
    });
    expect(result.current.step).toBe(3);
  });

  it('sends typed snapshots with sequential expected revisions and completes atomically', async () => {
    authState.token = 'token';
    let revision = 0;
    apiMock.patch.mockImplementation((_url, body) => {
      expect(body.expectedRevision).toBe(revision);
      revision += 1;
      return Promise.resolve({ data: { profile: emptyProfile({ revision, updatedAt: `r${revision}` }), replayed: false } });
    });
    apiMock.post.mockImplementation((url, body) => {
      if (url === '/onboarding/v2/complete') {
        expect(body).toMatchObject({
          schemaVersion: 2,
          expectedRevision: 6,
          consent: {
            personalization: true,
            termsAccepted: true,
            termsPolicyVersion: CURRENT_TERMS_POLICY_VERSION,
            privacyPolicyVersion: CURRENT_PRIVACY_POLICY_VERSION,
          },
          taste: { likedRecipeIds: ['r1'], dislikedRecipeIds: [] },
        });
      }
      return Promise.resolve({
        data: {
          profileRevision: 7,
          completedAt: 'done',
          nextPath: '/app',
          recommendationsEndpoint: '/recommendations?limit=3',
          replayed: false,
        },
      });
    });

    const { result } = renderHook(() => useOnboarding(), { wrapper });
    await waitFor(() => expect(result.current.hydrating).toBe(false));

    act(() => result.current.start());
    act(() => result.current.setSafetyNone());
    await act(async () => result.current.continueStep());
    expect(result.current.step).toBe(3);

    act(() => result.current.setDietPattern('vegetarian'));
    act(() => result.current.toggleDietaryRule('no_pork'));
    await act(async () => result.current.continueStep());
    expect(result.current.step).toBe(4);

    act(() => result.current.setWeekdayTimeBucket('15_30'));
    act(() => result.current.setCooksForCount('2'));
    await act(async () => result.current.continueStep());
    expect(result.current.step).toBe(5);

    act(() => result.current.setPersonalizationConsent(true));
    act(() => result.current.addTaste('like', { id: 'r1', name: 'عدس‌پلو' }));
    await act(async () => result.current.continueStep());
    expect(result.current.step).toBe(6);

    act(() => result.current.setTermsAccepted(true));
    expect(result.current.personalizationAvailable).toBe(true);
    expect(result.current.personalizationConsent).toBe(true);
    expect(result.current.termsAccepted).toBe(true);
    await act(async () => result.current.complete());
    expect(result.current.step).toBe(7);
    expect(apiMock.patch).toHaveBeenCalledTimes(6);

    const safetyWithRule = apiMock.patch.mock.calls[1][1];
    expect(safetyWithRule).toMatchObject({
      schemaVersion: 2,
      step: 'safety',
      safety: { status: 'none', allergyIds: [], intoleranceIds: [], dietaryRules: ['no_pork'] },
      terms: { accepted: true, policyVersion: CURRENT_TERMS_POLICY_VERSION },
    });
    const partialPreferences = apiMock.patch.mock.calls[2][1];
    expect(partialPreferences.preferences).toEqual({ dietPattern: 'vegetarian' });
    const preferences = apiMock.patch.mock.calls[3][1];
    expect(preferences.preferences).toEqual({ dietPattern: 'vegetarian', weekdayTimeBucket: '15_30', cooksForCount: '2' });
    expect(apiMock.patch.mock.calls.some(([, body]) => body.step === 'taste')).toBe(false);
    expect(result.current.recommendations[0]).toMatchObject({ id: 'r1', title: 'عدس‌پلو' });
    expect(apiMock.post).toHaveBeenCalledWith('/onboarding/v2/complete', expect.any(Object));
    expect(apiMock.patch.mock.calls.some(([url]) => url === '/users/me/onboarding-complete')).toBe(false);
    expect(refreshUserSpy).toHaveBeenCalled();
  });

  it('never collects or patches taste before explicit personalization consent', async () => {
    authState.token = 'no-personalization-consent-token';
    const { result } = renderHook(() => useOnboarding(), { wrapper });
    await waitFor(() => expect(result.current.hydrating).toBe(false));

    act(() => result.current.go(5));
    act(() => result.current.addTaste('like', { id: 'r1', name: 'عدس‌پلو' }));
    expect(result.current.answers.taste).toEqual({ likes: [], dislikes: [] });

    await act(async () => result.current.continueStep());
    expect(result.current.step).toBe(6);
    expect(apiMock.patch).not.toHaveBeenCalled();
  });

  it('skips taste and refuses a stale grant when canonical processing is disabled', async () => {
    authState.token = 'processing-disabled-token';
    apiMock.get.mockImplementation((url) => {
      if (url === '/onboarding/v2') return Promise.resolve({ data: emptyProfile() });
      if (url === '/users/consent') {
        return Promise.resolve({
          data: {
            purposes: {
              personalization: {
                granted: true,
                policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
                processingEnabled: false,
              },
            },
          },
        });
      }
      return Promise.resolve({ data: { items: [] } });
    });
    const { result } = renderHook(() => useOnboarding(), { wrapper });
    await waitFor(() => expect(result.current.hydrating).toBe(false));

    expect(result.current.personalizationAvailable).toBe(false);
    expect(result.current.personalizationConsent).toBe(false);
    act(() => {
      result.current.go(4);
      result.current.setWeekdayTimeBucket('15_30');
      result.current.setCooksForCount('2');
      result.current.setPersonalizationConsent(true);
      result.current.addTaste('like', { id: 'r1', name: 'عدس‌پلو' });
    });
    expect(result.current.personalizationConsent).toBe(false);
    expect(result.current.answers.taste.likes).toEqual([]);

    await act(async () => result.current.continueStep());
    expect(result.current.step).toBe(6);
    act(() => result.current.back());
    expect(result.current.step).toBe(4);
  });

  it('blocks completion until the current terms and privacy notice are accepted', async () => {
    authState.token = 'terms-required-token';
    apiMock.get.mockImplementation((url) => {
      if (url === '/onboarding/v2') return Promise.resolve({ data: emptyProfile() });
      if (url === '/users/consent') {
        return Promise.resolve({
          data: {
            purposes: {
              terms: { granted: false, policyVersion: CURRENT_TERMS_POLICY_VERSION },
              personalization: {
                granted: false,
                policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
                processingEnabled: true,
              },
            },
          },
        });
      }
      return Promise.resolve({ data: { items: [] } });
    });
    const { result } = renderHook(() => useOnboarding(), { wrapper });
    await waitFor(() => expect(result.current.hydrating).toBe(false));

    act(() => {
      result.current.setSafetyNone();
      result.current.setDietPattern('vegetarian');
      result.current.setWeekdayTimeBucket('15_30');
      result.current.setCooksForCount('2');
    });
    await act(async () => result.current.complete());

    expect(result.current.error).toMatch(/شرایط استفاده/);
    expect(apiMock.patch).not.toHaveBeenCalled();
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('clears declined taste locally and completes with an empty taste payload', async () => {
    authState.token = 'declined-personalization-token';
    const { result } = renderHook(() => useOnboarding(), { wrapper });
    await waitFor(() => expect(result.current.hydrating).toBe(false));

    act(() => {
      result.current.setSafetyNone();
      result.current.setDietPattern('vegetarian');
      result.current.setWeekdayTimeBucket('15_30');
      result.current.setCooksForCount('2');
      result.current.setPersonalizationConsent(true);
    });
    act(() => result.current.addTaste('like', { id: 'r1', name: 'عدس‌پلو' }));
    expect(result.current.answers.taste.likes).toHaveLength(1);

    act(() => result.current.setPersonalizationConsent(false));
    await waitFor(() => expect(result.current.answers.taste).toEqual({ likes: [], dislikes: [] }));
    await waitFor(() => {
      const drafts = Array.from({ length: sessionStorage.length }, (_, index) => {
        const key = sessionStorage.key(index);
        return key ? JSON.parse(sessionStorage.getItem(key)) : null;
      }).filter(Boolean);
      expect(drafts.every((draft) => (
        draft.answers.taste.likes.length === 0 && draft.answers.taste.dislikes.length === 0
      ))).toBe(true);
    });

    act(() => result.current.setTermsAccepted(true));
    expect(result.current.termsAccepted).toBe(true);
    await act(async () => result.current.complete());

    expect(apiMock.post).toHaveBeenCalledWith('/onboarding/v2/complete', expect.objectContaining({
      consent: expect.objectContaining({ personalization: false, termsAccepted: true }),
      taste: { likedRecipeIds: [], dislikedRecipeIds: [] },
    }));
    expect(apiMock.patch.mock.calls.some(([, body]) => body.step === 'taste')).toBe(false);
  });

  it('surfaces revision conflict and can explicitly reload the canonical draft', async () => {
    authState.token = 'token';
    apiMock.patch.mockRejectedValueOnce({ response: { status: 409, data: { code: 'revision_conflict' } } });
    const { result } = renderHook(() => useOnboarding(), { wrapper });
    await waitFor(() => expect(result.current.hydrating).toBe(false));
    act(() => result.current.start());
    act(() => result.current.setSafetyNone());
    await act(async () => result.current.continueStep());
    expect(result.current.revisionConflict).toBe(true);
    expect(result.current.error).toMatch(/صفحهٔ دیگری/);

    apiMock.get.mockResolvedValueOnce({
      data: emptyProfile({
        revision: 4,
        updatedAt: 'server',
        safety: { status: 'declared', allergyIds: ['egg'], intoleranceIds: [], dietaryRules: [] },
      }),
    });
    await act(async () => result.current.reloadDraft());
    expect(result.current.revisionConflict).toBe(false);
    expect(result.current.answers.safety.allergyIds).toEqual(['egg']);
  });

  it('scopes the resumable browser draft to the authenticated subject', async () => {
    authState.token = 'user-a-token';
    const first = renderHook(() => useOnboarding(), { wrapper });
    await waitFor(() => expect(first.result.current.hydrating).toBe(false));
    act(() => first.result.current.go(3));
    act(() => first.result.current.setDietPattern('vegan'));
    await waitFor(() => expect(sessionStorage.length).toBe(1));
    const firstKey = sessionStorage.key(0);
    expect(JSON.parse(sessionStorage.getItem(firstKey)).answers.dietPattern).toBe('vegan');
    first.unmount();

    authState.token = 'user-b-token';
    const second = renderHook(() => useOnboarding(), { wrapper });
    await waitFor(() => expect(second.result.current.hydrating).toBe(false));
    expect(second.result.current.answers.dietPattern).toBe('');
    await waitFor(() => expect(sessionStorage.length).toBe(2));
    expect(sessionStorage.key(0)).not.toBe(sessionStorage.key(1));
  });

  it('does not copy the previous account draft during an in-place account switch', async () => {
    authState.token = 'switch-user-a-token';
    const view = renderHook(() => useOnboarding(), { wrapper });
    await waitFor(() => expect(view.result.current.hydrating).toBe(false));
    act(() => view.result.current.go(3));
    act(() => view.result.current.setDietPattern('vegan'));
    act(() => view.result.current.setPersonalizationConsent(true));
    await waitFor(() => {
      const values = Array.from({ length: sessionStorage.length }, (_, index) => JSON.parse(sessionStorage.getItem(sessionStorage.key(index))));
      expect(values.some((draft) => draft.answers.dietPattern === 'vegan')).toBe(true);
    });

    authState.token = 'switch-user-b-token';
    view.rerender();
    await waitFor(() => expect(view.result.current.answers.dietPattern).toBe(''));
    await waitFor(() => expect(view.result.current.hydrating).toBe(false));
    expect(view.result.current.personalizationConsent).toBe(false);
    const drafts = Array.from({ length: sessionStorage.length }, (_, index) => JSON.parse(sessionStorage.getItem(sessionStorage.key(index))));
    const currentDraft = drafts.find((draft) => draft.subject && draft.subject !== drafts.find((entry) => entry.answers.dietPattern === 'vegan')?.subject);
    expect(currentDraft?.answers.dietPattern).toBe('');
  });

  it('ignores an old account save response that resolves after the account changed', async () => {
    authState.token = 'pending-user-a-token';
    let resolvePatch;
    apiMock.patch.mockImplementation(() => new Promise((resolve) => { resolvePatch = resolve; }));
    const view = renderHook(() => useOnboarding(), { wrapper });
    await waitFor(() => expect(view.result.current.hydrating).toBe(false));
    act(() => view.result.current.start());
    act(() => view.result.current.setSafetyNone());
    let pendingSave;
    act(() => { pendingSave = view.result.current.continueStep(); });
    expect(apiMock.patch).toHaveBeenCalledTimes(1);

    authState.token = 'pending-user-b-token';
    view.rerender();
    await waitFor(() => expect(view.result.current.step).toBe(1));
    await act(async () => {
      resolvePatch({ data: { profile: emptyProfile({ revision: 8, updatedAt: 'old-user-response' }) } });
      await pendingSave;
    });
    expect(view.result.current.step).toBe(1);
    await waitFor(() => {
      const drafts = Array.from({ length: sessionStorage.length }, (_, index) => JSON.parse(sessionStorage.getItem(sessionStorage.key(index))));
      expect(drafts.find((draft) => draft.step === 1)?.revision).toBe(0);
    });
  });

  it('sanitizes a same-user session draft before restoring it', async () => {
    authState.token = 'sanitize-session-token';
    const first = renderHook(() => useOnboarding(), { wrapper });
    await waitFor(() => expect(first.result.current.hydrating).toBe(false));
    const key = sessionStorage.key(0);
    const subject = JSON.parse(sessionStorage.getItem(key)).subject;
    first.unmount();
    sessionStorage.setItem(key, JSON.stringify({
      schemaVersion: 2,
      subject,
      step: 99,
      revision: -4,
      answers: {
        safety: { status: 'declared', allergyIds: ['gluten', 'unsupported'], intoleranceIds: ['gluten', 'egg'] },
        dietaryRules: ['no_pork', 'unsupported'],
        dietPattern: 'vegan',
        weekdayTimeBucket: 'invalid',
        cooksForCount: '2',
        taste: {
          likes: [1, 2, 3, 4].map((index) => ({ id: `l${index}`, name: `پسند ${index}` })),
          dislikes: [{ id: 'l1', name: 'تکراری' }, { id: 'd1', name: 'نپسند' }],
        },
      },
    }));

    apiMock.get.mockImplementation((url) => {
      if (url === '/onboarding/v2') return Promise.resolve({ data: emptyProfile() });
      if (url === '/users/consent') {
        return Promise.resolve({
          data: {
            purposes: {
              personalization: {
                granted: true,
                policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
                processingEnabled: true,
              },
            },
          },
        });
      }
      return Promise.resolve({ data: { items: [] } });
    });

    const restored = renderHook(() => useOnboarding(), { wrapper });
    await waitFor(() => expect(restored.result.current.hydrating).toBe(false));
    expect(restored.result.current.step).toBe(6);
    expect(restored.result.current.answers.safety).toEqual({ status: 'declared', allergyIds: ['gluten'], intoleranceIds: ['egg'] });
    expect(restored.result.current.answers.dietaryRules).toEqual(['no_pork']);
    expect(restored.result.current.answers.weekdayTimeBucket).toBe('');
    expect(restored.result.current.answers.taste.likes).toHaveLength(3);
    expect(restored.result.current.answers.taste.dislikes.map((item) => item.id)).toEqual(['d1']);
  });

  it('never restores the result screen unless the server confirms completion', async () => {
    authState.token = 'stale-result-token';
    const first = renderHook(() => useOnboarding(), { wrapper });
    await waitFor(() => expect(first.result.current.hydrating).toBe(false));
    const key = sessionStorage.key(0);
    const draft = JSON.parse(sessionStorage.getItem(key));
    first.unmount();

    sessionStorage.setItem(key, JSON.stringify({ ...draft, step: 7 }));
    apiMock.get.mockImplementation((url) => {
      if (url === '/onboarding/v2') {
        return Promise.resolve({ data: emptyProfile({ revision: 3, updatedAt: 'saved-but-incomplete' }) });
      }
      if (url === '/users/consent') {
        return Promise.resolve({
          data: {
            purposes: {
              terms: { granted: true, policyVersion: CURRENT_TERMS_POLICY_VERSION },
              personalization: { granted: false, policyVersion: CURRENT_PRIVACY_POLICY_VERSION, processingEnabled: true },
            },
          },
        });
      }
      return Promise.resolve({ data: { items: [] } });
    });

    const restored = renderHook(() => useOnboarding(), { wrapper });
    await waitFor(() => expect(restored.result.current.hydrating).toBe(false));
    expect(restored.result.current.alreadyCompleted).toBe(false);
    expect(restored.result.current.step).toBe(6);
  });

  it('resolves real titles for taste choices restored from the server', async () => {
    authState.token = 'resolve-title-token';
    apiMock.get.mockImplementation((url) => {
      if (url === '/onboarding/v2') {
        return Promise.resolve({ data: emptyProfile({
          revision: 3,
          updatedAt: 'saved',
          taste: { likedRecipeIds: ['r-like'], dislikedRecipeIds: ['r-dislike'] },
        }) });
      }
      if (url === '/recipes/r-like') return Promise.resolve({ data: { id: 'r-like', title: 'عدس‌پلو' } });
      if (url === '/recipes/r-dislike') return Promise.resolve({ data: { id: 'r-dislike', title: 'سالاد سزار' } });
      if (url === '/users/consent') {
        return Promise.resolve({
          data: {
            purposes: {
              personalization: {
                granted: true,
                policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
                processingEnabled: true,
              },
            },
          },
        });
      }
      return Promise.resolve({ data: { items: [] } });
    });
    const { result } = renderHook(() => useOnboarding(), { wrapper });
    await waitFor(() => expect(result.current.hydrating).toBe(false));
    expect(result.current.answers.taste.likes[0].name).toBe('عدس‌پلو');
    expect(result.current.answers.taste.dislikes[0].name).toBe('سالاد سزار');
  });

  it('prefers canonical server consent over stale local storage', async () => {
    authState.token = 'token';
    localStorage.setItem('garnish.consent.personalization', 'true');
    apiMock.get.mockImplementation((url) => {
      if (url === '/onboarding/v2') return Promise.resolve({ data: emptyProfile() });
      if (url === '/users/consent') {
        return Promise.resolve({ data: { purposes: { personalization: { granted: false } } } });
      }
      return Promise.resolve({ data: { items: [] } });
    });
    const { result } = renderHook(() => useOnboarding(), { wrapper });
    await waitFor(() => expect(result.current.hydrating).toBe(false));
    expect(result.current.personalizationConsent).toBe(false);
  });

  it('routes a completed-profile revisit to the result state instead of reopening a draft', async () => {
    authState.token = 'token';
    apiMock.get.mockImplementation((url) => {
      if (url === '/onboarding/v2') {
        return Promise.resolve({
          data: emptyProfile({
            revision: 9,
            status: undefined,
            completedAt: 'done',
            updatedAt: 'done',
            safety: { status: 'none', allergyIds: [], intoleranceIds: [], dietaryRules: [] },
            preferences: { dietPattern: 'omnivore', weekdayTimeBucket: '30_60', cooksForCount: '3_4' },
          }),
        });
      }
      return Promise.resolve({ data: { items: [
        { title: 'بدون شناسه' },
        { id: 'r9', title: 'آش رشته' },
        { id: 'r9', title: 'تکراری' },
      ] } });
    });
    const { result } = renderHook(() => useOnboarding(), { wrapper });
    await waitFor(() => expect(result.current.step).toBe(7));
    expect(result.current.alreadyCompleted).toBe(true);
    expect(apiMock.patch).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.recommendations[0]?.id).toBe('r9'));
    expect(result.current.recommendations).toHaveLength(1);
  });
});
