import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AuthForm from './AuthForm';

const auth = vi.hoisted(() => ({
  requestOtp: vi.fn(),
  verifyOtp: vi.fn(),
  loginWithGoogle: vi.fn(),
  guest: vi.fn(),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => auth,
}));

vi.mock('@mantine/core', () => ({
  Box: ({ component: Component = 'div', children, ...props }) => <Component {...props}>{children}</Component>,
  Text: ({ component: Component = 'span', children, ...props }) => <Component {...props}>{children}</Component>,
  UnstyledButton: ({ children, ...props }) => <button {...props}>{children}</button>,
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }) => <>{children}</>,
  motion: new Proxy({}, {
    get: (_target, tag) => ({ children, ...props }) => {
      const Component = tag;
      return <Component {...props}>{children}</Component>;
    },
  }),
}));

vi.mock('@tabler/icons-react', () => ({
  IconLeaf: () => <span aria-hidden="true" />,
  IconAlertTriangle: () => <span aria-hidden="true" />,
  IconShieldCheck: () => <span aria-hidden="true" />,
  IconSparkles: () => <span aria-hidden="true" />,
}));

beforeEach(() => {
  auth.requestOtp.mockReset();
  auth.verifyOtp.mockReset();
  auth.loginWithGoogle.mockReset();
  auth.guest.mockReset();
  import.meta.env.VITE_GOOGLE_AUTH_ENABLED = 'false';
  import.meta.env.VITE_GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
  delete window.google;
  document.head.querySelectorAll('script[data-garnish-google-identity="true"]').forEach((el) => el.remove());
});

