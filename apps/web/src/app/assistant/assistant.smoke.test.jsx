import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import AssistantPage from './page';

// Mock the data hook so no network happens. The page reads:
//   messages[] (.map), thinking, error, feedback{}, starters[] (.map),
//   send/retry/reset/rate (fns), isEmpty.
vi.mock('./useAssistant', () => ({ useAssistant: vi.fn() }));
import { useAssistant } from './useAssistant';

// The render harness wraps in the REAL AuthProvider, which dereferences
// localStorage.getItem('token') unconditionally at mount. localStorage is not available
// in this vitest/jsdom run (node warns: "--localstorage-file was not provided"), so the
// provider throws before the page even renders. Replace it with a passthrough provider +
// a logged-out useAuth so the smoke test exercises the page, not the auth bootstrap.
// (The assistant page itself never calls useAuth — only useAssistant, mocked above.)
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

const STARTERS = [
  { id: 'sub', text: 'جایگزینِ ماست چی بزنم؟' },
  { id: 'cook', text: 'با مرغ و سبزی چی بپزم؟' },
  { id: 'light', text: 'یه غذای سبک و مقوی چی بپزم؟' },
];

// A complete, realistic hook shape. Override per state.
function makeState(overrides = {}) {
  return {
    messages: [],
    thinking: false,
    error: false,
    feedback: {},
    added: {},
    starters: STARTERS,
    conversations: [],
    convId: undefined,
    opener: null,
    send: vi.fn(),
    retry: vi.fn(),
    rate: vi.fn(),
    confirmAllergens: vi.fn(),
    newChat: vi.fn(),
    openConversation: vi.fn(),
    renameConversation: vi.fn(),
    deleteConversation: vi.fn(),
    loadConversations: vi.fn(),
    loadOpener: vi.fn(),
    isEmpty: true,
    ...overrides,
  };
}

describe('AssistantPage smoke', () => {
  it('renders the empty/starter state', () => {
    useAssistant.mockReturnValue(makeState({ messages: [], isEmpty: true }));
    renderWithProviders(<AssistantPage />);

    // Persistent disclosure header landmark.
    expect(screen.getByRole('heading', { name: 'دستیار گارنیش' })).toBeInTheDocument();
    // Empty-state prompt + a starter card copied verbatim from STARTERS.
    expect(screen.getByRole('heading', { name: 'چطور کمکت کنم؟' })).toBeInTheDocument();
    expect(screen.getByText('جایگزینِ ماست چی بزنم؟')).toBeInTheDocument();
  });

  it('surfaces the proactive opener (greeting + suggestion) on the empty state when the backend offers one', () => {
    useAssistant.mockReturnValue(
      makeState({
        isEmpty: true,
        opener: { greeting: 'سلام، عصرت بخیر! 🌆', suggestion: { text: 'برنامهٔ این هفته‌ات نصفه‌ست.', prompt: 'برنامهٔ غذایی این هفته‌ام رو کامل کن' } },
      }),
    );
    renderWithProviders(<AssistantPage />);

    // the greeting replaces the generic heading, and the data-grounded suggestion shows as its own card.
    expect(screen.getByRole('heading', { name: 'سلام، عصرت بخیر! 🌆' })).toBeInTheDocument();
    expect(screen.getByText('پیشنهادِ من برات')).toBeInTheDocument();
    expect(screen.getByText('برنامهٔ این هفته‌ات نصفه‌ست.')).toBeInTheDocument();
  });

  it('renders the ready/thread state with messages and feedback affordances', () => {
    useAssistant.mockReturnValue(
      makeState({
        isEmpty: false,
        messages: [
          { role: 'user', text: 'سلام دستیار' },
          { role: 'ai', text: 'سلام! چطور می‌تونم کمکت کنم؟' },
        ],
        feedback: {},
      }),
    );
    renderWithProviders(<AssistantPage />);

    expect(screen.getByText('سلام دستیار')).toBeInTheDocument();
    expect(screen.getByText('سلام! چطور می‌تونم کمکت کنم؟')).toBeInTheDocument();
    // AI message carries the mandatory disclosure + feedback buttons.
    expect(screen.getByText('پاسخِ AI ممکن است اشتباه کند.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'مفید بود' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'مفید نبود' })).toBeInTheDocument();
  });

  it('§3: renders the one-tap allergy confirm button and writes on tap', () => {
    const confirmAllergens = vi.fn();
    useAssistant.mockReturnValue(
      makeState({
        isEmpty: false,
        confirmAllergens,
        messages: [
          { role: 'user', text: 'به گردو حساسم' },
          { role: 'ai', text: 'متوجه شدم که به آجیل/مغزها حساسیت داری…', suggestedAction: { type: 'add_allergy', allergens: [{ token: 'nut', label: 'آجیل/مغزها' }] } },
        ],
      }),
    );
    renderWithProviders(<AssistantPage />);

    const btn = screen.getByRole('button', { name: 'افزودن به آلرژی‌هام' });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(confirmAllergens).toHaveBeenCalledWith(1, [{ token: 'nut', label: 'آجیل/مغزها' }]);
  });

  it('§3: shows the added confirmation and hides the button once added', () => {
    useAssistant.mockReturnValue(
      makeState({
        isEmpty: false,
        added: { 1: true },
        messages: [
          { role: 'user', text: 'به گردو حساسم' },
          { role: 'ai', text: 'متوجه شدم…', suggestedAction: { type: 'add_allergy', allergens: [{ token: 'nut', label: 'آجیل/مغزها' }] } },
        ],
      }),
    );
    renderWithProviders(<AssistantPage />);

    expect(screen.queryByRole('button', { name: 'افزودن به آلرژی‌هام' })).not.toBeInTheDocument();
    expect(screen.getByText('به آلرژی‌هات اضافه شد')).toBeInTheDocument();
  });

  it('renders the thinking state', () => {
    useAssistant.mockReturnValue(
      makeState({
        isEmpty: false,
        messages: [{ role: 'user', text: 'یه ایده شام بده' }],
        thinking: true,
      }),
    );
    renderWithProviders(<AssistantPage />);

    // the thinking indicator now cycles status lines (so a slow turn feels like active effort); assert the first.
    expect(screen.getByText('در حال فکر کردن…')).toBeInTheDocument();
  });

  it('renders the error state with a retry affordance', () => {
    useAssistant.mockReturnValue(
      makeState({
        isEmpty: false,
        messages: [{ role: 'user', text: 'یه ایده شام بده' }],
        error: true,
      }),
    );
    renderWithProviders(<AssistantPage />);

    expect(screen.getByText('دستیار در دسترس نیست')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /تلاش دوباره/ })).toBeInTheDocument();
  });
});
