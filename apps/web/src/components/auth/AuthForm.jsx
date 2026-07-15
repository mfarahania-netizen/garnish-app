// Shared auth form - focused, passwordless phone OTP entry for /login.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, UnstyledButton } from '@mantine/core';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  IconAlertTriangle,
  IconCheck,
  IconLeaf,
  IconPencil,
  IconShieldCheck,
} from '@tabler/icons-react';
import { useAuth } from '../../context/AuthContext';
import GoogleSignInButton from './GoogleSignInButton';

const FA = '۰۱۲۳۴۵۶۷۸۹';
const toLatin = (value) => String(value ?? '').replace(/[۰-۹]/g, (digit) => String(FA.indexOf(digit)));
const toFaDigits = (value) => String(value ?? '').replace(/\d/g, (digit) => FA[Number(digit)]);
const PHONE_RE = /^09\d{9}$/;
const normalizePhone = (value) => toLatin(value).replace(/[\s\-()]/g, '');
const delay = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
const safeSeconds = (value, fallback) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : fallback;
};

const CSS = `
.gz-auth *{box-sizing:border-box}
.gz-auth{position:relative;overflow:hidden}
.gz-auth:before{content:"";position:absolute;inset-inline:-30% 18%;inset-block-start:-150px;block-size:215px;border-radius:50%;background:radial-gradient(circle,rgba(255,127,31,.13),rgba(255,127,31,0) 68%);pointer-events:none}
.gz-auth .gz-header{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;transition:padding-block-start .22s ease}
.gz-auth .gz-brand-mark{inline-size:54px;block-size:54px;border-radius:18px;display:grid;place-items:center;box-shadow:0 12px 32px rgba(234,96,0,.13);border:1px solid rgba(234,96,0,.08)}
.gz-auth .gz-field-label{display:block;font-family:var(--g-font-fa);font-size:12px;font-weight:750;color:var(--g-color-text-secondary);margin-block-end:8px;padding-inline:3px}
.gz-auth .gz-phone-field{display:flex;align-items:center;gap:10px;block-size:56px;padding-inline:17px;background:var(--g-color-bg-canvas);border:1px solid transparent;border-radius:17px;transition:background .2s ease,border-color .2s ease,box-shadow .2s ease,transform .2s ease}
.gz-auth .gz-phone-field:focus-within{background:var(--g-color-bg-surface);border-color:rgba(234,96,0,.56);box-shadow:0 0 0 4px rgba(234,96,0,.10),0 12px 28px rgba(64,42,20,.06);transform:translateY(-1px)}
.gz-auth input{border:0!important;outline:0!important;box-shadow:none!important}
.gz-auth input:focus,.gz-auth input:focus-visible{border:0!important;outline:0!important;box-shadow:none!important}
.gz-auth .gz-phone-field input{flex:1;min-inline-size:0;background:transparent;font-family:var(--g-font-fa);font-size:16px;font-weight:650;letter-spacing:.02em;color:var(--g-color-text-primary)}
.gz-auth .gz-phone-field input::placeholder{color:var(--g-color-text-muted);font-weight:500;opacity:1}
.gz-auth .gz-phone-field input:-webkit-autofill{-webkit-box-shadow:0 0 0 1000px var(--g-color-bg-canvas) inset!important;box-shadow:0 0 0 1000px var(--g-color-bg-canvas) inset!important;-webkit-text-fill-color:var(--g-color-text-primary)}
.gz-auth .gz-phone-field:focus-within input:-webkit-autofill{-webkit-box-shadow:0 0 0 1000px var(--g-color-bg-surface) inset!important;box-shadow:0 0 0 1000px var(--g-color-bg-surface) inset!important}
.gz-auth .gz-primary{display:flex;align-items:center;justify-content:center;inline-size:100%;min-block-size:54px;border:0;border-radius:17px;background:linear-gradient(135deg,var(--g-color-brand-600),#ff7b16);color:var(--g-color-text-inverse);font-family:var(--g-font-fa);font-size:15px;font-weight:850;cursor:pointer;box-shadow:0 15px 30px rgba(234,96,0,.24);transition:filter .18s ease,box-shadow .18s ease}
.gz-auth .gz-primary:focus-visible,.gz-auth .gz-link-btn:focus-visible{outline:3px solid rgba(234,96,0,.24);outline-offset:3px}
.gz-auth .gz-primary:disabled{cursor:default;filter:saturate(.45);box-shadow:none;opacity:.68}
.gz-auth .gz-divider{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;color:var(--g-color-text-muted);font-family:var(--g-font-fa);font-size:11px}
.gz-auth .gz-divider:before,.gz-auth .gz-divider:after{content:"";block-size:1px;background:var(--g-color-border-subtle)}
.gz-auth .gz-trust{display:flex;align-items:center;justify-content:center;gap:6px;color:var(--g-color-text-muted);font-family:var(--g-font-fa);font-size:11.5px}
.gz-auth .gz-phone-summary{display:flex;align-items:center;justify-content:center;gap:8px;direction:ltr;margin-block-start:10px}
.gz-auth .gz-phone-number{font-family:var(--g-font-fa);font-size:14px;font-weight:750;color:var(--g-color-text-secondary);letter-spacing:.035em}
.gz-auth .gz-edit-phone{display:inline-flex;align-items:center;justify-content:center;inline-size:28px;block-size:28px;border:0;border-radius:10px;background:var(--g-color-bg-canvas);color:var(--g-color-text-muted);cursor:pointer;transition:background .18s ease,color .18s ease,transform .18s ease}
.gz-auth .gz-edit-phone:hover{background:var(--g-color-brand-50);color:var(--g-color-brand-700);transform:translateY(-1px)}
.gz-auth .gz-otp{position:relative;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;direction:ltr}
.gz-auth .gz-otp-box{position:relative;block-size:54px;border-radius:16px;border:1px solid var(--g-color-border-subtle);background:var(--g-color-bg-canvas);display:grid;place-items:center;font-family:var(--g-font-fa);font-size:20px;font-weight:850;color:var(--g-color-text-primary);transition:border-color .18s ease,box-shadow .18s ease,background .18s ease,color .18s ease}
.gz-auth .gz-otp-box.is-filled{background:var(--g-color-bg-surface);border-color:rgba(234,96,0,.34);box-shadow:0 9px 24px rgba(234,96,0,.08)}
.gz-auth .gz-otp-box.is-active{border-color:var(--g-color-brand-600);box-shadow:0 0 0 4px rgba(234,96,0,.11)}
.gz-auth .gz-otp.is-checking .gz-otp-box{border-color:rgba(234,96,0,.52);background:var(--g-color-brand-50)}
.gz-auth .gz-otp.is-success .gz-otp-box{border-color:rgba(28,145,78,.42);background:var(--g-color-state-success-bg,#eaf7ef);color:var(--g-color-state-success-fg,#187544);box-shadow:0 10px 26px rgba(28,145,78,.10)}
.gz-auth .gz-otp.is-error .gz-otp-box{border-color:rgba(179,38,30,.5);background:var(--g-color-state-danger-bg,#fdeceb);color:var(--g-color-state-danger-fg,#b3261e)}
.gz-auth .gz-otp-input{position:absolute;inset:0;inline-size:100%;block-size:100%;opacity:.01;color:transparent;background:transparent;caret-color:transparent;font-size:16px;cursor:text}
.gz-auth .gz-code-status{min-block-size:24px;display:flex;align-items:center;justify-content:center;gap:7px;text-align:center;font-family:var(--g-font-fa);font-size:12px;line-height:1.7;color:var(--g-color-text-muted)}
.gz-auth .gz-code-status.is-checking{color:var(--g-color-brand-700)}
.gz-auth .gz-code-status.is-success{color:var(--g-color-state-success-fg,#187544);font-weight:750}
.gz-auth .gz-code-status.is-error{color:var(--g-color-state-danger-fg,#b3261e)}
.gz-auth .gz-status-dot{inline-size:7px;block-size:7px;border-radius:50%;background:currentColor;box-shadow:0 0 0 5px rgba(234,96,0,.10)}
.gz-auth .gz-code-actions{display:flex;align-items:center;justify-content:center;gap:8px;font-family:var(--g-font-fa);font-size:12px;color:var(--g-color-text-muted)}
.gz-auth .gz-link-btn{border:0;background:transparent;padding:7px 8px;border-radius:10px;font-family:var(--g-font-fa);font-size:12px;font-weight:750;color:var(--g-color-brand-700);cursor:pointer}
.gz-auth .gz-link-btn:hover{background:var(--g-color-brand-50)}
.gz-auth .gz-link-btn:disabled{color:var(--g-color-text-muted);cursor:default;background:transparent}
.gz-auth .gz-toast{position:absolute;z-index:3;inset-block-start:14px;inset-inline:14px;display:flex;align-items:center;justify-content:center;gap:8px;min-block-size:44px;padding:9px 12px;border:1px solid rgba(28,145,78,.18);border-radius:14px;background:rgba(239,250,243,.96);box-shadow:0 12px 35px rgba(24,80,47,.12);backdrop-filter:blur(10px);font-family:var(--g-font-fa);font-size:12px;font-weight:650;color:var(--g-color-state-success-fg,#187544)}
.gz-auth .gz-alert{display:flex;align-items:flex-start;gap:8px;padding:11px 12px;border-radius:13px;background:var(--g-color-state-danger-bg,#fdeceb);font-family:var(--g-font-fa);font-size:12px;line-height:1.7;color:var(--g-color-state-danger-fg,#b3261e)}
@media (max-width:390px){.gz-auth{border-radius:20px!important;padding:24px 19px!important}.gz-auth .gz-otp{gap:6px}.gz-auth .gz-otp-box{block-size:50px;border-radius:14px}}
@media (prefers-reduced-motion:reduce){.gz-auth *{scroll-behavior:auto!important;transition-duration:.01ms!important;animation-duration:.01ms!important;animation-iteration-count:1!important}}
`;

