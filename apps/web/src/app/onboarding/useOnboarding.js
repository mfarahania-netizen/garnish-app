import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../lib/apiClient';
import { useAuth, ONBOARDED_KEY } from '../../context/AuthContext';
import { deriveTraits } from './steps';

/**
 * useOnboarding — the first-run flow's state machine + honest persistence.
 *
 * ONBOARDING_V1 research design: minimal front door. ONE required safety screen (allergy, EU-14), then ONE tight
 * "taste & time" screen (diet + workday cooking-time + a FREE-FORM taste builder where the user searches ANY of the
 * 1008 ingredients and marks love/never), then into the app. Lower-value declared bits (skill, budget, goals,
 * household, servings) are earned progressively in-app, not asked up front.
 *
 * Every signal is wired to a real, verified engine consumer: allergy → HARD gate (UserAllergy); diet → candidate
 * pool; cooking-time → assessRecipeFit (quicker first slate); per-ingredient taste → /profile/taste/correct; and
 * dislikes ALSO → the declared hard_dislikes the chat strictly avoids.
 */

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

// «بادمجان خام» → «بادمجان» — strip ONE trailing ingredient-state word so a declared hard-dislike matches how
// recipes actually name the ingredient (recipes say بادمجان, the catalog row is بادمجان خام).
const STATE_SUFFIXES = ['خام', 'خشک', 'پخته', 'کبابی', 'سرخ‌شده', 'کنسروی', 'آب‌پز', 'بخارپز', 'تازه', 'منجمد', 'پودر', 'له‌شده', 'رنده‌شده', 'برشته', 'آسیاب‌شده'];
const baseIngredientName = (name) => {
  const n = String(name ?? '').trim();
  for (const w of STATE_SUFFIXES) if (n.endsWith(' ' + w)) return n.slice(0, -(w.length + 1)).trim();
  return n;
};

const initialAnswers = {
  allergens: {},     // { [allergenId]: 'mild' | 'severe' } → HARD safety gate
  pattern: '',       // diet pattern → candidate pool
  workdayTime: '',   // cooking_time_workday band → assessRecipeFit (quicker slate)
  taste: { likes: [], dislikes: [] }, // [{id,name}] → /profile/taste/correct (+ dislikes → hard_dislikes)
  goals: {},         // { [goalId]: true } → declared goals.primary (why the user is here)
  style: '',         // traditional | modern | both → declared cuisine_style (SOFT region lean)
};

function authError(err, mode) {
  const m = err?.response?.data?.message;
  if (Array.isArray(m) && m.length) return m[0];
  if (typeof m === 'string' && m.trim()) return m;
  return mode === 'signup' ? 'ثبت‌نام ناموفق بود. دوباره تلاش کن.' : 'ورود ناموفق بود. شماره یا گذرواژه را بررسی کن.';
}

