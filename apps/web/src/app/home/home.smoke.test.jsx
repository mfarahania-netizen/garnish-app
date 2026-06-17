import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';

// Mock the data hook so the smoke test is deterministic and does NO network.
vi.mock('./lib/useHomeData', () => ({ useHomeData: vi.fn() }));
import { useHomeData } from './lib/useHomeData';

// The render harness wraps in the REAL AuthProvider, which dereferences
// localStorage.getItem('token') unconditionally at mount. localStorage is not available
// in this vitest/jsdom run (node warns: "--localstorage-file was not provided"), so the
// provider throws before the page even renders. Replace it with a passthrough provider +
// a logged-out useAuth so the smoke test exercises the page, not the auth bootstrap.
// (The page itself never calls useAuth — only useHomeData, which is mocked above.)
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

import HomePage from './page';

// A neutral greeting object — the page always renders <Greeting> except in the loading
// branch, and it dereferences greeting.line / greeting.name / greeting.initial / greeting.streak.
const greeting = { name: 'تست', line: 'سه‌شنبه، عصر بخیر', streak: null, initial: 'ت' };

// Food DNA shape consumed by FoodDnaCard (ready state): score/tone/headline/traits[].
const dna = {
  band: 'developing',
  score: 0.62,
  headline: 'ذائقه‌ات داره شکل می‌گیره',
  tone: 'mature',
  traits: ['گیاه‌محور', 'سریع‌پز'],
};

const gam = {
  show: true,
  headline: 'دو هفته پشت‌سر‌هم پختی — عالیه!',
  progressLabel: 'سطح ۲ · آشپز خانگی',
  progress: 0.4,
};

const whisper = {
  recipeId: 'r1',
  text: 'برای امشب: کوکو سبزی',
  sub: 'بر اساس انتخاب‌های اخیر تو',
};

const pick = (id) => ({
  recipeId: id,
  title: 'کوکو سبزی',
  seed: 2,
  fit: 'great',
  cookTimeText: '۳۰ دقیقه',
  difficultyText: 'متوسط',
  servingsText: '۴ نفر',
  reasons: ['گیاهی', 'سالم'],
  reasonText: '',
});

const railItem = (id) => ({
  recipeId: id,
  title: 'عدس‌پلو',
  seed: 3,
  cookTimeText: '۴۵ دقیقه',
  difficultyText: 'آسان',
});

// A complete "ready" shape — every field/array the page reads is present.
function readyShape() {
  return {
    status: 'ready',
    greeting,
    dna,
    gam,
    whisper,
    picks: [pick('r1'), pick('r2'), pick('r3')],
    rails: {
      pantry: [railItem('p1'), railItem('p2')],
      popular: [railItem('q1'), railItem('q2')],
      fresh: [railItem('f1'), railItem('f2')],
    },
    resume: null,
    refetch: vi.fn(),
  };
}

// Minimal-but-complete shapes for the non-ready branches. The page still renders
// <Greeting> (and SearchField) in empty/error, so greeting must be present everywhere.
function emptyShape() {
  return {
    status: 'empty',
    greeting,
    dna,
    gam,
    whisper: null,
    picks: [],
    rails: { pantry: [], popular: [], fresh: [] },
    resume: null,
    refetch: vi.fn(),
  };
}

function errorShape() {
  return {
    status: 'error',
    greeting,
    dna,
    gam,
    whisper: null,
    picks: [],
    rails: { pantry: [], popular: [], fresh: [] },
    resume: null,
    refetch: vi.fn(),
  };
}

function loadingShape() {
  return {
    status: 'loading',
    greeting,
    dna,
    gam,
    whisper: null,
    picks: [],
    rails: { pantry: [], popular: [], fresh: [] },
    resume: null,
    refetch: vi.fn(),
  };
}

describe('HomePage smoke', () => {
  it('renders the loading skeletons branch without throwing', () => {
    useHomeData.mockReturnValue(loadingShape());
    const { container } = renderWithProviders(<HomePage />);
    // HomeLoading is skeleton-only: no greeting/search button, no headings.
    expect(container.firstChild).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('renders the empty / onboarding branch', () => {
    useHomeData.mockReturnValue(emptyShape());
    renderWithProviders(<HomePage />);
    expect(
      screen.getByRole('heading', { name: 'بیا اول ذائقه‌ات رو بشناسیم' }),
    ).toBeInTheDocument();
    expect(screen.getByText('یا از این‌جا شروع کن')).toBeInTheDocument();
  });

  it('renders the error branch with a retry affordance', () => {
    useHomeData.mockReturnValue(errorShape());
    renderWithProviders(<HomePage />);
    expect(
      screen.getByRole('heading', { name: 'یه مشکلی پیش اومد' }),
    ).toBeInTheDocument();
    // The page passes retryLabel="دوباره امتحان کن" to ErrorState (an UnstyledButton).
    expect(
      screen.getByRole('button', { name: /دوباره امتحان کن/ }),
    ).toBeInTheDocument();
  });

  it('renders the ready command-center branch', () => {
    useHomeData.mockReturnValue(readyShape());
    renderWithProviders(<HomePage />);
    // Food DNA card label + the "for you, tonight" section heading are stable landmarks.
    expect(screen.getByText('شناسهٔ ذائقهٔ تو')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'برای تو، امشب' }),
    ).toBeInTheDocument();
  });
});
