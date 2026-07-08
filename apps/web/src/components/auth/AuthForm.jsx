// Shared auth form - single passwordless phone OTP entry for /login.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, UnstyledButton } from '@mantine/core';
import { motion, AnimatePresence } from 'framer-motion';
import { IconAlertTriangle, IconLeaf, IconShieldCheck, IconSparkles } from '@tabler/icons-react';
import { useAuth } from '../../context/AuthContext';
import GoogleSignInButton from './GoogleSignInButton';

const FA = '۰۱۲۳۴۵۶۷۸۹';
const toLatin = (s) => String(s ?? '').replace(/[۰-۹]/g, (d) => String(FA.indexOf(d)));
const toFaDigits = (s) => String(s ?? '').replace(/\d/g, (d) => FA[Number(d)]);
const PHONE_RE = /^09\d{9}$/;
const normalizePhone = (s) => toLatin(s).replace(/[\s\-()]/g, '');
const safeSeconds = (value, fallback) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : fallback;
};
const otpValidityCopy = (ttlSeconds) => {
  const minutes = Math.max(1, Math.round(safeSeconds(ttlSeconds, 120) / 60));
  return `کد تا ${toFaDigits(minutes)} دقیقه معتبر است.`;
};

const CSS = `
.gz-auth *{box-sizing:border-box}
.gz-auth .gz-fld{display:flex;align-items:center;gap:8px;block-size:50px;padding-inline:15px;background:var(--g-color-bg-canvas);border:1px solid transparent;border-radius:15px;transition:background .18s ease,border-color .18s ease,box-shadow .18s ease,transform .18s ease}
.gz-auth .gz-fld:focus-within{background:var(--g-color-bg-surface);border-color:rgba(234,96,0,.55);box-shadow:0 0 0 4px rgba(234,96,0,.10);transform:translateY(-1px)}
.gz-auth input{border:0!important;outline:0!important;box-shadow:none!important}
.gz-auth input:focus,.gz-auth input:focus-visible{border:0!important;outline:0!important;box-shadow:none!important}
.gz-auth .gz-fld input{flex:1;min-inline-size:0;background:transparent;font-family:var(--g-font-fa);font-size:14.5px;color:var(--g-color-text-primary)}
.gz-auth .gz-fld input::placeholder{color:var(--g-color-text-muted);opacity:1}
.gz-auth .gz-fld input:-webkit-autofill{-webkit-box-shadow:0 0 0 1000px var(--g-color-bg-canvas) inset!important;box-shadow:0 0 0 1000px var(--g-color-bg-canvas) inset!important;-webkit-text-fill-color:var(--g-color-text-primary)}
.gz-auth .gz-fld:focus-within input:-webkit-autofill{-webkit-box-shadow:0 0 0 1000px var(--g-color-bg-surface) inset!important;box-shadow:0 0 0 1000px var(--g-color-bg-surface) inset!important}
.gz-auth .gz-otp{position:relative;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;direction:ltr}
.gz-auth .gz-otp-box{block-size:48px;border-radius:14px;border:1px solid var(--g-color-border-subtle);background:var(--g-color-bg-canvas);display:grid;place-items:center;font-family:var(--g-font-fa);font-size:19px;font-weight:800;color:var(--g-color-text-primary);transition:border-color .16s ease,box-shadow .16s ease,background .16s ease,transform .16s ease}
.gz-auth .gz-otp-box.is-filled{background:var(--g-color-bg-surface);border-color:rgba(234,96,0,.36);box-shadow:0 8px 22px rgba(234,96,0,.08)}
.gz-auth .gz-otp-box.is-active{border-color:var(--g-color-brand-600);box-shadow:0 0 0 4px rgba(234,96,0,.12);transform:translateY(-1px)}
.gz-auth .gz-otp-input{position:absolute;inset:0;inline-size:100%;block-size:100%;opacity:.01;color:transparent;background:transparent;caret-color:transparent}
.gz-auth .gz-secondary-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.gz-auth .gz-soft-btn{min-block-size:42px;border-radius:13px;border:1px solid var(--g-color-border-subtle);background:var(--g-color-bg-surface);font-family:var(--g-font-fa);font-size:12.2px;font-weight:600;color:var(--g-color-text-secondary);display:grid;place-items:center;text-align:center;transition:background .16s ease,border-color .16s ease,color .16s ease,transform .16s ease}
.gz-auth .gz-soft-btn:not(:disabled):hover{background:var(--g-color-brand-50);border-color:rgba(234,96,0,.28);color:var(--g-color-brand-700);transform:translateY(-1px)}
.gz-auth .gz-soft-btn:disabled{opacity:.48;cursor:not-allowed}
.gz-auth .gz-divider{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;color:var(--g-color-text-muted);font-family:var(--g-font-fa);font-size:11px}
.gz-auth .gz-divider:before,.gz-auth .gz-divider:after{content:"";block-size:1px;background:var(--g-color-border-subtle)}
`;

