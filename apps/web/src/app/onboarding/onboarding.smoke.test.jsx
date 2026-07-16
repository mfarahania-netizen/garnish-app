import { fireEvent, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { renderWithProviders } from '../../test/renderWithProviders';

vi.mock('./useOnboarding', () => ({ useOnboarding: vi.fn() }));
vi.mock('../../lib/apiClient', () => ({
  default: {
    get: vi.fn().mockResolvedValue({
      data: { items: [{ id: 'r1', title: 'عدس‌پلو' }, { id: 'r2', title: 'کوکو سبزی' }] },
    }),
  },
}));
vi.mock('../../context/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  ONBOARDED_KEY: 'garnish.onboarded',
  useAuth: () => ({ user: null, token: '', isLoading: false }),
}));

import { useOnboarding } from './useOnboarding';
import OnboardingPage from './page';

const answers = (overrides = {}) => ({
  safety: { status: 'unknown', allergyIds: [], intoleranceIds: [] },
  dietPattern: '',
  dietaryRules: [],
  weekdayTimeBucket: '',
  cooksForCount: '',
  taste: { likes: [], dislikes: [] },
  ...overrides,
});

const baseShape = (overrides = {}) => ({
  step: 1,
  start: vi.fn(),
  go: vi.fn(),
  back: vi.fn(),
  continueStep: vi.fn(),
  skipTaste: vi.fn(),
  answers: answers(),
  setSafetyNone: vi.fn(),
  toggleAllergy: vi.fn(),
  toggleIntolerance: vi.fn(),
  setDietPattern: vi.fn(),
  toggleDietaryRule: vi.fn(),
  setWeekdayTimeBucket: vi.fn(),
  setCooksForCount: vi.fn(),
  addTaste: vi.fn(),
  removeTaste: vi.fn(),
  canContinue: true,
  stepMeta: null,
  progressIndex: 1,
  progressTotal: 4,
  hydrating: false,
  saving: false,
  error: null,
  statusMessage: '',
  summary: {
    safety: 'آلرژی یا عدم‌تحمل ثبت نشده',
    diet: 'همه‌چیزخوار',
    rules: [],
    time: '۱۵ تا ۳۰ دقیقه',
    cooksFor: '۲ نفر',
    tasteCount: 0,
  },
  personalizationConsent: false,
  personalizationAvailable: true,
  setPersonalizationConsent: vi.fn(),
  termsAccepted: false,
  setTermsAccepted: vi.fn(),
  complete: vi.fn(),
  recommendations: [],
  recommendationsLoading: false,
  recommendationsError: null,
  retryRecommendations: vi.fn(),
  revisionConflict: false,
  reloadDraft: vi.fn(),
  alreadyCompleted: false,
  authed: true,
  finish: vi.fn(),
  ...overrides,
});

