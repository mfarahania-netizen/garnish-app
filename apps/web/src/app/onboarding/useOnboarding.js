import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../lib/apiClient';
import { useAuth, ONBOARDED_KEY } from '../../context/AuthContext';
import { deriveTraits, DISLIKE_OPTIONS } from './steps';

/**
 * useOnboarding — the first-run flow's state machine + honest persistence.
 *
 * REBUILT to the ONBOARDING_V1 research design: the front door is minimal. ONE required safety screen (allergy,
 * EU-14), then ONE tight "taste & time" screen (diet + workday cooking-time + dislikes — the levers that make the
 * recommendation engine precise from the first slate), then straight into the app. The lower-value declared bits
 * (skill, budget, goals, household, servings) are NOT asked up front — they're earned progressively in-app. Every
 * signal we DO collect is wired to a real engine consumer (verified): allergy → HARD safety gate (UserAllergy);
 * diet → candidate pool; cooking-time → assessRecipeFit (quicker first slate); dislikes → the assistant.
 *
 * The account step is LAST and only with the user's consent persists consent (personalization, which gates the
 * taste profile) + the DTO-supported preferences. The guest spine (AuthContext) already gave them a safe session,
 * so nothing is sent before the account exists; persist() runs once, on the real registered user.
 */

const FA = '۰۱۲۳۴۵۶۷۸۹';
const toLatin = (s) => String(s ?? '').replace(/[۰-۹]/g, (d) => FA.indexOf(d));
const PHONE_RE = /^09\d{9}$/;
// Forgive common phone formatting so a valid number never silently fails validation:
// strip spaces/dashes/parens and normalize +98 / 0098 / 98… to the local 09… form.
const normalizePhone = (s) => {
  let d = toLatin(s).replace(/[\s\-()]/g, '');
  if (d.startsWith('+98')) d = '0' + d.slice(3);
  else if (d.startsWith('0098')) d = '0' + d.slice(4);
  else if (d.startsWith('98') && d.length === 12) d = '0' + d.slice(2);
  return d;
};

const initialAnswers = {
  allergens: {},     // { [allergenId]: 'mild' | 'severe' } → HARD safety gate
  pattern: '',       // diet pattern → candidate pool
  workdayTime: '',   // cooking_time_workday band → assessRecipeFit (quicker slate)
  dislikes: {},      // { [dislikeId]: true } → assistant hard_dislikes
};

function authError(err, mode) {
  const m = err?.response?.data?.message;
  if (Array.isArray(m) && m.length) return m[0];
  if (typeof m === 'string' && m.trim()) return m;
  return mode === 'signup' ? 'ثبت‌نام ناموفق بود. دوباره تلاش کن.' : 'ورود ناموفق بود. شماره یا گذرواژه را بررسی کن.';
}

// STEP_COUNT: 1 Welcome · 2 Allergy · 3 Taste&Time · 4 Reveal · 5 Account
const LAST_STEP = 5;

