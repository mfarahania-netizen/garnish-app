import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';

const apiMock = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../../lib/apiClient', () => ({ default: apiMock }));
vi.mock('../../context/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({ token: 'token', user: { id: 'u1' } }),
}));

import TasteBuilder from './TasteBuilder';

beforeEach(() => {
  apiMock.get.mockReset().mockResolvedValue({ data: { items: [] } });
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});

describe('TasteBuilder V2 states', () => {
  it('loads safe quick candidates and emits a one-tap like', async () => {
    const onAdd = vi.fn();
    apiMock.get.mockResolvedValueOnce({ data: { items: [{ id: 'r1', title: 'کوکو سبزی' }] } });
    renderWithProviders(<TasteBuilder likes={[]} dislikes={[]} onAdd={onAdd} onRemove={vi.fn()} />);
    expect(screen.getByRole('status', { name: /آماده‌کردن/ })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('کوکو سبزی')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /کوکو سبزی را می‌پسندم/ }));
    expect(onAdd).toHaveBeenCalledWith('like', expect.objectContaining({ id: 'r1', name: 'کوکو سبزی' }));
  });

  it('shows an honest empty state when no safe candidate exists', async () => {
    renderWithProviders(<TasteBuilder likes={[]} dislikes={[]} onAdd={vi.fn()} onRemove={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/فعلاً غذای مناسبی/)).toBeInTheDocument());
  });

  it('keeps search available when quick candidates fail', async () => {
    apiMock.get.mockRejectedValueOnce(new Error('offline'));
    renderWithProviders(<TasteBuilder likes={[]} dislikes={[]} onAdd={vi.fn()} onRemove={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/پیشنهادهای شروع بارگذاری نشدند/)).toBeInTheDocument());
    expect(screen.getByText(/غذای دیگری در ذهن داری/)).toBeInTheDocument();
  });

  it('announces offline search instead of leaving a silent spinner', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    renderWithProviders(<TasteBuilder likes={[]} dislikes={[]} onAdd={vi.fn()} onRemove={vi.fn()} />);
    fireEvent.click(screen.getByText(/غذای دیگری در ذهن داری/));
    fireEvent.change(screen.getByRole('searchbox', { name: 'جست‌وجوی غذا' }), { target: { value: 'عدس' } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/اینترنت/));
  });

  it('offers a working retry when quick candidates fail', async () => {
    apiMock.get
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValueOnce({ data: { items: [{ id: 'r2', title: 'آش رشته' }] } });
    renderWithProviders(<TasteBuilder likes={[]} dislikes={[]} onAdd={vi.fn()} onRemove={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/پیشنهادهای شروع بارگذاری نشدند/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'تلاش دوباره' }));
    await waitFor(() => expect(screen.getByText('آش رشته')).toBeInTheDocument());
    expect(apiMock.get).toHaveBeenCalledTimes(2);
  });

  it('retries the current search query after a transient request failure', async () => {
    let searchCalls = 0;
    apiMock.get.mockImplementation((_url, config) => {
      if (!config?.params?.q) return Promise.resolve({ data: { items: [] } });
      searchCalls += 1;
      if (searchCalls === 1) return Promise.reject(new Error('temporary'));
      return Promise.resolve({ data: { items: [{ id: 'r3', title: 'عدس‌پلو' }] } });
    });
    renderWithProviders(<TasteBuilder likes={[]} dislikes={[]} onAdd={vi.fn()} onRemove={vi.fn()} />);
    fireEvent.click(screen.getByText(/غذای دیگری در ذهن داری/));
    fireEvent.change(screen.getByRole('searchbox', { name: 'جست‌وجوی غذا' }), { target: { value: 'عدس' } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/جست‌وجو انجام نشد/));
    fireEvent.click(screen.getByRole('button', { name: 'تلاش دوباره' }));
    await waitFor(() => expect(screen.getByText('عدس‌پلو')).toBeInTheDocument());
    expect(searchCalls).toBe(2);
  });

  it('renders a full-size labelled remove action for selected dishes', async () => {
    const onRemove = vi.fn();
    renderWithProviders(
      <TasteBuilder
        likes={[{ id: 'r1', name: 'عدس‌پلو', type: 'dish' }]}
        dislikes={[]}
        onAdd={vi.fn()}
        onRemove={onRemove}
      />,
    );
    await waitFor(() => expect(screen.getByText(/فعلاً غذای مناسبی/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'حذف عدس‌پلو از انتخاب‌ها' }));
    expect(onRemove).toHaveBeenCalledWith('like', 'r1');
  });
});