const lblStyle = { display: 'block', fontFamily: 'var(--g-font-fa)', fontSize: '12px', fontWeight: 700, color: 'var(--g-color-text-secondary)', marginBlockEnd: 7, paddingInlineStart: 3 };
const hintStyle = { fontFamily: 'var(--g-font-fa)', fontSize: '11px', color: 'var(--g-color-text-muted)', margin: '6px 3px 0', lineHeight: 1.7 };

function Field({ label, hint, children }) {
  return (
    <Box>
      <Text component="label" style={lblStyle}>{label}</Text>
      <Box className="gz-fld">{children}</Box>
      {hint ? <Text component="p" style={hintStyle}>{hint}</Text> : null}
    </Box>
  );
}

function OtpInput({ value, onChange, onSubmit, ttlSeconds }) {
  const inputRef = useRef(null);
  const digits = value.padEnd(6, ' ').slice(0, 6).split('');
  const activeIndex = Math.min(value.length, 5);
  return (
    <Box>
      <Text component="label" style={lblStyle}>کد ورود</Text>
      <Box className="gz-otp" onClick={() => inputRef.current?.focus()}>
        {digits.map((digit, index) => (
          <motion.div
            key={index}
            className={`gz-otp-box ${digit.trim() ? 'is-filled' : ''} ${index === activeIndex ? 'is-active' : ''}`}
            initial={false}
            animate={digit.trim() ? { scale: [1, 1.04, 1] } : { scale: 1 }}
            transition={{ duration: 0.18 }}
          >
            {digit.trim() ? toFaDigits(digit) : ''}
          </motion.div>
        ))}
        <input
          ref={inputRef}
          className="gz-otp-input"
          dir="ltr"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label="کد ورود"
          value={value}
          onChange={(e) => onChange(toLatin(e.target.value).replace(/\D/g, '').slice(0, 6))}
          onKeyDown={(e) => { if (e.key === 'Enter') onSubmit?.(); }}
        />
      </Box>
      <Text component="p" style={hintStyle}>{otpValidityCopy(ttlSeconds)}</Text>
    </Box>
  );
}

function errorMessage(error, fallback) {
  const raw = error?.response?.data?.message;
  const msg = Array.isArray(raw) ? raw[0] : raw;
  if (msg === 'otp_resend_cooldown') return 'کد قبلی هنوز معتبر است. کمی صبر کن و دوباره تلاش کن.';
  if (msg === 'otp_daily_limit_reached') return 'برای امروز بیش از حد کد درخواست شده است. بعداً دوباره تلاش کن.';
  if (msg === 'sms_provider_disabled' || msg === 'sms_provider_not_configured') return 'ارسال پیامک هنوز در سرور فعال نشده است. تنظیمات ملی‌پیامک را کامل کن و دوباره تلاش کن.';
  if (/Too Many Requests|ThrottlerException/i.test(String(msg))) return 'درخواست‌ها زیاد شد. حدود یک دقیقه صبر کن و دوباره تلاش کن.';
  if (/Internal server error/i.test(String(msg))) return fallback;
  return typeof msg === 'string' && msg.trim() ? msg : fallback;
}

