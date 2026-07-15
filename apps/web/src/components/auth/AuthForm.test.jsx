import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import AuthForm from './AuthForm';

const auth = vi.hoisted(() => ({
  requestOtp: vi.fn(),
  verifyOtp: vi.fn(),
  loginWithGoogle: vi.fn(),
  guest: vi.fn(),
}));

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => auth,
}));

vi.mock('@mantine/core', () => ({
  Box: ({ component: Component = 'div', children, ...props }) => <Component {...props}>{children}</Component>,
  Text: ({ component: Component = 'span', children, ...props }) => <Component {...props}>{children}</Component>,
  UnstyledButton: ({ children, ...props }) => <button {...props}>{children}</button>,
}));

vi.mock('framer-motion', () => {
  const components = new Map();
  return {
    AnimatePresence: ({ children }) => <>{children}</>,
    useReducedMotion: () => true,
    motion: new Proxy({}, {
      get: (_target, tag) => {
        if (!components.has(tag)) {
          components.set(tag, ({ children, initial: _initial, animate: _animate, exit: _exit, transition: _transition, whileHover: _whileHover, whileTap: _whileTap, ...props }) => {
            const Component = tag;
            return <Component data-motion-initial={JSON.stringify(_initial)} data-motion-transition={JSON.stringify(_transition)} {...props}>{children}</Component>;
          });
        }
        return components.get(tag);
      },
    }),
  };
});

vi.mock('@tabler/icons-react', () => ({
  IconLeaf: () => <span aria-hidden="true" />,
  IconAlertTriangle: () => <span aria-hidden="true" />,
  IconCheck: () => <span aria-hidden="true" />,
  IconPencil: () => <span aria-hidden="true" />,
  IconShieldCheck: () => <span aria-hidden="true" />,
}));

beforeEach(() => {
  auth.requestOtp.mockReset();
  auth.verifyOtp.mockReset();
  auth.loginWithGoogle.mockReset();
  auth.guest.mockReset();
  import.meta.env.VITE_GOOGLE_AUTH_ENABLED = 'false';
  import.meta.env.VITE_GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
  delete window.google;
  delete window.OTPCredential;
  delete navigator.credentials;
  document.head.querySelectorAll('script[data-garnish-google-identity="true"]').forEach((el) => el.remove());
});