export function useOnboarding() {
  const navigate = useNavigate();
  const { register, login, token } = useAuth();
  const authed = !!token; // re-entry: an already signed-in user revisiting onboarding

  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState(initialAnswers);

  const [authMode, setAuthMode] = useState('signup');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const go = useCallback((n) => {
    setStep(Math.max(1, Math.min(LAST_STEP, n)));
    const m = typeof document !== 'undefined' && document.querySelector('[data-onb-scroll]');
    if (m) m.scrollTop = 0;
  }, []);
  const next = useCallback(() => go(step + 1), [go, step]);
  const back = useCallback(() => go(step - 1), [go, step]);
  const skip = useCallback(() => go(step + 1), [go, step]);

  // answer setters
  const setSingle = (key) => (id) => setAnswers((a) => ({ ...a, [key]: a[key] === id ? '' : id }));
  const toggleMap = (key, value = true) => (id) => setAnswers((a) => {
    const m = { ...a[key] };
    if (m[id]) delete m[id]; else m[id] = value;
    return { ...a, [key]: m };
  });
  const setPattern = setSingle('pattern');
  const setWorkdayTime = setSingle('workdayTime');
  const toggleDislike = toggleMap('dislikes');
  const toggleAllergen = (id) => setAnswers((a) => {
    const m = { ...a.allergens };
    if (m[id]) delete m[id]; else m[id] = 'severe';
    return { ...a, allergens: m };
  });
  const setSeverity = (id, sev) => setAnswers((a) => ({ ...a, allergens: { ...a.allergens, [id]: sev } }));
  // "None" fast-exit on the allergy screen: clear every allergen, then advance.
  const clearAllergensAndNext = useCallback(() => { setAnswers((a) => ({ ...a, allergens: {} })); go(step + 1); }, [go, step]);

  // Both question steps are answerable in one tap (allergy has a "None" exit; taste&time is optional), so «ادامه» is
  // never blocked — the flow never traps a user behind a question they don't want to answer.
  const canContinue = true;

  // The reveal is a warm "we've started" moment, NOT a score — only the derived trait chips, never a percentage.
  const traits = useMemo(() => deriveTraits(answers), [answers]);

  const isSignup = authMode === 'signup';
  const phoneValid = PHONE_RE.test(normalizePhone(phone));
  const passValid = isSignup ? password.length >= 8 : password.length >= 1;
  const canSubmit = phoneValid && passValid && (!isSignup || consent) && !submitting;

  const goLogin = useCallback(() => { setAuthMode('login'); go(LAST_STEP); }, [go]);
  const toggleAuth = useCallback(() => { setError(null); setAuthMode((m) => (m === 'signup' ? 'login' : 'signup')); }, []);

  const buildPreferences = useCallback(() => {
    const body = {};
    if (answers.pattern) body.diet = answers.pattern;
    const allergyIds = Object.keys(answers.allergens);
    if (allergyIds.length) body.allergies = JSON.stringify(allergyIds);
    return body;
  }, [answers]);

  // persist consent + every collected signal, each to its real engine consumer. Runs once on the registered user
  // (or, for a menu re-entry, on the already-signed-in user). All writes are non-blocking — onboarding must never
  // dead-end on a transient network error.
  const persist = useCallback(async () => {
    try { await apiClient.post('/users/consent', { type: 'personalization', granted: true }); try { localStorage.setItem('garnish.consent.personalization', 'true'); } catch { /* */ } } catch { /* non-blocking */ }
    try { await apiClient.post('/users/consent', { type: 'core', granted: true }); } catch { /* non-blocking */ }
    // diet → candidate pool; allergies → HARD gate (UserAllergy, via the canonical EU-14 write boundary).
    try { await apiClient.put('/users/preferences', buildPreferences()); } catch { /* non-blocking */ }
    // DISLIKES → declared `dietary.hard_dislikes` the assistant reads. Category dislikes («غذای دریایی») expand to
    // the names the engine matches. (consent granted above, so the answer persists rather than being dropped.)
    const EXPAND = { seafood: ['ماهی', 'میگو', 'صدف', 'خرچنگ', 'غذای دریایی'] };
    const dislikeNames = [...new Set(Object.keys(answers.dislikes).flatMap((id) => EXPAND[id] || [DISLIKE_OPTIONS.find((o) => o.id === id)?.label]).filter(Boolean))];
    if (dislikeNames.length) { try { await apiClient.post('/profile/answer', { key: 'dietary.hard_dislikes', value: dislikeNames }); } catch { /* non-blocking */ } }
    // EFFORT LEVER → declared `cooking_time_workday` band → reconciliation → assessRecipeFit → quicker first slate
    // (proven: busy declared user's slate averaged ~39m vs ~78m). Asked directly now, not derived.
    if (answers.workdayTime) { try { await apiClient.post('/profile/answer', { key: 'constraints.cooking_time_workday', value: answers.workdayTime }); } catch { /* non-blocking */ } }
  }, [buildPreferences, answers.dislikes, answers.workdayTime]);

  const finish = useCallback(async () => {
    setSubmitting(true);
    await persist();
    try { localStorage.setItem(ONBOARDED_KEY, 'true'); } catch { /* private mode */ }
    setSubmitting(false);
    navigate('/', { replace: true });
  }, [persist, navigate]);

  const submit = useCallback(async () => {
    if (submitting) return;
    setError(null);
    const ph = normalizePhone(phone);
    if (!PHONE_RE.test(ph)) { setError('شمارهٔ موبایلت رو کامل و درست وارد کن — مثل ۰۹۱۲۳۴۵۶۷۸۹.'); return; }
    if (isSignup && password.length < 8) { setError('برای امنیت، گذرواژه باید حداقل ۸ کاراکتر باشه.'); return; }
    if (!isSignup && !password) { setError('گذرواژه‌ات رو وارد کن.'); return; }
    if (isSignup && !consent) { setError('برای ساختن حساب، با شرایط و حریم خصوصی موافقت کن — تیکِ پایین رو بزن.'); return; }
    setSubmitting(true);
    try {
      if (isSignup) await register(ph, password);
      else await login(ph, password);
    } catch (e) {
      setError(authError(e, authMode));
      setSubmitting(false);
      return;
    }
    if (isSignup) await persist(); // consent (personalization gates the profile) + every collected signal
    try { localStorage.setItem(ONBOARDED_KEY, 'true'); } catch { /* private mode */ }
    setSubmitting(false);
    navigate('/', { replace: true });
  }, [submitting, isSignup, phone, password, consent, register, login, authMode, persist, navigate]);

  return {
    step, go, next, back, skip,
    answers,
    setPattern, setWorkdayTime, toggleDislike, toggleAllergen, setSeverity, clearAllergensAndNext,
    canContinue,
    progressIndex: Math.max(1, step - 1), progressTotal: 2,
    traits,
    authMode, isSignup, toggleAuth, goLogin,
    phone, setPhone, phoneValid,
    password, setPassword, passValid,
    showPass, toggleShowPass: () => setShowPass((s) => !s),
    consent, toggleConsent: () => { setError(null); setConsent((c) => !c); },
    canSubmit, submitting, error,
    submit,
    authed, finish,
  };
}
