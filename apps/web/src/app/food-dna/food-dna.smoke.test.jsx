import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import FoodDnaPage from './page';

if (!globalThis.localStorage) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k), clear: () => store.clear(), key: (i) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
}

// Mock the data hook; each test sets the state under test (mirrors the plan/home smoke pattern).
// useTaste (FI-4.1) is stubbed empty so the page's «ذائقهٔ مواد» section stays hidden in these smokes.
vi.mock('./useFoodDna', () => ({
  useFoodDna: vi.fn(),
  useFoodDnaProjection: vi.fn(),
  useTaste: vi.fn(() => ({ items: [], loading: false, correct: vi.fn(), correcting: false })),
}));
import { useFoodDna } from './useFoodDna';

const DIMS = [
  { key: 'taste', status: 'usable', confidence: 0.6, evidenceCount: 5, safeExplanation: 'به طعم‌های دودی و گیاهی گرایش داری', summary: '', limitations: [], metrics: [{ key: 'flavorPattern', value: 'smoky/herby' }], affinities: ['بادمجان'] },
  { key: 'effort', status: 'usable', confidence: 0.5, evidenceCount: 4, safeExplanation: 'بیشتر غذای سریع می‌پزی', summary: '', limitations: [], metrics: [{ key: 'quickMeal', value: 0.7 }] },
  { key: 'skill', status: 'emerging', confidence: 0.4, evidenceCount: 3, safeExplanation: 'مهارتت رو به رشده', summary: '', limitations: [], metrics: [] },
  { key: 'routine', status: 'emerging', confidence: 0.4, evidenceCount: 3, safeExplanation: 'بیشتر آخر هفته آشپزی می‌کنی', summary: '', limitations: [], metrics: [] },
];
const READY = {
  status: 'ready',
  dna: { status: 'partial', maturity: { band: 'developing', score: 0.48, trustGuidance: 'Profile is developing — reasonable to personalize.', observedConfidence: 0.6, declaredCoverage: 0.1 }, dimensions: DIMS, strongestDimensions: ['taste'], weakestDimensions: ['skill'], evidence: { observationCount: 12, sourceSignalCount: 12 } },
  refetch: vi.fn(), question: null, questionRemaining: 0, submitAnswer: vi.fn().mockResolvedValue(true), submitting: false,
};

beforeEach(() => vi.clearAllMocks());

describe('FoodDnaPage', () => {
  it('loading → skeleton', () => {
    useFoodDna.mockReturnValue({ ...READY, status: 'loading', dna: null });
    renderWithProviders(<FoodDnaPage />);
    expect(screen.getByRole('status', { name: 'در حال بارگذاری…' })).toBeInTheDocument();
  });

  it('error → honest error + retry', () => {
    useFoodDna.mockReturnValue({ ...READY, status: 'error', dna: null });
    renderWithProviders(<FoodDnaPage />);
    expect(screen.getByRole('heading', { name: 'شناسهٔ ذائقه بارگذاری نشد' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'تلاش دوباره' })).toBeInTheDocument();
  });

  it('renders the FOUR dimensions + the engine safeExplanation (no invented traits)', () => {
    useFoodDna.mockReturnValue(READY);
    renderWithProviders(<FoodDnaPage />);
    for (const label of ['ذائقه', 'زمان و تلاش', 'مهارت', 'روال']) expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText('به طعم‌های دودی و گیاهی گرایش داری')).toBeInTheDocument();
    expect(screen.getByText('بیشتر غذای سریع می‌پزی')).toBeInTheDocument();
  });

  it('ring shows the REAL maturity band (not a hardcoded %)', () => {
    useFoodDna.mockReturnValue(READY);
    renderWithProviders(<FoodDnaPage />);
    // FoodDnaRing renders an accessible label from the real band caption ("در حال رشد") + the real score.
    expect(screen.getByRole('img', { name: /در حال رشد/ })).toBeInTheDocument();
    expect(screen.getByText(/Profile is developing/)).toBeInTheDocument(); // engine trustGuidance surfaced
  });

  it('cold-start → honest forming state (no fake %)', () => {
    useFoodDna.mockReturnValue({
      ...READY,
      dna: { status: 'cold_start', maturity: { band: 'empty', score: 0, trustGuidance: 'Not enough profile signal yet.', observedConfidence: 0, declaredCoverage: 0 }, dimensions: DIMS.map((d) => ({ ...d, confidence: 0, safeExplanation: '' })), strongestDimensions: [], weakestDimensions: [], evidence: { observationCount: 0, sourceSignalCount: 0 } },
    });
    renderWithProviders(<FoodDnaPage />);
    expect(screen.getByText(/تازه داره شکل می‌گیره/)).toBeInTheDocument();
    // dimensions with no signal show the honest "not enough yet" line, NOT a fabricated trait
    expect(screen.getAllByText(/هنوز نشانهٔ کافی/).length).toBeGreaterThan(0);
  });

  it('onboarding entry: answering an option calls the real engine (submitAnswer with key+value)', async () => {
    const submitAnswer = vi.fn().mockResolvedValue(true);
    useFoodDna.mockReturnValue({
      ...READY, submitAnswer,
      question: { id: 'dietary.pattern', dimensionKey: 'dietary.pattern', prompt: 'الگوی غذایی‌ات چیه؟', options: ['omnivore', 'vegetarian'] },
      questionRemaining: 3,
    });
    renderWithProviders(<FoodDnaPage />);
    expect(screen.getByText('الگوی غذایی‌ات چیه؟')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'vegetarian' }));
    expect(submitAnswer).toHaveBeenCalledWith('dietary.pattern', 'vegetarian');
    expect(await screen.findByText('ثبت شد')).toBeInTheDocument();
  });
});