describe('AuthForm OTP behavior', () => {
  it('requests an OTP with a plain 09 Iranian mobile number', async () => {
    auth.requestOtp.mockResolvedValue({ ok: true, message: 'sent', resendCooldownSeconds: 0 });
    render(<AuthForm />);

    fireEvent.change(screen.getByLabelText('شماره موبایل'), { target: { value: '09125859634' } });
    fireEvent.click(screen.getByRole('button', { name: 'دریافت کد ورود' }));

    await waitFor(() => expect(auth.requestOtp).toHaveBeenCalledWith('09125859634'));
    expect(screen.getByLabelText('کد ورود')).toBeInTheDocument();
  });

  it('allows only one OTP request when Enter fires twice in the same React frame', async () => {
    const pending = deferred();
    auth.requestOtp.mockReturnValue(pending.promise);
    render(<AuthForm />);
    const phoneInput = screen.getByLabelText('شماره موبایل');
    fireEvent.change(phoneInput, { target: { value: '09125859634' } });

    act(() => {
      fireEvent.keyDown(phoneInput, { key: 'Enter' });
      fireEvent.keyDown(phoneInput, { key: 'Enter' });
    });

    expect(auth.requestOtp).toHaveBeenCalledTimes(1);
    await act(async () => {
      pending.resolve({ ok: true, message: 'sent' });
      await pending.promise;
    });
  });

  it('ignores a delayed OTP-request response after the phone has changed', async () => {
    const first = deferred();
    auth.requestOtp
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce({ ok: true, message: 'sent for B' });
    render(<AuthForm />);
    const phoneInput = screen.getByLabelText('شماره موبایل');
    fireEvent.change(phoneInput, { target: { value: '09125859634' } });
    fireEvent.click(screen.getByRole('button', { name: 'دریافت کد ورود' }));
    expect(auth.requestOtp).toHaveBeenCalledWith('09125859634');

    fireEvent.change(phoneInput, { target: { value: '09365773111' } });
    await act(async () => {
      first.resolve({ ok: true, message: 'stale A response' });
      await first.promise;
    });

    await waitFor(() => expect(screen.getByRole('button', { name: 'دریافت کد ورود' })).not.toBeDisabled());
    expect(screen.queryByLabelText('کد ورود')).not.toBeInTheDocument();
    expect(screen.queryByText('stale A response')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'دریافت کد ورود' }));
    await waitFor(() => expect(auth.requestOtp).toHaveBeenLastCalledWith('09365773111'));
    expect(await screen.findByLabelText('کد ورود')).toBeInTheDocument();
  });

  it('rejects +98 and 0098 formats in the primary OTP flow', async () => {
    render(<AuthForm />);

    fireEvent.change(screen.getByLabelText('شماره موبایل'), { target: { value: '+989125859634' } });
    fireEvent.click(screen.getByRole('button', { name: 'دریافت کد ورود' }));

    expect(auth.requestOtp).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('فقط با فرمت ۰۹');
  });

  it('does not animate validation alerts when reduced motion is requested', () => {
    render(<AuthForm />);

    fireEvent.change(screen.getByLabelText('شماره موبایل'), { target: { value: '+989125859634' } });
    fireEvent.click(screen.getByRole('button', { name: 'دریافت کد ورود' }));

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('data-motion-initial', 'false');
    expect(alert).toHaveAttribute('data-motion-transition', '{"duration":0}');
  });

  it('automatically verifies a 6 digit OTP and calls onSuccess without a submit button', async () => {
    const onSuccess = vi.fn();
    auth.requestOtp.mockResolvedValue({ ok: true, message: 'sent' });
    auth.verifyOtp.mockResolvedValue({ id: 'u1', phone: '09125859634' });
    render(<AuthForm onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText('شماره موبایل'), { target: { value: '09125859634' } });
    fireEvent.click(screen.getByRole('button', { name: 'دریافت کد ورود' }));
    await waitFor(() => expect(auth.requestOtp).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText('کد ورود'), { target: { value: '123456' } });

    await waitFor(() => expect(auth.verifyOtp).toHaveBeenCalledWith('09125859634', '123456', undefined));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ id: 'u1', phone: '09125859634' }));
    expect(screen.queryByRole('button', { name: /ورود|ساخت حساب/ })).not.toBeInTheDocument();
  });

  it('ignores a late WebOTP credential after the user changes to another phone', async () => {
    const staleCredential = deferred();
    const currentCredential = deferred();
    Object.defineProperty(window, 'OTPCredential', { configurable: true, value: function OTPCredential() {} });
    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      value: {
        get: vi.fn()
          .mockReturnValueOnce(staleCredential.promise)
          .mockReturnValueOnce(currentCredential.promise),
      },
    });
    auth.requestOtp.mockResolvedValue({ ok: true, message: 'sent', resendCooldownSeconds: 60 });
    render(<AuthForm />);

    fireEvent.change(screen.getByLabelText('شماره موبایل'), { target: { value: '09125859634' } });
    fireEvent.click(screen.getByRole('button', { name: 'دریافت کد ورود' }));
    await screen.findByLabelText('کد ورود');
    fireEvent.click(screen.getByRole('button', { name: 'تغییر شماره' }));
    fireEvent.change(screen.getByLabelText('شماره موبایل'), { target: { value: '09365773111' } });
    fireEvent.click(screen.getByRole('button', { name: 'دریافت کد ورود' }));
    const currentInput = await screen.findByLabelText('کد ورود');

    await act(async () => {
      staleCredential.resolve({ code: '123456' });
      await staleCredential.promise;
    });

    expect(currentInput).toHaveValue('');
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it('shows checking and verified states before completing entry', async () => {
    const onSuccess = vi.fn();
    let resolveVerification;
    auth.requestOtp.mockResolvedValue({ ok: true, message: 'sent' });
    auth.verifyOtp.mockReturnValue(new Promise((resolve) => { resolveVerification = resolve; }));
    render(<AuthForm onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText('شماره موبایل'), { target: { value: '09125859634' } });
    fireEvent.click(screen.getByRole('button', { name: 'دریافت کد ورود' }));
    const otpInput = await screen.findByLabelText('کد ورود');
    fireEvent.change(otpInput, { target: { value: '123456' } });

    expect(await screen.findByText('در حال بررسی کد…')).toBeInTheDocument();
    expect(auth.verifyOtp).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'تغییر شماره' })).toBeDisabled();
    await act(async () => resolveVerification({ id: 'u1', phone: '09125859634' }));
    expect(await screen.findByText('کد تأیید شد؛ در حال ورود…')).toBeInTheDocument();
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  it('focuses the OTP input as soon as the code step opens', async () => {
    auth.requestOtp.mockResolvedValue({ ok: true, message: 'sent' });
    render(<AuthForm />);

    fireEvent.change(screen.getByLabelText('شماره موبایل'), { target: { value: '09125859634' } });
    fireEvent.click(screen.getByRole('button', { name: 'دریافت کد ورود' }));

    const otpInput = await screen.findByLabelText('کد ورود');
    expect(otpInput).toHaveFocus();
    expect(screen.queryByLabelText('نام')).not.toBeInTheDocument();
  });

  it('shows the existing error flow and clears a rejected code for retry', async () => {
    auth.requestOtp.mockResolvedValue({ ok: true, message: 'sent' });
    auth.verifyOtp.mockRejectedValue({ response: { data: { message: 'کد نامعتبر است.' } } });
    render(<AuthForm />);

    fireEvent.change(screen.getByLabelText('شماره موبایل'), { target: { value: '09125859634' } });
    fireEvent.click(screen.getByRole('button', { name: 'دریافت کد ورود' }));
    const otpInput = await screen.findByLabelText('کد ورود');
    fireEvent.change(otpInput, { target: { value: '111111' } });

    expect(await screen.findByRole('alert')).toHaveTextContent('کد نامعتبر است.');
    await waitFor(() => expect(otpInput).toHaveValue(''));
  });

  it('does not render password or forgot-password controls', () => {
    render(<AuthForm />);

    expect(screen.queryByPlaceholderText('••••••••')).not.toBeInTheDocument();
    expect(screen.queryByText('فراموشی رمز عبور؟')).not.toBeInTheDocument();
  });

  it('disables resend while the countdown is active', async () => {
    auth.requestOtp.mockResolvedValue({ ok: true, message: 'sent', ttlSeconds: 120, resendCooldownSeconds: 60 });
    render(<AuthForm />);

    fireEvent.change(screen.getByLabelText('شماره موبایل'), { target: { value: '09125859634' } });
    fireEvent.click(screen.getByRole('button', { name: 'دریافت کد ورود' }));

    await waitFor(() => expect(screen.getByText(/ارسال دوباره در/)).toHaveTextContent('۱:۰۰'));
    expect(screen.queryByRole('button', { name: 'ارسال دوباره کد' })).not.toBeInTheDocument();
  });

  it('renders OTP validity from backend timing and uses launch-safe fallbacks', async () => {
    auth.requestOtp.mockResolvedValue({ ok: true, message: 'sent', ttlSeconds: 180, resendCooldownSeconds: 0 });
    render(<AuthForm />);

    fireEvent.change(screen.getByLabelText('شماره موبایل'), { target: { value: '09125859634' } });
    fireEvent.click(screen.getByRole('button', { name: 'دریافت کد ورود' }));

    expect(await screen.findByText(/کد تا ۳ دقیقه معتبر است/)).toBeInTheDocument();
    expect(screen.getByText(/ارسال دوباره در/)).toHaveTextContent('۱:۰۰');
  });

  it('does not request another OTP when the user changes back to the same phone during cooldown', async () => {
    auth.requestOtp.mockResolvedValue({ ok: true, message: 'sent', resendCooldownSeconds: 60 });
    render(<AuthForm />);

    fireEvent.change(screen.getByLabelText('شماره موبایل'), { target: { value: '09125859634' } });
    fireEvent.click(screen.getByRole('button', { name: 'دریافت کد ورود' }));
    await waitFor(() => expect(auth.requestOtp).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'تغییر شماره' }));
    fireEvent.click(screen.getByRole('button', { name: 'دریافت کد ورود' }));

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

  it('fits the official Google button to a narrow container', async () => {
    import.meta.env.VITE_GOOGLE_AUTH_ENABLED = 'true';
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 248,
      height: 44,
      top: 0,
      left: 0,
      right: 248,
      bottom: 44,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const renderButton = vi.fn();
    window.google = { accounts: { id: { initialize: vi.fn(), renderButton } } };

    render(<AuthForm />);

    await waitFor(() => expect(renderButton).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({ width: 248 })));
    rectSpy.mockRestore();
  });

  it('does not recreate the Google button when phone state changes', async () => {
    import.meta.env.VITE_GOOGLE_AUTH_ENABLED = 'true';
    const renderButton = vi.fn();
    window.google = { accounts: { id: { initialize: vi.fn(), renderButton } } };
    render(<AuthForm />);
    await waitFor(() => expect(renderButton).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('شماره موبایل'), { target: { value: '0912' } });

    expect(renderButton).toHaveBeenCalledTimes(1);
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
