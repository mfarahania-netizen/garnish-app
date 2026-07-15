import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import FoodDnaPage from './page';

// minimal localStorage/sessionStorage shim (jsdom in this config exposes no Storage).
if (!('localStorage' in globalThis) || globalThis.localStorage == null) {
  const makeStore = () => {
    const map = new Map();
    return {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
      clear: () => map.clear(),
      key: (i) => [...map.keys()][i] ?? null,
      get length() { return map.size; },
    };
  };
  Object.defineProperty(globalThis, 'localStorage', { value: makeStore(), configurable: true });
  Object.defineProperty(globalThis, 'sessionStorage', { value: makeStore(), configurable: true });
}

// Mock the data hook; each test sets the state under test (mirrors the plan/home smoke pattern).
// useTaste (FI-4.1) is stubbed empty so the page's taste section stays empty in these smokes.
vi.mock('./useFoodDna', () => ({
  useFoodDna: vi.fn(),
  useFoodDnaProjection: vi.fn(),
  useTaste: vi.fn(() => ({ items: [], loading: false, correct: vi.fn(), correcting: false })),
}));
import { useFoodDna } from './useFoodDna';

const DIMS = [
  { key: 'taste', status: 'usable', confidence: 0.6, evidenceCount: 5, safeExplanation: 'ENGINE ENGLISH STRING SHOULD NEVER RENDER', summary: '', limitations: [], metrics: [{ key: 'flavorPattern', value: 'smoky/herby' }], affinities: ['بادمجان'], avoidances: ['کرفس'] },
  { key: 'effort', status: 'usable', confidence: 0.5, evidenceCount: 4, safeExplanation: 'another engine string', summary: '', limitations: [], metrics: [{ key: 'quickMeal', value: 0.7 }] },
  { key: 'skill', status: 'emerging', confidence: 0.4, evidenceCount: 3, safeExplanation: 'x', summary: '', limitations: [], metrics: [] },
  { key: 'routine', status: 'empty', confidence: 0, evidenceCount: 0, safeExplanation: '', summary: '', limitations: [], metrics: [] },
];
const READY = {
  status: 'ready',
  dna: {
    status: 'partial',
    maturity: { band: 'developing', score: 0.48, trustGuidance: 'Profile is developing — reasonable to personalize.', observedConfidence: 0.6, declaredCoverage: 0.1 },
    dimensions: DIMS,
    strongestDimensions: ['taste'],
    weakestDimensions: ['routine'],
    evidence: { observationCount: 12, sourceSignalCount: 12 },
  },
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

  it('NEVER leaks the English trustGuidance or safeExplanation — derives Persian from band instead', () => {
    useFoodDna.mockReturnValue(READY);
    const { container } = renderWithProviders(<FoodDnaPage />);
    // the page MUST NOT render the raw English engine strings
    expect(screen.queryByText(/Profile is developing/)).not.toBeInTheDocument();
    expect(screen.queryByText(/reasonable to personalize/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ENGINE ENGLISH STRING/)).not.toBeInTheDocument();
    // and MUST show a Persian band-derived line
    expect(screen.getByText(/بر اساسِ ۱۲ وعده/)).toBeInTheDocument();
    // header uses ONE consistent Persian title
    expect(screen.getByRole('heading', { name: 'شناسهٔ ذائقهٔ تو' })).toBeInTheDocument();
    // no leftover English word leaks anywhere on the page
    expect(container.textContent).not.toMatch(/reasonable to personalize/i);
  });

  it('maps the flavor metric to Persian (never leaks "smoky/herby")', () => {
    useFoodDna.mockReturnValue(READY);
    renderWithProviders(<FoodDnaPage />);
    expect(screen.getByText('طعم‌های پسندیده: دودی و گیاهی')).toBeInTheDocument();
    expect(screen.queryByText(/smoky\/herby/)).not.toBeInTheDocument();
    expect(screen.queryByText(/smoky/)).not.toBeInTheDocument();
  });

  it('ring shows the band caption (Persian), not the raw English band label', () => {
    useFoodDna.mockReturnValue(READY);
    renderWithProviders(<FoodDnaPage />);
    expect(screen.getByRole('img', { name: /در حالِ رشد/ })).toBeInTheDocument();
  });

  it('HIDES the silent dimension (routine, confidence 0) instead of an empty card', () => {
    useFoodDna.mockReturnValue(READY);
    renderWithProviders(<FoodDnaPage />);
    // taste/effort/skill cards render their Persian labels...
    for (const label of ['ذائقه و طعم', 'زمان و تلاش', 'مهارتِ آشپزی']) expect(screen.getByText(label)).toBeInTheDocument();
    // ...but the silent routine card is NOT rendered (no empty "روال" card)
    expect(screen.queryByText('روالِ آشپزی')).not.toBeInTheDocument();
  });

  it('promotes affinities + avoidances to first-class chip sections', () => {
    useFoodDna.mockReturnValue(READY);
    renderWithProviders(<FoodDnaPage />);
    expect(screen.getByRole('heading', { name: 'موادی که بهشون گرایش داری' })).toBeInTheDocument();
    expect(screen.getByText('بادمجان')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'موادی که کمتر دوست داری' })).toBeInTheDocument();
    expect(screen.getByText('کرفس')).toBeInTheDocument();
  });

  it('cold-start: no demoralizing 0% — ring uses showValue={false} with a calm caption', () => {
    useFoodDna.mockReturnValue({
      ...READY,
      dna: {
        status: 'cold_start',
        maturity: { band: 'empty', score: 0, trustGuidance: 'Not enough profile signal yet.', observedConfidence: 0, declaredCoverage: 0 },
        dimensions: DIMS.map((d) => ({ ...d, confidence: 0, safeExplanation: '', metrics: [] })),
        strongestDimensions: [], weakestDimensions: [], evidence: { observationCount: 0, sourceSignalCount: 0 },
      },
    });
    renderWithProviders(<FoodDnaPage />);
    // calm Persian forming line
    expect(screen.getAllByText(/تازه شروع شده/).length).toBeGreaterThan(0);
    // a 0% / ۰٪ must not appear as a big ring value (no "۰٪" aria-label as a percentage)
    expect(screen.queryByRole('img', { name: /۰٪/ })).not.toBeInTheDocument();
    // no raw English trustGuidance
    expect(screen.queryByText(/Not enough profile signal/)).not.toBeInTheDocument();
    // silent dimensions collapsed into one calm empty-state block
    expect(screen.getAllByText(/نشانهٔ کافی از آشپزیت ندارم/).length).toBeGreaterThan(0);
  });

  it('onboarding options are Persian; submitting keeps the raw enum KEY but shows the Persian LABEL', async () => {
    const submitAnswer = vi.fn().mockResolvedValue(true);
    useFoodDna.mockReturnValue({
      ...READY, submitAnswer,
      question: { id: 'dietary.pattern', dimensionKey: 'dietary.pattern', prompt: 'Which dietary pattern best describes how you eat?', options: ['omnivore', 'vegetarian'] },
      questionRemaining: 3,
    });
    renderWithProviders(<FoodDnaPage />);
    // Persian labels render, NOT the raw English prompts/options
    expect(screen.getByText('الگوی غذایی‌ات رو چطور توصیف می‌کنی؟')).toBeInTheDocument();
    expect(screen.getByText('همه‌چیزخوار')).toBeInTheDocument();
    expect(screen.getByText('گیاهی با تخم‌مرغ و لبنیات')).toBeInTheDocument();
    expect(screen.queryByText(/Which dietary pattern/)).not.toBeInTheDocument();
    expect(screen.queryByText('omnivore')).not.toBeInTheDocument();
    // submitting keeps the raw enum key (the backend contract)
    fireEvent.click(screen.getByRole('button', { name: 'همه‌چیزخوار' }));
    expect(submitAnswer).toHaveBeenCalledWith('dietary.pattern', 'omnivore');
    expect(await screen.findByText('ثبت شد')).toBeInTheDocument();
    expect(screen.getByText(/۳ سؤال دیگه/)).toBeInTheDocument();
  });

  it('renders the primary CTA that navigates to discovery', () => {
    useFoodDna.mockReturnValue(READY);
    renderWithProviders(<FoodDnaPage />);
    expect(screen.getByRole('button', { name: /غذاهای مناسب ذائقه‌ات/ })).toBeInTheDocument();
  });

  it('the taste section shows a calm empty-state invitation when nothing is inferred', () => {
    useFoodDna.mockReturnValue(READY); // useTaste is globally stubbed empty
    renderWithProviders(<FoodDnaPage />);
    expect(screen.getByRole('heading', { name: 'مواد و سلیقهٔ تو' })).toBeInTheDocument();
    expect(screen.getByText(/حدسِ مشخصی از سلیقه‌ات در مواد ندارم/)).toBeInTheDocument();
  });
});
