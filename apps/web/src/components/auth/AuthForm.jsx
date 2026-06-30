// Shared auth form — clean, minimal, dynamic login/signup (phone + password). Used by /login AND the /admin
// gate. Filled borderless fields (no box-in-box), focus ring, centered SVG eye toggle, animated checkbox,
// framer-motion entrance + button press. Token-pure, RTL, Vazirmatn. Calls AuthContext.login/register.
import { useState } from 'react';
import { Box, Text, UnstyledButton } from '@mantine/core';
import { motion, AnimatePresence } from 'framer-motion';
import { IconLeaf, IconEye, IconEyeOff, IconAlertTriangle, IconCheck } from '@tabler/icons-react';
import { useAuth } from '../../context/AuthContext';

const FA = '۰۱۲۳۴۵۶۷۸۹';
const toLatin = (s) => String(s ?? '').replace(/[۰-۹]/g, (d) => FA.indexOf(d));
const PHONE_RE = /^09\d{9}$/;
const normalizePhone = (s) => {
  let d = toLatin(s).replace(/[\s\-()]/g, '');
  if (d.startsWith('+98')) d = '0' + d.slice(3);
  else if (d.startsWith('0098')) d = '0' + d.slice(4);
  else if (d.startsWith('98') && d.length === 12) d = '0' + d.slice(2);
  return d;
};

// Scoped CSS for the states inline styles can't express: focus-within ring, placeholder + autofill colour,
// eye hover. Token-driven so it follows the Garnish theme. Idempotent (only one AuthForm mounts at a time).
const CSS = `
.gz-auth .gz-fld{display:flex;align-items:center;gap:8px;block-size:50px;padding-inline:15px;background:var(--g-color-bg-canvas);border:1.5px solid transparent;border-radius:13px;transition:background .18s ease,border-color .18s ease,box-shadow .18s ease}
.gz-auth .gz-fld:focus-within{background:var(--g-color-bg-surface);border-color:var(--g-color-brand-600);box-shadow:0 0 0 3.5px var(--g-color-brand-100)}
.gz-auth .gz-fld input{flex:1;min-inline-size:0;border:none;outline:none;background:transparent;font-family:var(--g-font-fa);font-size:14.5px;color:var(--g-color-text-primary)}
.gz-auth .gz-fld input::placeholder{color:var(--g-color-text-muted);opacity:1}
.gz-auth .gz-fld input:-webkit-autofill{-webkit-box-shadow:0 0 0 1000px var(--g-color-bg-canvas) inset;box-shadow:0 0 0 1000px var(--g-color-bg-canvas) inset;-webkit-text-fill-color:var(--g-color-text-primary)}
.gz-auth .gz-fld:focus-within input:-webkit-autofill{-webkit-box-shadow:0 0 0 1000px var(--g-color-bg-surface) inset;box-shadow:0 0 0 1000px var(--g-color-bg-surface) inset}
.gz-auth .gz-eye{inline-size:28px;block-size:28px;flex-shrink:0;display:grid;place-items:center;border:none;background:transparent;color:var(--g-color-text-muted);border-radius:8px;cursor:pointer;transition:color .15s ease}
.gz-auth .gz-eye:hover{color:var(--g-color-brand-600)}
`;

const lblStyle = { display: 'block', fontFamily: 'var(--g-font-fa)', fontSize: '12px', fontWeight: 500, color: 'var(--g-color-text-secondary)', marginBlockEnd: 6, paddingInlineStart: 3 };
const hintStyle = { fontFamily: 'var(--g-font-fa)', fontSize: '11px', color: 'var(--g-color-text-muted)', margin: '5px 3px 0' };

function Field({ label, hint, children }) {
  return (
    <Box>
      <Text component="label" style={lblStyle}>{label}</Text>
      <Box className="gz-fld">{children}</Box>
      {hint ? <Text component="p" style={hintStyle}>{hint}</Text> : null}
    </Box>
  );
}