export default function AuthForm({ onSuccess, heading, sub, badge, icon: Icon = IconLeaf, accent = 'brand', footer }) {
  const { requestOtp, verifyOtp } = useAuth();
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [notice, setNotice] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [otpTtlSeconds, setOtpTtlSeconds] = useState(120);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [lastRequestedPhone, setLastRequestedPhone] = useState('');
  const normalizedPhone = useMemo(() => normalizePhone(phone), [phone]);
  const googleEnabled = import.meta.env.VITE_GOOGLE_AUTH_ENABLED === 'true';
  const accentBg = accent === 'admin' ? 'var(--g-color-state-info-bg)' : 'var(--g-color-brand-50)';
  const accentFg = accent === 'admin' ? 'var(--g-color-text-secondary)' : 'var(--g-color-brand-600)';

  useEffect(() => {
    if (resendSeconds <= 0) return undefined;
    const id = window.setInterval(() => setResendSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [resendSeconds]);

  useEffect(() => {
    if (step !== 'code' || code) return undefined;
    if (typeof window === 'undefined' || !('OTPCredential' in window) || !navigator.credentials?.get) return undefined;
    const controller = new AbortController();
    navigator.credentials.get({ otp: { transport: ['sms'] }, signal: controller.signal })
      .then((credential) => {
        const nextCode = String(credential?.code || '').replace(/\D/g, '').slice(0, 6);
        if (nextCode) setCode(nextCode);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [step, code]);

  const requestCode = async ({ force = false } = {}) => {
    if (!PHONE_RE.test(normalizedPhone)) {
      setError('شماره موبایل را فقط با فرمت ۰۹ وارد کن؛ مثل ۰۹۱۲۳۴۵۶۷۸۹.');
      return;
    }
    if (resendSeconds > 0 && normalizedPhone === lastRequestedPhone) {
      setStep('code');
      setNotice('کد قبلی هنوز معتبر است. برای ارسال دوباره، تایمر باید تمام شود.');
      return;
    }
    if (!force && resendSeconds > 0 && step === 'code') return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await requestOtp(normalizedPhone);
      setNotice(res?.message || 'کد ورود برای شما ارسال شد.');
      setLastRequestedPhone(normalizedPhone);
      setOtpTtlSeconds(safeSeconds(res?.ttlSeconds, 120));
      setResendSeconds(safeSeconds(res?.resendCooldownSeconds, 60));
      setStep('code');
    } catch (e) {
      setError(errorMessage(e, 'ارسال کد ورود ناموفق بود. اگر پیامک فعال است، تنظیمات ملی‌پیامک یا اتصال سرور را چک کن.'));
    } finally {
      setSubmitting(false);
    }
  };

  const verifyCode = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError('کد ورود باید ۶ رقم باشد.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const nextUser = await verifyOtp(normalizedPhone, code, name.trim() || undefined);
      onSuccess?.(nextUser);
    } catch (e) {
      setError(errorMessage(e, 'کد ورود معتبر نیست یا منقضی شده است.'));
    } finally {
      setSubmitting(false);
    }
  };

  const submit = () => {
    if (submitting) return;
    if (step === 'phone') requestCode();
    else verifyCode();
  };

  const resetPhone = () => {
    setStep('phone');
    setCode('');
    setName('');
    setNotice(null);
    setError(null);
  };

  return (
    <motion.div
      className="gz-auth"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{ inlineSize: '100%', maxInlineSize: 360, background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 22, padding: '26px 24px', boxShadow: '0 14px 34px rgba(31,24,10,.075)' }}
    >
      <style>{CSS}</style>

      <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBlockEnd: 22 }}>
        <Box aria-hidden="true" style={{ inlineSize: 52, blockSize: 52, borderRadius: 17, background: accentBg, color: accentFg, display: 'grid', placeItems: 'center', boxShadow: '0 8px 18px rgba(234,96,0,.08)' }}><Icon size={28} stroke={1.7} /></Box>
        {badge ? <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 11, fontWeight: 700, color: accentFg, background: accentBg, paddingInline: 9, paddingBlock: 3, borderRadius: 8, marginBlockStart: 11 }}>{badge}</Text> : null}
        <Text component="h1" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 21, fontWeight: 850, color: 'var(--g-color-text-primary)', margin: '14px 0 0' }}>{heading || 'ورود به گارنیش'}</Text>
        <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 12.3, color: 'var(--g-color-text-secondary)', margin: '6px 0 0', lineHeight: 1.75 }}>
          {sub || 'ورود امن و بی‌رمز، فقط با کد پیامکی.'}
        </Text>
      </Box>

      <Box style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
        <Field label="موبایل" hint="مثل ۰۹۱۲۳۴۵۶۷۸۹">
          <input dir="ltr" type="tel" inputMode="numeric" autoComplete="tel" placeholder="۰۹..." value={phone} disabled={step === 'code'} onChange={(e) => setPhone(toLatin(e.target.value).replace(/[^\d\s\-()]/g, '').slice(0, 14))} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} style={{ textAlign: 'start' }} />
        </Field>

        <AnimatePresence initial={false} mode="popLayout">
          {step === 'code' ? (
            <motion.div key="otp-fields" initial={{ opacity: 0, y: -8, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: -6, height: 0 }} transition={{ duration: 0.24 }} style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 15 }}>
              <OtpInput value={code} onChange={setCode} onSubmit={verifyCode} ttlSeconds={otpTtlSeconds} />
              <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 11.2, lineHeight: 1.75, color: 'var(--g-color-text-muted)', margin: '-6px 3px 0', textAlign: 'center' }}>
                اگر پیامک نیامد، پوشه هرزنامه یا Spam را هم چک کن.
              </Text>
              <Field label={<>نام <Text component="span" style={{ color: 'var(--g-color-text-muted)', fontWeight: 500 }}>(اختیاری)</Text></>} hint="اگر شماره جدید باشد، حساب با همین نام ساخته می‌شود.">
                <input type="text" autoComplete="name" placeholder="نام" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
              </Field>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {notice ? (
            <motion.div key="notice" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="status" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 13px', borderRadius: 13, background: 'var(--g-color-state-success-bg, #eaf7ef)' }}>
              <IconShieldCheck size={16} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-state-success-fg, #1b7f45)', flexShrink: 0, marginBlockStart: 1 }} />
              <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 12.5, lineHeight: 1.7, color: 'var(--g-color-state-success-fg, #1b7f45)' }}>{notice}</Text>
            </motion.div>
          ) : null}
          {error ? (
            <motion.div key="err" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 13px', borderRadius: 13, background: 'var(--g-color-state-danger-bg, #fdeceb)' }}>
              <IconAlertTriangle size={16} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-state-danger-fg, #b3261e)', flexShrink: 0, marginBlockStart: 1 }} />
              <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 12.5, lineHeight: 1.7, color: 'var(--g-color-state-danger-fg, #b3261e)' }}>{error}</Text>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <motion.button
          type="button"
          onClick={submit}
          disabled={submitting}
          whileHover={submitting ? {} : { y: -1, filter: 'brightness(0.98)' }}
          whileTap={submitting ? {} : { scale: 0.985 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', inlineSize: '100%', minBlockSize: 52, marginBlockStart: 3, border: 'none', borderRadius: 15, background: submitting ? 'var(--g-color-border-strong)' : 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 15.5, fontWeight: 850, cursor: submitting ? 'default' : 'pointer', boxShadow: submitting ? 'none' : '0 14px 28px rgba(234,96,0,.24)' }}
        >
          {submitting ? 'لطفاً صبر کن…' : step === 'phone' ? 'ارسال کد ورود' : 'ورود / ساخت حساب'}
        </motion.button>

        {step === 'code' ? (
          <Box className="gz-secondary-actions">
            <UnstyledButton type="button" className="gz-soft-btn" onClick={resetPhone}>
              تغییر شماره
            </UnstyledButton>
            <UnstyledButton type="button" className="gz-soft-btn" disabled={submitting || resendSeconds > 0} onClick={() => requestCode({ force: true })}>
              {resendSeconds > 0 ? `ارسال دوباره · ${toFaDigits(resendSeconds)} ثانیه` : 'ارسال دوباره'}
            </UnstyledButton>
          </Box>
        ) : null}

        {googleEnabled ? (
          <>
            <Box className="gz-divider">یا</Box>
            <GoogleSignInButton
              onSuccess={onSuccess}
              onError={(e) => setError(errorMessage(e, 'ورود با گوگل ناموفق بود. دوباره تلاش کن.'))}
            />
          </>
        ) : null}

        <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--g-color-text-muted)', paddingBlockStart: 2 }}>
          <IconSparkles size={14} stroke={1.8} aria-hidden="true" />
          <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 11.5 }}>بدون رمز عبور؛ ورود فقط با کد پیامکی</Text>
        </Box>
        {footer}
      </Box>
    </motion.div>
  );
}
