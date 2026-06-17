import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';

// Mock the data hook so the smoke test is deterministic and does NO network.
// (useOnboarding internally calls useAuth/apiClient/useNavigate — mocking it out
//  means none of that runs; we drive every step branch by hand.)
vi.mock('./useOnboarding', () => ({ useOnboarding: vi.fn() }));
import { useOnboarding } from './useOnboarding';

// The render harness wraps in the REAL AuthProvider, which dereferences
// localStorage.getItem('token') unconditionally at mount. localStorage is not available
// in this vitest/jsdom run (node warns "--localstorage-file was not provided"), so the
// provider throws before the page renders. Replace it with a passthrough provider + a
// logged-out useAuth. (The page itself never calls useAuth — only the mocked hook does.)
vi.mock('../../context/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({
    user: null,
    token: '',
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
}));

import OnboardingPage from './page';

// initialAnswers shape from the hook — every field the page's `a = o.answers`
// dereferences across all steps (work/household/count/pattern/allergens/dislikes/goals/skill/budget).
function answers(overrides = {}) {
  return {
    work: '',
    household: '',
    count: 2,
    pattern: '',
    allergens: {},
    dislikes: {},
    goals: {},
    skill: '',
    budget: '',
    ...overrides,
  };
}

// A realistic, COMPLETE hook return — every top-level field the page reads, for ANY step.
// Per-test we just override `step` (and a couple of state-specific fields). Functions are
// vi.fn() so onClick handlers never throw; arrays/objects are present so .map()/derefs are safe.
function baseShape(overrides = {}) {
  return {
    step: 1,
    go: vi.fn(),
    next: vi.fn(),
    back: vi.fn(),
    skip: vi.fn(),
    answers: answers(),
    setWork: vi.fn(),
    setHousehold: vi.fn(),
    setPattern: vi.fn(),
    setSkill: vi.fn(),
    setBudget: vi.fn(),
    toggleGoal: vi.fn(),
    toggleDislike: vi.fn(),
    toggleAllergen: vi.fn(),
    setSeverity: vi.fn(),
    inc: vi.fn(),
    dec: vi.fn(),
    countFa: '۲',
    canContinue: true,
    progressIndex: 1,
    progressTotal: 4,
    revealValue: 0.5,
    traits: [],
    authMode: 'signup',
    isSignup: true,
    toggleAuth: vi.fn(),
    goLogin: vi.fn(),
    phone: '',
    setPhone: vi.fn(),
    phoneValid: false,
    password: '',
    setPassword: vi.fn(),
    passValid: false,
    showPass: false,
    toggleShowPass: vi.fn(),
    consent: false,
    toggleConsent: vi.fn(),
    canSubmit: false,
    submitting: false,
    error: null,
    submit: vi.fn(),
    authed: false,
    finish: vi.fn(),
    ...overrides,
  };
}

describe('OnboardingPage smoke', () => {
  it('renders the welcome step (step 1)', () => {
    useOnboarding.mockReturnValue(baseShape({ step: 1 }));
    renderWithProviders(<OnboardingPage />);
    // Verbatim h1 copy + the primary CTA from the Welcome step.
    expect(
      screen.getByRole('heading', { name: /ذائقه‌ات رو یاد می‌گیرم/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'بزن بریم' })).toBeInTheDocument();
  });

  it('renders the context question step (step 2)', () => {
    useOnboarding.mockReturnValue(baseShape({ step: 2, progressIndex: 1 }));
    renderWithProviders(<OnboardingPage />);
    // Verbatim h2 for step 2 + an option label from WORK_OPTIONS.
    expect(screen.getByText('کارِ روزمره‌ات چه شکلیه؟')).toBeInTheDocument();
    expect(screen.getByText('پشت‌میز و پرمشغله')).toBeInTheDocument();
  });

  it('renders the diet/allergens question step (step 3)', () => {
    useOnboarding.mockReturnValue(
      baseShape({
        step: 3,
        progressIndex: 2,
        // Pre-select an allergen so AllergenSelect renders its severity sub-panel
        // (which reads selected[id] + maps `chosen`). Exercises that nested branch.
        answers: answers({ allergens: { gluten: 'severe' } }),
      }),
    );
    renderWithProviders(<OnboardingPage />);
    expect(screen.getByText('چه‌جور غذایی دوست داری؟')).toBeInTheDocument();
    // Severity sub-panel header appears only when an allergen is chosen.
    expect(screen.getByText('شدت برای ایمنی')).toBeInTheDocument();
  });

  it('renders the goals question step (step 4)', () => {
    useOnboarding.mockReturnValue(baseShape({ step: 4, progressIndex: 3 }));
    renderWithProviders(<OnboardingPage />);
    expect(screen.getByText('هدفِ اصلیت با غذا چیه؟')).toBeInTheDocument();
    expect(screen.getByText('تنوعِ بیشتر')).toBeInTheDocument();
  });

  it('renders the final-settings question step (step 5)', () => {
    useOnboarding.mockReturnValue(baseShape({ step: 5, progressIndex: 4 }));
    renderWithProviders(<OnboardingPage />);
    expect(screen.getByText('چند تنظیمِ آخر')).toBeInTheDocument();
    expect(screen.getByText('آشپزیت در چه حدیه؟')).toBeInTheDocument();
  });

  it('renders the reveal step (step 6) with derived traits', () => {
    useOnboarding.mockReturnValue(
      baseShape({
        step: 6,
        revealValue: 0.62,
        traits: [{ label: 'گیاه‌محور' }, { label: 'سریعِ وسط‌هفته' }],
      }),
    );
    renderWithProviders(<OnboardingPage />);
    // Verbatim h1 for the Reveal step + a rendered trait chip.
    expect(
      screen.getByRole('heading', { name: 'ذائقه‌ات داره شکل می‌گیره' }),
    ).toBeInTheDocument();
    expect(screen.getByText('گیاه‌محور')).toBeInTheDocument();
  });

  it('renders the auth step (step 7) in signup mode', () => {
    useOnboarding.mockReturnValue(baseShape({ step: 7, isSignup: true }));
    renderWithProviders(<OnboardingPage />);
    // Verbatim signup h1 + the signup submit CTA.
    expect(
      screen.getByRole('heading', { name: 'یک قدم تا شروع' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'ثبت‌نام و شروع' }),
    ).toBeInTheDocument();
  });

  it('renders the auth step error sub-state with an alert', () => {
    useOnboarding.mockReturnValue(
      baseShape({
        step: 7,
        isSignup: false,
        error: 'ورود ناموفق بود. شماره یا گذرواژه را بررسی کن.',
      }),
    );
    renderWithProviders(<OnboardingPage />);
    // The error banner is the page's error affordance (role="alert" + verbatim message).
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(
      screen.getByText('ورود ناموفق بود. شماره یا گذرواژه را بررسی کن.'),
    ).toBeInTheDocument();
  });
});