export default function AuthForm({ initialMode = 'login', allowSignup = true, onSuccess, heading, sub, badge, icon: Icon = IconLeaf, accent = 'brand', footer }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [consent, setConsent] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const isSignup = mode === 'signup';
  const accentBg = accent === 'admin' ? 'var(--g-color-state-info-bg)' : 'var(--g-color-brand-50)';
  const accentFg = accent === 'admin' ? 'var(--g-color-text-secondary)' : 'var(--g-color-brand-600)';

  const submit = async () => {
    if (submitting) return;
    setError(null);
    const ph = normalizePhone(phone);
    if (!PHONE_RE.test(ph)) { setError('شمارهٔ موبایل را کامل و درست وارد کن — مثل ۰۹۱۲۳۴۵۶۷۸۹.'); return; }
    if (isSignup && password.length < 6) { setError('برای امنیت، رمز باید حداقل ۶ کاراکتر باشد.'); return; }
    if (!isSignup && !password) { setError('رمزت را وارد کن.'); return; }
    if (isSignup && !consent) { setError('برای ساختِ حساب، با شرایط و حریم خصوصی موافقت کن.'); return; }
    setSubmitting(true);
    try {
      if (isSignup) await register(ph, password, name.trim() || undefined);
      else await login(ph, password);
      onSuccess?.();
    } catch (e) {
      const m = e?.response?.data?.message;
      setError(Array.isArray(m) && m.length ? m[0] : (typeof m === 'string' && m.trim() ? m : (isSignup ? 'ثبت‌نام ناموفق بود. دوباره تلاش کن.' : 'ورود ناموفق — شماره یا رمز درست نیست.')));
      setSubmitting(false);
    }
  };
  const onKey = (e) => { if (e.key === 'Enter') submit(); };

  return (
    <motion.div
      className="gz-auth"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{ inlineSize: '100%', maxInlineSize: 360, background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: '22px', padding: '28px 24px', boxShadow: 'var(--g-shadow-2, 0 12px 36px rgba(60,50,30,0.07))' }}
    >
      <style>{CSS}</style>

      <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBlockEnd: 22 }}>
        <Box aria-hidden="true" style={{ inlineSize: 54, blockSize: 54, borderRadius: '16px', background: accentBg, color: accentFg, display: 'grid', placeItems: 'center' }}><Icon size={28} stroke={1.7} /></Box>
        {badge ? <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11px', fontWeight: 500, color: accentFg, background: accentBg, paddingInline: 9, paddingBlock: 3, borderRadius: '7px', marginBlockStart: 11 }}>{badge}</Text> : null}
        <Text component="h1" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '20px', fontWeight: 700, color: 'var(--g-color-text-primary)', margin: '13px 0 0' }}>{heading || (isSignup ? 'ساختِ حساب' : 'ورود')}</Text>
        {sub ? <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '12.5px', color: 'var(--g-color-text-secondary)', margin: '5px 0 0', lineHeight: 1.6 }}>{sub}</Text> : null}
      </Box>

      <Box style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <AnimatePresence initial={false} mode="popLayout">
          {isSignup ? (
            <motion.div key="name" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }} style={{ overflow: 'hidden' }}>
              <Field label={<>نام <Text component="span" style={{ color: 'var(--g-color-text-muted)', fontWeight: 400 }}>(اختیاری)</Text></>}>
                <input type="text" autoComplete="name" placeholder="نام" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onKey} />
              </Field>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <Field label="موبایل" hint="مثل ۰۹۱۲۳۴۵۶۷۸۹">
          <input dir="ltr" type="tel" inputMode="numeric" autoComplete="tel" placeholder="۰۹..." value={phone} onChange={(e) => setPhone(e.target.value)} onKeyDown={onKey} style={{ textAlign: 'start' }} />
        </Field>

        <Field label="گذرواژه" hint={isSignup ? 'حداقل ۶ کاراکتر' : undefined}>
          <input type={showPass ? 'text' : 'password'} autoComplete={isSignup ? 'new-password' : 'current-password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={onKey} />
          <UnstyledButton type="button" className="gz-eye" onClick={() => setShowPass((s) => !s)} aria-label={showPass ? 'پنهان کردن گذرواژه' : 'نمایش گذرواژه'}>
            {showPass ? <IconEyeOff size={18} stroke={1.8} /> : <IconEye size={18} stroke={1.8} />}
          </UnstyledButton>
        </Field>

        <AnimatePresence initial={false}>
          {isSignup ? (
            <motion.div key="consent" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 9, inlineSize: '100%', cursor: 'pointer', paddingBlock: 4, textAlign: 'start' }}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
                <Box aria-hidden="true" style={{ inlineSize: 19, blockSize: 19, flexShrink: 0, borderRadius: '6px', display: 'grid', placeItems: 'center', border: `1.5px solid ${consent ? 'var(--g-color-brand-600)' : 'var(--g-color-border-strong)'}`, background: consent ? 'var(--g-color-brand-600)' : 'transparent', transition: 'background .16s ease, border-color .16s ease' }}>
                  <AnimatePresence>{consent ? <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 520, damping: 22 }} style={{ display: 'grid', placeItems: 'center' }}><IconCheck size={13} stroke={2.6} style={{ color: 'var(--g-color-text-inverse)' }} /></motion.span> : null}</AnimatePresence>
                </Box>
                <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11.5px', lineHeight: 1.6, color: 'var(--g-color-text-secondary)' }}>
                  با <a href="/terms" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--g-color-brand-700)', fontWeight: 500 }}>شرایط استفاده</a> و <a href="/privacy" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--g-color-brand-700)', fontWeight: 500 }}>حریم خصوصی</a> موافقم
                </Text>
              </label>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {error ? (
            <motion.div key="err" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: 11, borderRadius: '11px', background: 'var(--g-color-state-danger-bg, #fdeceb)' }}>
              <IconAlertTriangle size={15} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-state-danger-fg, #b3261e)', flexShrink: 0, marginBlockStart: 1 }} />
              <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '12px', lineHeight: 1.6, color: 'var(--g-color-state-danger-fg, #b3261e)' }}>{error}</Text>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <motion.button
          type="button"
          onClick={submit}
          disabled={submitting}
          whileHover={submitting ? {} : { filter: 'brightness(0.96)' }}
          whileTap={submitting ? {} : { scale: 0.985 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', inlineSize: '100%', minBlockSize: 50, marginBlockStart: 4, border: 'none', borderRadius: '13px', background: submitting ? 'var(--g-color-border-strong)' : 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: '15px', fontWeight: 600, cursor: submitting ? 'default' : 'pointer', boxShadow: submitting ? 'none' : 'var(--g-shadow-1, 0 4px 14px rgba(0,0,0,0.08))' }}
        >
          {submitting ? 'لطفاً صبر کن…' : isSignup ? 'ثبت‌نام و شروع' : 'ورود'}
        </motion.button>

        {allowSignup ? (
          <UnstyledButton type="button" onClick={() => { setError(null); setMode((mm) => (mm === 'signup' ? 'login' : 'signup')); }} style={{ inlineSize: '100%', paddingBlock: 6, fontFamily: 'var(--g-font-fa)', fontSize: '13px', fontWeight: 500, color: 'var(--g-color-text-secondary)', textAlign: 'center' }}>
            {isSignup ? <>حساب داری؟ <Text component="span" style={{ color: 'var(--g-color-brand-700)', fontWeight: 600 }}>ورود</Text></> : <>حساب نداری؟ <Text component="span" style={{ color: 'var(--g-color-brand-700)', fontWeight: 600 }}>ثبت‌نام</Text></>}
          </UnstyledButton>
        ) : null}
        {footer}
      </Box>
    </motion.div>
  );
}
