import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../lib/apiClient';
import { useAuth, ONBOARDED_KEY } from '../../context/AuthContext';
import { deriveTraits, DISLIKE_OPTIONS } from './steps';

/**
 * useOnboarding — the first-run flow's state machine + honest persistence.
 *
 * Steps 1–6 collect answers in flow state ONLY: every profile/preferences/consent endpoint is
 * JWT-guarded and the account is created last, so nothing can (or should) be sent before signup.
 * On the account step we call the REAL auth path (AuthContext → POST /auth/register|login, which
 * is phone-based — the mockup's email field has no endpoint, so wiring it would be a dead form),
 * then — only with the user's consent — persist consent (personalization, which gates the taste
 * profile) and the DTO-supported preferences (diet/allergies/skillLevel/budget/healthGoals).
 * Fields the preferences DTO doesn't model (household, routine, serving-count, dislikes, allergen
 * severity) are kept in flow state, not sent to any invented endpoint.
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
  work: '', household: '', count: 2,
  pattern: '', allergens: {}, dislikes: {},
  goals: {}, skill: '', budget: '',
};

function authError(err, mode) {
  const m = err?.response?.data?.message;
  if (Array.isArray(m) && m.length) return m[0];
  if (typeof m === 'string' && m.trim()) return m;
  return mode === 'signup' ? 'ثبت‌نام ناموفق بود. دوباره تلاش کن.' : 'ورود ناموفق بود. شماره یا گذرواژه را بررسی کن.';
}

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
    setStep(Math.max(1, Math.min(7, n)));
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
  const setWork = setSingle('work');
  const setHousehold = setSingle('household');
  const setPattern = setSingle('pattern');
  const setSkill = setSingle('skill');
  const setBudget = setSingle('budget');
  const toggleGoal = toggleMap('goals');
  const toggleDislike = toggleMap('dislikes');
  const toggleAllergen = (id) => setAnswers((a) => {
    const m = { ...a.allergens };
    if (m[id]) delete m[id]; else m[id] = 'severe';
    return { ...a, allergens: m };
  });
  const setSeverity = (id, sev) => setAnswers((a) => ({ ...a, allergens: { ...a.allergens, [id]: sev } }));
  const inc = () => setAnswers((a) => ({ ...a, count: Math.min(20, a.count + 1) }));
  const dec = () => setAnswers((a) => ({ ...a, count: Math.max(1, a.count - 1) }));

  // per-step validation — «ادامه» needs the step's primary answer; «رد کن» always advances
  const canContinue = useMemo(() => {
    if (step === 2) return !!answers.work;
    if (step === 3) return !!answers.pattern;
    return true;
  }, [step, answers.work, answers.pattern]);

  // The reveal is a warm "we've started" moment, NOT a score — the ring is a calm forming visual with
  // no percentage (see page.jsx), so we expose only the derived trait chips, never a completeness number.
  const traits = useMemo(() => deriveTraits(answers), [answers]);

  // auth validation. Signup needs a strong-enough password (helper says ≥۸); LOGIN must NOT enforce
  // that (the server min is 6, so an existing 6–7 char password must still be allowed in) — only that
  // a password was entered. canSubmit drives the button's visual state, but the button stays clickable
  // (see submit) so the user always learns WHAT is missing instead of facing a silent dead button.
  const isSignup = authMode === 'signup';
  const phoneValid = PHONE_RE.test(normalizePhone(phone));
  const passValid = isSignup ? password.length >= 8 : password.length >= 1;
  const canSubmit = phoneValid && passValid && (!isSignup || consent) && !submitting;

  const goLogin = useCallback(() => { setAuthMode('login'); go(7); }, [go]);
  const toggleAuth = useCallback(() => { setError(null); setAuthMode((m) => (m === 'signup' ? 'login' : 'signup')); }, []);

  const buildPreferences = useCallback(() => {
    const body = {};
    if (answers.pattern) body.diet = answers.pattern;
    if (answers.skill) body.skillLevel = answers.skill;
    if (answers.budget) body.budget = answers.budget; // a BAND id ('low'|'mid'|'generous'), never a number
    const allergyIds = Object.keys(answers.allergens);
    if (allergyIds.length) body.allergies = JSON.stringify(allergyIds);
    const goalIds = Object.keys(answers.goals);
    if (goalIds.length) body.healthGoals = JSON.stringify(goalIds);
    return body;
  }, [answers]);

  // persist consent + the supported preferences for an ALREADY signed-in user (re-entry from the
  // menu): no account step — save straight away and return Home.
  const persist = useCallback(async () => {
    try { await apiClient.post('/users/consent', { type: 'personalization', granted: true }); try { localStorage.setItem('garnish.consent.personalization', 'true'); } catch { /* */ } } catch { /* non-blocking */ }
    try { await apiClient.post('/users/consent', { type: 'core', granted: true }); } catch { /* non-blocking */ }
    try { await apiClient.put('/users/preferences', buildPreferences()); } catch { /* non-blocking */ }
    // DISLIKES → the declared `dietary.hard_dislikes` lever the assistant reads (consent is granted above, so the
    // answer persists). Previously collected in flow state but never sent — so the assistant never learned them
    // and could even invent the opposite («you love eggplant»). Send the Persian INGREDIENT names the engine matches.
    // category dislikes («غذای دریایی») aren't a single ingredient — expand to the names the engine matches.
    const EXPAND = { seafood: ['ماهی', 'میگو', 'صدف', 'خرچنگ', 'غذای دریایی'] };
    const dislikeNames = [...new Set(Object.keys(answers.dislikes).flatMap((id) => EXPAND[id] || [DISLIKE_OPTIONS.find((o) => o.id === id)?.label]).filter(Boolean))];
    if (dislikeNames.length) { try { await apiClient.post('/profile/answer', { key: 'dietary.hard_dislikes', value: dislikeNames }); } catch { /* non-blocking */ } }
    // EFFORT LEVER (declared) → the workday-routine answer maps to the `cooking_time_workday` band the engine reads
    // (reconciliation → assessRecipeFit → cold-start slate + chat lean quicker for busy users). Proven live: a busy
    // declared user's first slate averaged ~39m vs ~78m for a relaxed one. The question's own helper frames it as
    // "how much time you have to cook midweek", so this mapping is honest, not invented.
    const WORK_TO_BAND = { desk: '15_30', shift: '15_30', home: '30_60', free: '60_plus' };
    const band = WORK_TO_BAND[answers.work];
    if (band) { try { await apiClient.post('/profile/answer', { key: 'constraints.cooking_time_workday', value: band }); } catch { /* non-blocking */ } }
  }, [buildPreferences, answers.dislikes, answers.work]);

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
    // Explicit, friendly validation — the button is always clickable, so clicking ALWAYS does
    // something: either submit, or tell the user exactly what's missing (never a silent no-op).
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
    if (isSignup) await persist(); // consent (personalization gates the profile) + supported preferences
    try { localStorage.setItem(ONBOARDED_KEY, 'true'); } catch { /* private mode */ }
    setSubmitting(false);
    navigate('/', { replace: true });
  }, [submitting, isSignup, phone, password, consent, register, login, authMode, persist, navigate]);

  return {
    step, go, next, back, skip,
    answers,
    setWork, setHousehold, setPattern, setSkill, setBudget,
    toggleGoal, toggleDislike, toggleAllergen, setSeverity, inc, dec,
    countFa: String(answers.count).replace(/[0-9]/g, (d) => FA[+d]),
    canContinue,
    progressIndex: Math.max(1, step - 1), progressTotal: 4,
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