// STEP_COUNT: 1 Welcome · 2 Allergy · 3 Taste&Time · 4 Goal&Style · 5 Reveal · 6 Account
const LAST_STEP = 6;

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
  const setPattern = setSingle('pattern');
  const setWorkdayTime = setSingle('workdayTime');
  const setStyle = setSingle('style');
  const toggleGoal = (id) => setAnswers((a) => {
    const m = { ...a.goals };
    if (m[id]) delete m[id]; else m[id] = true;
    return { ...a, goals: m };
  });
  const addTaste = (stance, item) => setAnswers((a) => {
    const key = stance === 'like' ? 'likes' : 'dislikes';
    if (!item?.id || a.taste[key].some((x) => x.id === item.id)) return a;
    return { ...a, taste: { ...a.taste, [key]: [...a.taste[key], { id: item.id, name: item.name }] } };
  });
  const removeTaste = (stance, id) => setAnswers((a) => {
    const key = stance === 'like' ? 'likes' : 'dislikes';
    return { ...a, taste: { ...a.taste, [key]: a.taste[key].filter((x) => x.id !== id) } };
  });
  const toggleAllergen = (id) => setAnswers((a) => {
    const m = { ...a.allergens };
    if (m[id]) delete m[id]; else m[id] = 'severe';
    return { ...a, allergens: m };
  });
  const setSeverity = (id, sev) => setAnswers((a) => ({ ...a, allergens: { ...a.allergens, [id]: sev } }));
  const clearAllergensAndNext = useCallback(() => { setAnswers((a) => ({ ...a, allergens: {} })); go(step + 1); }, [go, step]);

  const canContinue = true; // both question steps are one-tap answerable (allergy has None; taste&time is optional)

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

  // persist consent + every collected signal. Consent is granted FIRST (it gates every write); then ALL writes fire
  // in PARALLEL so the save is ~2 round-trips, not a dozen sequential ones (the old loop made the «ذخیره» button
  // feel stuck the more you filled in). A hard race-timeout guarantees the button is ALWAYS freed — any straggler
  // request finishes in the background. Each write maps a collected signal to its real engine consumer.
  const persist = useCallback(async () => {
    const work = (async () => {
      await Promise.allSettled([
        apiClient.post('/users/consent', { type: 'personalization', granted: true }),
        apiClient.post('/users/consent', { type: 'core', granted: true }),
      ]);
      try { localStorage.setItem('garnish.consent.personalization', 'true'); } catch { /* */ }
      const writes = [apiClient.put('/users/preferences', buildPreferences())]; // diet → pool; allergies → HARD gate
      // LIKES + DISLIKES → per-ingredient soft taste (resolved id). DISLIKES also → declared hard_dislikes the chat
      // strictly avoids (cleaned base name so it matches recipe ingredient naming).
      for (const it of answers.taste.likes) writes.push(apiClient.post('/profile/taste/correct', { ingredientId: it.id, stance: 'like' }));
      for (const it of answers.taste.dislikes) writes.push(apiClient.post('/profile/taste/correct', { ingredientId: it.id, stance: 'dislike' }));
      const dislikeNames = [...new Set(answers.taste.dislikes.map((it) => baseIngredientName(it.name)).filter(Boolean))];
      if (dislikeNames.length) writes.push(apiClient.post('/profile/answer', { key: 'dietary.hard_dislikes', value: dislikeNames }));
      if (answers.workdayTime) writes.push(apiClient.post('/profile/answer', { key: 'constraints.cooking_time_workday', value: answers.workdayTime })); // → assessRecipeFit (quicker slate)
      const goalIds = Object.keys(answers.goals);
      if (goalIds.length) writes.push(apiClient.post('/profile/answer', { key: 'goals.primary', value: goalIds })); // why the user is here
      if (answers.style) writes.push(apiClient.post('/profile/answer', { key: 'context.cuisine_style', value: answers.style })); // SOFT cuisine lean
      await Promise.allSettled(writes);
    })();
    await Promise.race([work, new Promise((res) => setTimeout(res, 7000))]);
  }, [buildPreferences, answers.taste, answers.workdayTime, answers.goals, answers.style]);

  const finish = useCallback(async () => {
    setSubmitting(true);
    try { await persist(); } finally {
      // ALWAYS free the button + move on, even if persist threw — the save is best-effort, never a dead-end.
      try { localStorage.setItem(ONBOARDED_KEY, 'true'); } catch { /* private mode */ }
      setSubmitting(false);
      navigate('/', { replace: true });
    }
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
    if (isSignup) await persist();
    try { localStorage.setItem(ONBOARDED_KEY, 'true'); } catch { /* private mode */ }
    setSubmitting(false);
    navigate('/', { replace: true });
  }, [submitting, isSignup, phone, password, consent, register, login, authMode, persist, navigate]);

  return {
    step, go, next, back, skip,
    answers,
    setPattern, setWorkdayTime, setStyle, toggleGoal, addTaste, removeTaste, toggleAllergen, setSeverity, clearAllergensAndNext,
    canContinue,
    progressIndex: Math.max(1, step - 1), progressTotal: 3,
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