const headerTitleStyle = {
  fontFamily: 'var(--g-font-fa)',
  fontSize: 22,
  fontWeight: 900,
  letterSpacing: '-.025em',
  color: 'var(--g-color-text-primary)',
  margin: '15px 0 0',
};

const headerSubStyle = {
  fontFamily: 'var(--g-font-fa)',
  fontSize: 12.5,
  color: 'var(--g-color-text-secondary)',
  margin: '7px 0 0',
  lineHeight: 1.8,
  maxInlineSize: 310,
};

function formatCountdown(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return toFaDigits(`${minutes}:${String(remainder).padStart(2, '0')}`);
}

function OtpInput({ value, onChange, state, reducedMotion }) {
  const inputRef = useRef(null);
  const digits = value.padEnd(6, ' ').slice(0, 6).split('');
  const activeIndex = Math.min(value.length, 5);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <motion.div
      className={`gz-otp is-${state}`}
      onClick={() => inputRef.current?.focus()}
      initial={false}
      animate={state === 'error' && !reducedMotion ? { x: [0, -7, 7, -5, 5, 0] } : { x: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.34 }}
    >
      {digits.map((digit, index) => {
        const filled = Boolean(digit.trim());
        const isActive = state === 'idle' && index === activeIndex;
        return (
          <motion.div
            key={index}
            aria-hidden="true"
            className={`gz-otp-box ${filled ? 'is-filled' : ''} ${isActive ? 'is-active' : ''}`}
            initial={false}
            animate={state === 'success' && !reducedMotion
              ? { y: [0, -6, 0], scale: [1, 1.07, 1] }
              : filled && !reducedMotion
                ? { scale: [1, 1.045, 1] }
                : { y: 0, scale: 1 }}
            transition={{ duration: reducedMotion ? 0 : 0.3, delay: state === 'success' ? index * 0.045 : 0 }}
          >
            {state === 'success' ? <IconCheck size={21} stroke={2.6} /> : filled ? toFaDigits(digit) : ''}
          </motion.div>
        );
      })}
      <input
        ref={inputRef}
        className="gz-otp-input"
        dir="ltr"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        aria-label="کد ورود"
        aria-describedby="otp-status"
        aria-invalid={state === 'error'}
        disabled={state === 'checking' || state === 'success'}
        value={value}
        onChange={(event) => onChange(toLatin(event.target.value).replace(/\D/g, '').slice(0, 6))}
      />
    </motion.div>
  );
}
function errorMessage(error, fallback) {
  const raw = error?.response?.data?.message;
  const message = Array.isArray(raw) ? raw[0] : raw;
  if (message === 'otp_resend_cooldown') return 'کد قبلی هنوز معتبر است. کمی صبر کن و دوباره تلاش کن.';
  if (message === 'otp_daily_limit_reached') return 'سقف درخواست امروز پر شده است. بعداً دوباره تلاش کن.';
  if (message === 'sms_provider_disabled' || message === 'sms_provider_not_configured') return 'ارسال پیامک روی سرور فعال نیست. تنظیمات پنل پیامکی باید تکمیل شود.';
  if (/Too Many Requests|ThrottlerException/i.test(String(message))) return 'درخواست‌ها زیاد شده است. حدود یک دقیقه صبر کن.';
  if (/Internal server error/i.test(String(message))) return fallback;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

export default function AuthForm({ onSuccess, heading, sub, badge, icon: Icon = IconLeaf, accent = 'brand', footer }) {
  const { requestOtp, verifyOtp } = useAuth();
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [verificationState, setVerificationState] = useState('idle');
  const [otpTtlSeconds, setOtpTtlSeconds] = useState(120);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [lastRequestedPhone, setLastRequestedPhone] = useState('');
  const lastSubmittedCodeRef = useRef('');
  const clearCodeTimerRef = useRef(null);
  const requestInFlightRef = useRef(false);
  const verificationInFlightRef = useRef(false);
  const authFlowGenerationRef = useRef(0);
  const phoneValueRef = useRef('');
  const normalizedPhone = useMemo(() => normalizePhone(phone), [phone]);
  const otpValidityMinutes = Math.max(1, Math.ceil(otpTtlSeconds / 60));
  const googleEnabled = import.meta.env.VITE_GOOGLE_AUTH_ENABLED === 'true';
  const handleGoogleError = useCallback((googleError) => {
    setError(errorMessage(googleError, 'ورود با گوگل ناموفق بود. دوباره تلاش کن.'));
  }, []);
  const accentBg = accent === 'admin' ? 'var(--g-color-state-info-bg)' : 'var(--g-color-brand-50)';
  const accentFg = accent === 'admin' ? 'var(--g-color-text-secondary)' : 'var(--g-color-brand-600)';

  useEffect(() => () => window.clearTimeout(clearCodeTimerRef.current), []);

  useEffect(() => {
    if (!notice) return undefined;
    const id = window.setTimeout(() => setNotice(null), 3600);
    return () => window.clearTimeout(id);
  }, [notice]);

  useEffect(() => {
    if (resendSeconds <= 0) return undefined;
    const id = window.setInterval(() => setResendSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(id);
  }, [resendSeconds]);

  useEffect(() => {
    if (step !== 'code' || code) return undefined;
    if (typeof window === 'undefined' || !('OTPCredential' in window) || !navigator.credentials?.get) return undefined;
    const controller = new AbortController();
    const flowGeneration = authFlowGenerationRef.current;
    const expectedPhone = normalizedPhone;
    let active = true;
    navigator.credentials.get({ otp: { transport: ['sms'] }, signal: controller.signal })
      .then((credential) => {
        // AbortSignal support differs across WebOTP/browser implementations. A
        // credential settled for phone A must not repopulate the form after the
        // user moved to phone B, even if the provider ignores a late abort.
        if (
          !active
          || flowGeneration !== authFlowGenerationRef.current
          || normalizePhone(phoneValueRef.current) !== expectedPhone
        ) return;
        const nextCode = String(credential?.code || '').replace(/\D/g, '').slice(0, 6);
        if (nextCode) setCode(nextCode);
      })
      .catch(() => {});
    return () => {
      active = false;
      controller.abort();
    };
  }, [step, code, normalizedPhone]);

  const requestCode = async ({ force = false } = {}) => {
    // React state is not a same-frame mutex. The ref closes Enter+click/double-
    // click races before a second SMS request can leave the browser.
    if (requestInFlightRef.current || verificationInFlightRef.current) return;
    if (!PHONE_RE.test(normalizedPhone)) {
      setError('شماره موبایل را فقط با فرمت ۰۹ وارد کن؛ مثل ۰۹۱۲۳۴۵۶۷۸۹.');
      return;
    }
    if (resendSeconds > 0 && normalizedPhone === lastRequestedPhone) {
      setStep('code');
      setNotice('کد قبلی هنوز معتبر است؛ همان کد را وارد کن.');
      return;
    }
    if (!force && resendSeconds > 0 && step === 'code') return;
    const flowGeneration = authFlowGenerationRef.current;
    requestInFlightRef.current = true;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const response = await requestOtp(normalizedPhone);
      // The user may have corrected the phone while the network request was in
      // flight. Never open the code step or overwrite timing for the old phone.
      if (flowGeneration !== authFlowGenerationRef.current) return;
      setNotice(response?.message || 'کد ورود ارسال شد.');
      setLastRequestedPhone(normalizedPhone);
      setOtpTtlSeconds(safeSeconds(response?.ttlSeconds, 120));
      setResendSeconds(safeSeconds(response?.resendCooldownSeconds, 60));
      setStep('code');
      setVerificationState('idle');
    } catch (requestError) {
      if (flowGeneration === authFlowGenerationRef.current) {
        setError(errorMessage(requestError, 'ارسال کد ناموفق بود. اتصال سرور و تنظیمات پنل پیامکی را بررسی کن.'));
      }
    } finally {
      requestInFlightRef.current = false;
      setSubmitting(false);
    }
  };

  const verifyCode = useCallback(async (candidate) => {
    if (!/^\d{6}$/.test(candidate) || requestInFlightRef.current || verificationInFlightRef.current) return;
    const flowGeneration = authFlowGenerationRef.current;
    verificationInFlightRef.current = true;
    setSubmitting(true);
    setError(null);
    setVerificationState('checking');
    try {
      const nextUser = await verifyOtp(normalizedPhone, candidate, undefined);
      if (flowGeneration !== authFlowGenerationRef.current) return;
      setVerificationState('success');
      await delay(reducedMotion ? 80 : 720);
      if (flowGeneration !== authFlowGenerationRef.current) return;
      onSuccess?.(nextUser);
    } catch (verifyError) {
      if (flowGeneration !== authFlowGenerationRef.current) return;
      setVerificationState('error');
      setError(errorMessage(verifyError, 'کد درست نیست یا زمان آن تمام شده است. دوباره واردش کن.'));
      clearCodeTimerRef.current = window.setTimeout(() => {
        if (flowGeneration !== authFlowGenerationRef.current) return;
        setCode('');
        setVerificationState('idle');
        lastSubmittedCodeRef.current = '';
      }, reducedMotion ? 40 : 520);
    } finally {
      verificationInFlightRef.current = false;
      if (flowGeneration === authFlowGenerationRef.current) setSubmitting(false);
    }
  }, [normalizedPhone, onSuccess, reducedMotion, verifyOtp]);

  useEffect(() => {
    if (step !== 'code' || code.length !== 6 || submitting || lastSubmittedCodeRef.current === code) return;
    lastSubmittedCodeRef.current = code;
    void verifyCode(code);
  }, [code, step, submitting, verifyCode]);

  const handleCodeChange = (nextCode) => {
    if (verificationState !== 'idle') return;
    setError(null);
    setCode(nextCode);
    if (nextCode.length < 6) lastSubmittedCodeRef.current = '';
  };

  const resetPhone = () => {
    if (requestInFlightRef.current || verificationInFlightRef.current) return;
    authFlowGenerationRef.current += 1;
    window.clearTimeout(clearCodeTimerRef.current);
    setStep('phone');
    setCode('');
    setNotice(null);
    setError(null);
    setVerificationState('idle');
    lastSubmittedCodeRef.current = '';
  };

  const statusContent = verificationState === 'checking'
    ? <><motion.span className="gz-status-dot" animate={reducedMotion ? {} : { opacity: [0.35, 1, 0.35] }} transition={{ duration: 1, repeat: Infinity }} />در حال بررسی کد…</>
    : verificationState === 'success'
      ? <><IconShieldCheck size={17} stroke={2.2} aria-hidden="true" />کد تأیید شد؛ در حال ورود…</>
      : verificationState === 'error'
        ? <><IconAlertTriangle size={16} stroke={2} aria-hidden="true" />کد پذیرفته نشد</>
        : `کد تا ${toFaDigits(otpValidityMinutes)} دقیقه معتبر است و با رقم ششم خودکار بررسی می‌شود.`;

  return (
    <motion.div
      className="gz-auth"
      initial={reducedMotion ? false : { opacity: 0, y: 12, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: reducedMotion ? 0 : 0.42, ease: [0.16, 1, 0.3, 1] }}
      style={{
        inlineSize: '100%',
        maxInlineSize: 388,
        background: 'var(--g-color-bg-surface)',
        border: '1px solid var(--g-color-border-subtle)',
        borderRadius: 24,
        padding: '28px 26px',
        boxShadow: '0 24px 70px rgba(43,32,15,.10),0 4px 16px rgba(43,32,15,.04)',
      }}
    >
      <style>{CSS}</style>

      <AnimatePresence>
        {notice ? (
          <motion.div
            className="gz-toast"
            role="status"
            initial={reducedMotion ? false : { opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: reducedMotion ? 0 : 0.24 }}
          >
            <IconShieldCheck size={17} stroke={2.1} aria-hidden="true" />
            <span>{notice}</span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false} mode="wait">
        {step === 'phone' ? (
          <motion.div
            key="phone-step"
            initial={reducedMotion ? false : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -12 }}
            transition={{ duration: reducedMotion ? 0 : 0.24 }}
          >
            <Box className="gz-header" style={{ marginBlockEnd: 25 }}>
              <Box className="gz-brand-mark" aria-hidden="true" style={{ background: accentBg, color: accentFg }}>
                <Icon size={29} stroke={1.7} />
              </Box>
              {badge ? <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 11, fontWeight: 750, color: accentFg, background: accentBg, padding: '3px 9px', borderRadius: 9, marginBlockStart: 10 }}>{badge}</Text> : null}
              <Text component="h1" style={headerTitleStyle}>{heading || 'ورود به گارنیش'}</Text>
              <Text component="p" style={headerSubStyle}>{sub || 'شماره موبایلت را وارد کن؛ رمز عبور لازم نیست.'}</Text>
            </Box>

            <Box style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Box>
                <Text component="label" htmlFor="auth-phone" className="gz-field-label">شماره موبایل</Text>
                <Box className="gz-phone-field">
                  <input
                    id="auth-phone"
                    dir="ltr"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    autoFocus
                    placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                    aria-invalid={Boolean(error)}
                    value={phone}
                    onChange={(event) => {
                      const nextPhone = toLatin(event.target.value).replace(/[^\d\s\-()]/g, '').slice(0, 14);
                      if (nextPhone !== phoneValueRef.current) {
                        phoneValueRef.current = nextPhone;
                        authFlowGenerationRef.current += 1;
                      }
                      setError(null);
                      setPhone(nextPhone);
                    }}
                    onKeyDown={(event) => { if (event.key === 'Enter' && !submitting) void requestCode(); }}
                    style={{ textAlign: 'left' }}
                  />
                </Box>
              </Box>

              <AnimatePresence>
                {error ? (
                  <motion.div className="gz-alert" role="alert" initial={reducedMotion ? false : { opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={reducedMotion ? undefined : { opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.18 }}>
                    <IconAlertTriangle size={16} stroke={1.9} aria-hidden="true" style={{ flexShrink: 0, marginBlockStart: 2 }} />
                    <span>{error}</span>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <motion.button
                type="button"
                className="gz-primary"
                onClick={() => void requestCode()}
                disabled={submitting}
                whileHover={submitting || reducedMotion ? {} : { y: -1 }}
                whileTap={submitting || reducedMotion ? {} : { scale: 0.985 }}
              >
                {submitting ? 'در حال ارسال…' : 'دریافت کد ورود'}
              </motion.button>

              {googleEnabled ? (
                <>
                  <Box className="gz-divider">یا</Box>
                  <GoogleSignInButton
                    onSuccess={onSuccess}
                    onError={handleGoogleError}
                  />
                </>
              ) : null}

              <Box className="gz-trust">
                <IconShieldCheck size={14} stroke={1.9} aria-hidden="true" />
                <span>ورود امن و بدون رمز عبور</span>
              </Box>
              {footer}
            </Box>
          </motion.div>
        ) : (
          <motion.div
            key="code-step"
            initial={reducedMotion ? false : { opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 12 }}
            transition={{ duration: reducedMotion ? 0 : 0.24 }}
          >
            <Box className="gz-header" style={{ marginBlockEnd: 27, paddingBlockStart: notice ? 45 : 0 }}>
              <Box className="gz-brand-mark" aria-hidden="true" style={{ background: accentBg, color: accentFg }}>
                <IconShieldCheck size={28} stroke={1.8} />
              </Box>
              <Text component="h1" style={headerTitleStyle}>کد تأیید را وارد کن</Text>
              <Text component="p" style={headerSubStyle}>کد ۶ رقمی ارسال‌شده به این شماره</Text>
              <Box className="gz-phone-summary">
                <Text component="span" className="gz-phone-number">{toFaDigits(normalizedPhone)}</Text>
                <UnstyledButton type="button" className="gz-edit-phone" onClick={resetPhone} disabled={submitting} aria-label="تغییر شماره">
                  <IconPencil size={14} stroke={2} aria-hidden="true" />
                </UnstyledButton>
              </Box>
            </Box>

            <Box style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <OtpInput value={code} onChange={handleCodeChange} state={verificationState} reducedMotion={reducedMotion} />

              <Box id="otp-status" className={`gz-code-status is-${verificationState}`} aria-live="polite">
                {statusContent}
              </Box>

              <AnimatePresence>
                {error ? (
                  <motion.div className="gz-alert" role="alert" initial={reducedMotion ? false : { opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={reducedMotion ? undefined : { opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.18 }}>
                    <IconAlertTriangle size={16} stroke={1.9} aria-hidden="true" style={{ flexShrink: 0, marginBlockStart: 2 }} />
                    <span>{error}</span>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <Box className="gz-code-actions">
                {resendSeconds > 0 ? (
                  <span>ارسال دوباره در {formatCountdown(resendSeconds)}</span>
                ) : (
                  <UnstyledButton
                    type="button"
                    className="gz-link-btn"
                    disabled={submitting}
                    onClick={() => void requestCode({ force: true })}
                  >
                    ارسال دوباره کد
                  </UnstyledButton>
                )}
              </Box>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
