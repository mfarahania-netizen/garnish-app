import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';

// Mock the data hook so the smoke test is deterministic and does NO network.
// (useOnboarding internally calls useAuth/apiClient/useNavigate — mocking it out
//  means none of that runs; we drive every step branch by hand.)
vi.mock('./useOnboarding', () => ({ useOnboarding: vi.fn() }));
import { useOnboarding } from './useOnboarding';

// The render harness wraps in the REAL AuthProvider, which dereferences
// localStorage.getItem('token') unconditionally at mount. localStorage is not available
// in this vitest/jsdom run, so the provider throws before the page renders. Replace it
// with a passthrough provider + a logged-out useAuth. (The page itself never calls useAuth
// — only the mocked hook does; ONBOARDED_KEY is a harmless named export.)
vi.mock('../../context/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  ONBOARDED_KEY: 'garnish.onboarded',
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

// initialAnswers shape from the REBUILT hook — the v1 levers the page reads:
// allergens (safety) · pattern (diet) · workdayTime (cooking-time band) · dislikes.
function answers(overrides = {}) {
  return {
    allergens: {},
    pattern: '',
    workdayTime: '',
    taste: { likes: [], dislikes: [] },
    ...overrides,
  };
}

// A COMPLETE hook return — every top-level field the page reads, for ANY step. Per-test we
// override `step`. Functions are vi.fn() so onClick handlers never throw.
function baseShape(overrides = {}) {
  return {
    step: 1,
    go: vi.fn(),
    next: vi.fn(),
    back: vi.fn(),
    skip: vi.fn(),
    answers: answers(),
    setPattern: vi.fn(),
    setWorkdayTime: vi.fn(),
    addTaste: vi.fn(),
    removeTaste: vi.fn(),
    toggleAllergen: vi.fn(),
    setSeverity: vi.fn(),
    clearAllergensAndNext: vi.fn(),
    canContinue: true,
    progressIndex: 1,
    progressTotal: 2,
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
    expect(
      screen.getByRole('heading', { name: /ذائقه‌ات رو یاد می‌گیرم/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'بزن بریم' })).toBeInTheDocument();
  });

  it('renders the allergy safety step (step 2) with the EU-14 chips + None fast-exit', () => {
    useOnboarding.mockReturnValue(baseShape({ step: 2, progressIndex: 1 }));
    renderWithProviders(<OnboardingPage />);
    expect(screen.getByText('اول، ایمنی')).toBeInTheDocument();
    expect(screen.getByText('گلوتن')).toBeInTheDocument(); // an EU-14 chip
    expect(screen.getByRole('button', { name: /حساسیتی ندارم/ })).toBeInTheDocument(); // the one-tap None fast-exit
  });

  it('renders the allergy severity sub-panel when an allergen is chosen', () => {
    useOnboarding.mockReturnValue(
      baseShape({ step: 2, progressIndex: 1, answers: answers({ allergens: { gluten: 'severe' } }) }),
    );
    renderWithProviders(<OnboardingPage />);
    expect(screen.getByText('شدت برای ایمنی')).toBeInTheDocument();
  });

  it('renders the taste & time step (step 3) — diet + cooking-time + free-form taste builder', () => {
    useOnboarding.mockReturnValue(baseShape({ step: 3, progressIndex: 2 }));
    renderWithProviders(<OnboardingPage />);
    expect(screen.getByText('یه کم از سلیقه‌ات')).toBeInTheDocument();
    expect(screen.getByText('چه‌جور غذایی دوست داری؟')).toBeInTheDocument();
    expect(screen.getByText('توی روزهای هفته معمولاً چقدر وقت برای آشپزی داری؟')).toBeInTheDocument();
    expect(screen.getByText('کمتر از ۱۵ دقیقه')).toBeInTheDocument(); // a COOKTIME band
    expect(screen.getByText('چی دوست داری، چی رو نه؟')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/هر ماده‌ای رو بنویس/)).toBeInTheDocument(); // free-form search, not a fixed list
  });

  it('renders the reveal step (step 4) with derived traits', () => {
    useOnboarding.mockReturnValue(
      baseShape({ step: 4, traits: [{ label: 'گیاه‌محور' }, { label: 'سریعِ وسط‌هفته' }] }),
    );
    renderWithProviders(<OnboardingPage />);
    expect(
      screen.getByRole('heading', { name: 'ذائقه‌ات داره شکل می‌گیره' }),
    ).toBeInTheDocument();
    expect(screen.getByText('گیاه‌محور')).toBeInTheDocument();
  });

  it('renders the account step (step 5) in signup mode', () => {
    useOnboarding.mockReturnValue(baseShape({ step: 5, isSignup: true }));
    renderWithProviders(<OnboardingPage />);
    expect(
      screen.getByRole('heading', { name: 'یک قدم تا شروع' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'ثبت‌نام و شروع' }),
    ).toBeInTheDocument();
  });

  it('renders the account step error sub-state with an alert', () => {
    useOnboarding.mockReturnValue(
      baseShape({
        step: 5,
        isSignup: false,
        error: 'ورود ناموفق بود. شماره یا گذرواژه را بررسی کن.',
      }),
    );
    renderWithProviders(<OnboardingPage />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(
      screen.getByText('ورود ناموفق بود. شماره یا گذرواژه را بررسی کن.'),
    ).toBeInTheDocument();
  });
});
