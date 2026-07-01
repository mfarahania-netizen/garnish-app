import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';

// jsdom lacks these — Mantine's autosize Textarea (new-ticket form) touches them. Polyfill before any mount.
beforeAll(() => {
  if (!window.matchMedia) window.matchMedia = (q) => ({ matches: false, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false });
  if (!window.ResizeObserver) window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  if (!window.visualViewport) window.visualViewport = { addEventListener() {}, removeEventListener() {}, width: 1024, height: 768, offsetTop: 0, offsetLeft: 0, scale: 1 };
  if (!document.fonts) Object.defineProperty(document, 'fonts', { configurable: true, value: { addEventListener() {}, removeEventListener() {}, ready: Promise.resolve(), status: 'loaded' } });
});

// The support page doesn't use useAuth — passthrough the provider so no AuthProvider network runs.
vi.mock('../../context/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({ user: null, token: 't' }),
}));

// No network in tests — list resolves empty so we hit the (deterministic) empty state.
vi.mock('../../lib/apiClient', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: [] })),
    post: vi.fn(() => Promise.resolve({ data: { id: 'x' } })),
    patch: vi.fn(() => Promise.resolve({ data: {} })),
  },
}));

import SupportPage from './page';
import apiClient from '../../lib/apiClient';

describe('SupportPage smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the header, empty state, and the new-ticket CTA', async () => {
    renderWithProviders(<SupportPage />);
    expect(screen.getByRole('heading', { name: 'پشتیبانی' })).toBeInTheDocument();
    expect(await screen.findByText('هنوز تیکتی نداری')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /تیکتِ جدید/ })).toBeInTheDocument();
  });

  it('opens the new-ticket form with category + priority choices', async () => {
    renderWithProviders(<SupportPage />);
    await screen.findByText('هنوز تیکتی نداری');
    fireEvent.click(screen.getByRole('button', { name: /تیکتِ جدید/ }));
    expect(screen.getByRole('heading', { name: 'تیکتِ جدید' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'فنی' })).toBeInTheDocument(); // category chip
    expect(screen.getByRole('button', { name: 'فوری' })).toBeInTheDocument(); // priority chip
    expect(screen.getByRole('button', { name: 'ارسالِ تیکت' })).toBeInTheDocument();
  });

  it('submits a valid user ticket to the support API', async () => {
    renderWithProviders(<SupportPage />);
    await screen.findByText('هنوز تیکتی نداری');
    fireEvent.click(screen.getByRole('button', { name: /تیکتِ جدید/ }));

    const submit = screen.getByTestId('support-submit-ticket');
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText('عنوان'), { target: { value: 'مشکل ورود' } });
    fireEvent.change(screen.getByLabelText('توضیح'), { target: { value: 'ارسال تیکت از سمت کاربر کار نمی‌کند.' } });

    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/support/tickets', {
        subject: 'مشکل ورود',
        message: 'ارسال تیکت از سمت کاربر کار نمی‌کند.',
        category: 'general',
        priority: 'normal',
      });
    });
  });
});
