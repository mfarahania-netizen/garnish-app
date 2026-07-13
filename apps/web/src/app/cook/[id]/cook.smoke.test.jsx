import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';
import CookPage from './page';

// jsdom in this config exposes no Storage (the shared setup stubs matchMedia/
// observers but not localStorage), and AuthProvider reads localStorage.getItem
// at mount. Provide a minimal in-memory Storage so the harness mounts
// logged-out. Local to this test file — no shared file is touched.
if (!('localStorage' in globalThis) || globalThis.localStorage == null) {
  const makeStore = () => {
    const map = new Map();
    return {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
      clear: () => map.clear(),
      key: (i) => [...map.keys()][i] ?? null,
      get length() {
        return map.size;
      },
    };
  };
  Object.defineProperty(globalThis, 'localStorage', { value: makeStore(), configurable: true });
  Object.defineProperty(globalThis, 'sessionStorage', { value: makeStore(), configurable: true });
}

// Mock the data hook so no network happens; each test sets a realistic, complete
// return shape for the state under test.
vi.mock('./useCook', () => ({ useCook: vi.fn() }));
import { useCook } from './useCook';

const renderPage = () =>
  renderWithProviders(<CookPage />, { route: '/cook/1', path: '/cook/:id' });

// A COMPLETE ready-state shape mirroring every field page.jsx dereferences. currentStep is now the
// structured cook-step object; durationMin is 0 so the optional StepTimer (a setInterval owner) never
// mounts — keeping the smoke test deterministic.
const readyValue = (over = {}) => ({
  status: 'ready',
  recipe: { id: '1', title: 'خورش قورمه‌سبزی' },
  refetch: vi.fn(),
  step: 0,
  total: 3,
  currentStep: { order: 1, title: null, instruction: 'سبزی را با کمی روغن تفت بده تا خوش‌رنگ شود.', caveats: [], flame: null, tempC: null, durationMin: 0, sees: null, recovery: null, doneness: null, tip: null },
  isGris: false,
  personalization: { servedFor: null, swaps: {}, removed: [], isPersonalized: false },
  finished: false,
  completion: { status: 'idle' },
  next: vi.fn(),
  prev: vi.fn(),
  feedback: { status: 'idle', sentiment: null },
  submitFeedback: vi.fn(),
  loggedIn: false,
  streakWeeks: 0,
  sheetOpen: false,
  openHelp: vi.fn(),
  closeHelp: vi.fn(),
  help: { loading: false, text: null, error: false },
  ...over,
});

describe('CookPage smoke', () => {
  it('renders the loading state without throwing', () => {
    useCook.mockReturnValue({ status: 'loading', refetch: vi.fn() });
    renderPage();
    // Loading branch is skeleton-only: assert the terminal landmarks are absent.
    expect(screen.queryByText('مراحل بارگذاری نشد')).not.toBeInTheDocument();
    expect(screen.queryByText('کمک برای این مرحله')).not.toBeInTheDocument();
  });

  it('renders the error state with a retry affordance', () => {
    useCook.mockReturnValue({ status: 'error', recipe: null, refetch: vi.fn() });
    renderPage();
    expect(
      screen.getByRole('heading', { name: 'مراحل بارگذاری نشد' }),
    ).toBeInTheDocument();
    expect(screen.getByText('تلاش دوباره')).toBeInTheDocument();
  });

  it('renders the empty state (same fallback) with the retry affordance', () => {
    useCook.mockReturnValue({ status: 'empty', recipe: null, refetch: vi.fn() });
    renderPage();
    expect(
      screen.getByRole('heading', { name: 'مراحل بارگذاری نشد' }),
    ).toBeInTheDocument();
    expect(screen.getByText('تلاش دوباره')).toBeInTheDocument();
  });

  it('renders the no-steps state (recipe present, total 0) without a retry', () => {
    useCook.mockReturnValue(
      readyValue({ total: 0, currentStep: '' }),
    );
    renderPage();
    expect(
      screen.getByRole('heading', { name: 'این دستور مرحله‌ای ثبت‌نشده' }),
    ).toBeInTheDocument();
    // This fallback omits onRetry, so the retry button must NOT render.
    expect(screen.queryByText('تلاش دوباره')).not.toBeInTheDocument();
  });

  it('renders the finished state', () => {
    useCook.mockReturnValue(readyValue({ finished: true, loggedIn: true, completion: { status: 'saved' } }));
    renderPage();
    expect(
      screen.getByRole('heading', { name: 'آفرین — نوشِ جان!' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/پختت رو ثبت کردیم/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'خوب بود' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'بهتر می‌شد' })).toBeInTheDocument();
  });

  it('never shows feedback success while persistence is pending or failed', () => {
    useCook.mockReturnValue(readyValue({ finished: true, loggedIn: true, completion: { status: 'saved' }, feedback: { status: 'error', sentiment: 'positive' } }));
    renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent('نظر ثبت نشد');
    expect(screen.queryByText('نظرت ثبت شد')).not.toBeInTheDocument();
  });

  it('shows a truthful local finish for a guest without a persisted-completion or feedback claim', () => {
    useCook.mockReturnValue(readyValue({ step: 2, finished: true, completion: { status: 'local_only' }, loggedIn: false }));
    renderPage();
    expect(screen.getByRole('heading', { name: 'آفرین — نوشِ جان!' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('در حسابی ثبت نشده');
    expect(screen.queryByText(/پختت رو ثبت کردیم/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'خوب بود' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'بهتر می‌شد' })).not.toBeInTheDocument();
  });

  it('renders the ready/step state with the step UI', () => {
    useCook.mockReturnValue(readyValue());
    renderPage();
    expect(screen.getByText('کمک برای این مرحله')).toBeInTheDocument();
    expect(screen.getByText('بعدی')).toBeInTheDocument();
    // the structured step instruction renders
    expect(screen.getByText('سبزی را با کمی روغن تفت بده تا خوش‌رنگ شود.')).toBeInTheDocument();
    // Cook now renders inside the app shell (TopBar provides back); the in-cook sub-header shows the
    // recipe title + step counter instead of its own X close.
    expect(screen.getByText('خورش قورمه‌سبزی')).toBeInTheDocument();
    expect(screen.getByText('مرحلهٔ ۱ از ۳')).toBeInTheDocument();
  });

  it('keeps optional guided notes collapsed by default', () => {
    useCook.mockReturnValue(readyValue({
      currentStep: {
        order: 1,
        title: 'نیم‌پز کردن لپه',
        instruction: 'لپه را جداگانه بجوشانید و کف روی آب را بگیرید.',
        caveats: [],
        flame: 'medium',
        tempC: null,
        durationMin: 15,
        sees: 'لپه باید نرم ولی شکل‌دار باشد.',
        recovery: 'اگر زیادی پخت، آن را در دقیقه‌های پایانی اضافه کنید.',
        doneness: 'حدود هفتاد درصد پخته باشد.',
        tip: 'کف آب را دور بریزید.',
      },
    }));
    renderPage();

    expect(screen.getByText('لپه را جداگانه بجوشانید و کف روی آب را بگیرید.')).toBeInTheDocument();
    expect(screen.getByText('نشانهٔ ظاهری')).toBeInTheDocument();
    expect(screen.queryByText('لپه باید نرم ولی شکل‌دار باشد.')).not.toBeInTheDocument();
    expect(screen.getByText('تایمر ۱۵ دقیقه')).toBeInTheDocument();
  });
});