describe('Onboarding V2 UI', () => {
  it('shows a non-interactive hydration gate before canonical state is ready', () => {
    useOnboarding.mockReturnValue(baseShape({
      step: 3,
      hydrating: true,
      stepMeta: { title: 'الگوی غذایی', index: 2 },
    }));
    renderWithProviders(<OnboardingPage />);
    expect(screen.getByRole('status')).toHaveTextContent(/آخرین پروفایل/);
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ثبت الگوی/ })).not.toBeInTheDocument();
  });

  it('keeps the public entry session-only and offers login/start', () => {
    useOnboarding.mockReturnValue(baseShape({ authed: false }));
    renderWithProviders(<OnboardingPage />);
    expect(screen.getByRole('heading', { name: /پیشنهادهایی که واقعاً/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ورود و شروع/ })).toBeInTheDocument();
  });

  it('requires an explicit legal acceptance before safety data collection', () => {
    const setTermsAccepted = vi.fn();
    useOnboarding.mockReturnValue(baseShape({
      step: 1,
      authed: true,
      termsAccepted: false,
      setTermsAccepted,
    }));
    renderWithProviders(<OnboardingPage />);
    const terms = screen.getByRole('checkbox', { name: /شرایط استفاده را می‌پذیرم/ });
    expect(terms).not.toBeChecked();
    fireEvent.click(terms);
    expect(setTermsAccepted).toHaveBeenCalledWith(true);
    expect(screen.getByRole('link', { name: 'اطلاعیهٔ حریم خصوصی' })).toHaveAttribute('href', '/privacy');
  });

  it('renders only the 11 audited allergens and never asks severity', () => {
    useOnboarding.mockReturnValue(baseShape({
      step: 2,
      stepMeta: { title: 'ایمنی غذایی', index: 1 },
    }));
    renderWithProviders(<OnboardingPage />);
    expect(screen.getByRole('heading', { name: /اول مطمئن شویم/ })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /غلاتِ دارای گلوتن/ })).toHaveLength(2); // allergy + intolerance categories
    expect(screen.queryByText('لوپین')).not.toBeInTheDocument();
    expect(screen.queryByText('سولفیت')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ملایم|شدید/ })).not.toBeInTheDocument();
    expect(screen.queryByText('شدت برای ایمنی')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ثبت ایمنی و ادامه/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'قبلی' })).not.toBeInTheDocument();
  });

  it('separates supported diet from the only enforceable dietary rule', () => {
    const setDietPattern = vi.fn();
    useOnboarding.mockReturnValue(baseShape({
      step: 3,
      stepMeta: { title: 'الگوی غذایی', index: 2 },
      setDietPattern,
    }));
    renderWithProviders(<OnboardingPage />);
    const firstRadio = screen.getByRole('radio', { name: /همه‌چیزخوار/ });
    expect(firstRadio).toHaveAttribute('tabindex', '0');
    firstRadio.focus();
    fireEvent.keyDown(firstRadio, { key: 'ArrowDown' });
    expect(setDietPattern).toHaveBeenCalledWith('flexitarian');
    expect(screen.getByRole('button', { name: /گوشت خوک نمی‌خورم/ })).toBeInTheDocument();
    expect(screen.queryByText('ماهی‌خوار')).not.toBeInTheDocument();
    expect(screen.queryByText('حلال')).not.toBeInTheDocument();
    expect(screen.queryByText('کتو')).not.toBeInTheDocument();
  });

  it('moves focus to the heading that belongs to the newly mounted question panel', async () => {
    function TransitionHarness() {
      const [step, setStep] = useState(2);
      useOnboarding.mockImplementation(() => baseShape({
        step,
        stepMeta: { title: step === 2 ? 'safety' : 'diet', index: step - 1 },
      }));
      return (
        <>
          <OnboardingPage />
          <button type="button" onClick={() => setStep(3)}>test-next-step</button>
        </>
      );
    }

    const view = renderWithProviders(<TransitionHarness />);
    await waitFor(() => {
      const safetyHeading = view.container.querySelector(
        '[data-onboarding-panel="2"] [data-onboarding-heading]',
      );
      expect(safetyHeading).toHaveAttribute('tabindex', '-1');
      expect(safetyHeading).toHaveFocus();
    });

    fireEvent.click(screen.getByRole('button', { name: 'test-next-step' }));

    await waitFor(() => {
      const dietHeading = view.container.querySelector(
        '[data-onboarding-panel="3"] [data-onboarding-heading]',
      );
      expect(dietHeading).toHaveAttribute('tabindex', '-1');
      expect(dietHeading).toHaveFocus();
    });
  });

  it('collects time and household size with equal choices', () => {
    useOnboarding.mockReturnValue(baseShape({
      step: 4,
      stepMeta: { title: 'زمان آشپزی', index: 3 },
    }));
    renderWithProviders(<OnboardingPage />);
    expect(screen.getByText('بیشتر از یک ساعت')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '۱ نفر' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '۵ نفر یا بیشتر' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ثبت زمان و تعداد/ })).toBeInTheDocument();
  });

  it('shows safe quick-calibration recipes, secondary search, and a visible skip', async () => {
    useOnboarding.mockReturnValue(baseShape({
      step: 5,
      stepMeta: { title: 'کالیبراسیون ذائقه', index: 4, optional: true },
      personalizationConsent: true,
    }));
    renderWithProviders(<OnboardingPage />);
    await waitFor(() => expect(screen.getByText('عدس‌پلو')).toBeInTheDocument());
    expect(screen.getByText(/غذای دیگری در ذهن داری/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /بدون کالیبراسیون/ })).toBeInTheDocument();
  });

  it('reviews every persisted answer and keeps personalization consent explicit', () => {
    const setConsent = vi.fn();
    useOnboarding.mockReturnValue(baseShape({ step: 6, setPersonalizationConsent: setConsent }));
    renderWithProviders(<OnboardingPage />);
    expect(screen.getByRole('heading', { name: /پروفایل اولیه/ })).toBeInTheDocument();
    expect(screen.getByText('۱۵ تا ۳۰ دقیقه · ۲ نفر')).toBeInTheDocument();
    const consent = screen.getByRole('checkbox', { name: /یادگیری خودکار ذائقه/ });
    expect(consent).not.toBeChecked();
    fireEvent.click(consent);
    expect(setConsent).toHaveBeenCalledWith(true);
  });

  it('hides optional personalization controls when processing is unavailable', () => {
    useOnboarding.mockReturnValue(baseShape({ step: 6, personalizationAvailable: false }));
    renderWithProviders(<OnboardingPage />);
    expect(screen.queryByRole('checkbox', { name: /یادگیری خودکار ذائقه/ })).not.toBeInTheDocument();
    expect(screen.queryByText('کالیبراسیون ذائقه')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ساخت پروفایل و ادامه/ })).toBeInTheDocument();
  });

  it('reveals only real recommendation response items', () => {
    useOnboarding.mockReturnValue(baseShape({
      step: 7,
      recommendations: [
        { title: 'بدون شناسه' },
        { id: 'r42', title: 'قورمه‌سبزی', reason: 'متناسب با زمان تو' },
      ],
    }));
    renderWithProviders(<OnboardingPage />);
    expect(screen.getByRole('heading', { name: /پیشنهادها دقیق‌تر/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /قورمه‌سبزی/ })).toHaveAttribute('href', '/recipe/r42');
    expect(screen.queryByText('بدون شناسه')).not.toBeInTheDocument();
    expect(screen.queryByText(/ذائقه‌ات داره شکل/)).not.toBeInTheDocument();
  });

  it('never exposes internal ranking diagnostics as recommendation copy', () => {
    useOnboarding.mockReturnValue(baseShape({
      step: 7,
      recommendations: [{
        id: 'r7',
        title: 'کباب بناب',
        cookingTime: 35,
        diet: 'vegetarian',
        reason: 'Recipe was recommended because 23% has distinct recipe-level fit and 17% effortFit',
      }],
    }));
    renderWithProviders(<OnboardingPage />);
    expect(screen.queryByText(/recommended because|effortFit/i)).not.toBeInTheDocument();
    expect(screen.getByText('۳۵ دقیقه · گیاه‌خوار')).toBeInTheDocument();
  });
});