describe('AuthForm OTP behavior', () => {
  it('requests an OTP with a plain 09 Iranian mobile number', async () => {
    auth.requestOtp.mockResolvedValue({ ok: true, message: 'sent', resendCooldownSeconds: 0 });
    render(<AuthForm />);

    fireEvent.change(screen.getByPlaceholderText('۰۹...'), { target: { value: '09125859634' } });
    fireEvent.click(screen.getByRole('button', { name: 'ارسال کد ورود' }));

    await waitFor(() => expect(auth.requestOtp).toHaveBeenCalledWith('09125859634'));
    expect(screen.getByLabelText('کد ورود')).toBeInTheDocument();
  });

  it('rejects +98 and 0098 formats in the primary OTP flow', async () => {
    render(<AuthForm />);

    fireEvent.change(screen.getByPlaceholderText('۰۹...'), { target: { value: '+989125859634' } });
    fireEvent.click(screen.getByRole('button', { name: 'ارسال کد ورود' }));

    expect(auth.requestOtp).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('فقط با فرمت ۰۹');
  });

  it('verifies a 6 digit OTP and calls onSuccess', async () => {
    const onSuccess = vi.fn();
    auth.requestOtp.mockResolvedValue({ ok: true, message: 'sent' });
    auth.verifyOtp.mockResolvedValue({ id: 'u1', phone: '09125859634' });
    render(<AuthForm onSuccess={onSuccess} />);

    fireEvent.change(screen.getByPlaceholderText('۰۹...'), { target: { value: '09125859634' } });
    fireEvent.click(screen.getByRole('button', { name: 'ارسال کد ورود' }));
    await waitFor(() => expect(auth.requestOtp).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText('کد ورود'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'ورود / ساخت حساب' }));

    await waitFor(() => expect(auth.verifyOtp).toHaveBeenCalledWith('09125859634', '123456', undefined));
    expect(onSuccess).toHaveBeenCalledWith({ id: 'u1', phone: '09125859634' });
  });

  it('does not render password or forgot-password controls', () => {
    render(<AuthForm />);

    expect(screen.queryByPlaceholderText('••••••••')).not.toBeInTheDocument();
    expect(screen.queryByText('فراموشی رمز عبور؟')).not.toBeInTheDocument();
  });

  it('disables resend while the countdown is active', async () => {
    auth.requestOtp.mockResolvedValue({ ok: true, message: 'sent', ttlSeconds: 120, resendCooldownSeconds: 60 });
    render(<AuthForm />);

    fireEvent.change(screen.getByPlaceholderText('۰۹...'), { target: { value: '09125859634' } });
    fireEvent.click(screen.getByRole('button', { name: 'ارسال کد ورود' }));

    await waitFor(() => expect(screen.getByRole('button', { name: /ارسال دوباره ·/ })).toBeDisabled());
    expect(document.body.textContent).toContain('\u06f2');
    expect(screen.getByRole('button', { name: /\u06f6\u06f0/ })).toBeDisabled();
  });

  it('renders OTP validity copy from backend ttlSeconds', async () => {
    auth.requestOtp.mockResolvedValue({ ok: true, message: 'sent', ttlSeconds: 180, resendCooldownSeconds: 60 });
    render(<AuthForm />);

    fireEvent.change(document.querySelector('input[type="tel"]'), { target: { value: '09125859634' } });
    fireEvent.click(screen.getAllByRole('button')[0]);

    await waitFor(() => expect(auth.requestOtp).toHaveBeenCalled());
    expect(document.body.textContent).toContain('\u06f3');
  });

  it('does not request another OTP when the user changes back to the same phone during cooldown', async () => {
    auth.requestOtp.mockResolvedValue({ ok: true, message: 'sent', resendCooldownSeconds: 180 });
    render(<AuthForm />);

    fireEvent.change(screen.getByPlaceholderText('۰۹...'), { target: { value: '09125859634' } });
    fireEvent.click(screen.getByRole('button', { name: 'ارسال کد ورود' }));
    await waitFor(() => expect(auth.requestOtp).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'تغییر شماره' }));
    fireEvent.click(screen.getByRole('button', { name: 'ارسال کد ورود' }));

    expect(auth.requestOtp).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('کد ورود')).toBeInTheDocument();
  });

  it('hides Google sign-in when disabled by env', () => {
    render(<AuthForm />);
    expect(screen.queryByTestId('official-google-signin')).not.toBeInTheDocument();
  });

  it('loads the Google Identity Services script when enabled by env', () => {
    import.meta.env.VITE_GOOGLE_AUTH_ENABLED = 'true';
    render(<AuthForm />);

    expect(document.querySelector('script[data-garnish-google-identity="true"]')?.getAttribute('src')).toBe('https://accounts.google.com/gsi/client');
  });

  it('renders the official Google button when enabled by env', async () => {
    import.meta.env.VITE_GOOGLE_AUTH_ENABLED = 'true';
    const renderButton = vi.fn();
    window.google = { accounts: { id: { initialize: vi.fn(), renderButton } } };
    render(<AuthForm />);

    expect(await screen.findByTestId('official-google-signin')).toBeInTheDocument();
    await waitFor(() => expect(renderButton).toHaveBeenCalledWith(expect.any(HTMLElement), {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      text: 'continue_with',
      logo_alignment: 'left',
      width: 320,
    }));
    expect(screen.queryByRole('button', { name: 'ورود با گوگل' })).not.toBeInTheDocument();
  });

  it('passes the Google credential to AuthContext and calls onSuccess', async () => {
    import.meta.env.VITE_GOOGLE_AUTH_ENABLED = 'true';
    const onSuccess = vi.fn();
    const initialize = vi.fn();
    window.google = { accounts: { id: { initialize, renderButton: vi.fn() } } };
    auth.loginWithGoogle.mockResolvedValue({ id: 'u-google', onboardingComplete: false, isGuest: false });
    render(<AuthForm onSuccess={onSuccess} />);

    await waitFor(() => expect(initialize).toHaveBeenCalled());
    const callback = initialize.mock.calls[0][0].callback;
    await callback({ credential: 'google-id-token' });

    expect(auth.loginWithGoogle).toHaveBeenCalledWith('google-id-token');
    expect(onSuccess).toHaveBeenCalledWith({ id: 'u-google', onboardingComplete: false, isGuest: false });
    expect(auth.requestOtp).not.toHaveBeenCalled();
    expect(auth.guest).not.toHaveBeenCalled();
  });
});
