import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';
import {
  CURRENT_PRIVACY_POLICY_VERSION,
  CURRENT_TERMS_POLICY_VERSION,
  OPTIONAL_PERSONALIZATION_UI_ENABLED,
} from '../../lib/consent-policy';
import {
  COOKTIME_OPTIONS,
  COOKS_FOR_OPTIONS,
  DIETARY_RULE_OPTIONS,
  ONBOARDING_ALLERGEN_OPTIONS,
  PATTERN_OPTIONS,
  QUESTION_STEP_TOTAL,
  STEP_META,
  allergenLabels,
  optionLabel,
} from './steps';

export const ONBOARDING_SCHEMA_VERSION = 2;
export const LAST_QUESTION_STEP = 5;
export const REVIEW_STEP = 6;
export const RESULT_STEP = 7;

const SESSION_KEY_PREFIX = 'garnish.onboarding.v2.draft';
const LEGACY_SESSION_KEY = SESSION_KEY_PREFIX;
const EMPTY_ANSWERS = Object.freeze({
  safety: {
    status: 'unknown',
    allergyIds: [],
    intoleranceIds: [],
  },
  dietPattern: '',
  dietaryRules: [],
  weekdayTimeBucket: '',
  cooksForCount: '',
  taste: {
    likes: [],
    dislikes: [],
  },
});

const unique = (items = []) => [...new Set((Array.isArray(items) ? items : []).map(String).filter(Boolean))];

const cloneInitialAnswers = () => ({
  safety: { ...EMPTY_ANSWERS.safety, allergyIds: [], intoleranceIds: [] },
  dietPattern: '',
  dietaryRules: [],
  weekdayTimeBucket: '',
  cooksForCount: '',
  taste: { likes: [], dislikes: [] },
});

const allowedIds = (options) => new Set(options.map((option) => option.id));
const ALLOWED_ALLERGEN_IDS = allowedIds(ONBOARDING_ALLERGEN_OPTIONS);
const ALLOWED_DIET_IDS = allowedIds(PATTERN_OPTIONS);
const ALLOWED_RULE_IDS = allowedIds(DIETARY_RULE_OPTIONS);
const ALLOWED_TIME_IDS = allowedIds(COOKTIME_OPTIONS);
const ALLOWED_COOKS_FOR_IDS = allowedIds(COOKS_FOR_OPTIONS);

const tokenSubject = (token) => {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    if (payload && typeof globalThis.atob === 'function') {
      const decoded = JSON.parse(globalThis.atob(payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=')));
      const sub = String(decoded?.sub || '').trim();
      if (sub && sub.length <= 100) return sub;
    }
  } catch { /* a non-JWT development token is scoped by the fallback hash below */ }
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `token-${(hash >>> 0).toString(36)}`;
};

const sessionSubject = (token, user) => {
  // The token subject is the canonical identity during an auth transition. In
  // particular, AuthContext can briefly expose a new token beside the previous
  // user object; preferring user.id in that frame can cross-load a draft.
  const tokenScopedSubject = tokenSubject(token);
  if (tokenScopedSubject) return tokenScopedSubject;
  const id = String(user?.id || user?.userId || '').trim();
  return id || null;
};

const sessionKeyFor = (subject) => subject ? `${SESSION_KEY_PREFIX}:${subject}` : null;

const cleanIds = (value, allowed, max) => unique(value)
  .filter((id) => allowed.has(id))
  .slice(0, max);

const cleanTasteItems = (value, stance, max) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const items = [];
  for (const raw of value) {
    const id = String(raw?.id || '').trim();
    if (!id || id.length > 100 || seen.has(id)) continue;
    seen.add(id);
    items.push({
      id,
      name: String(raw?.name || 'غذا').trim().slice(0, 120) || 'غذا',
      type: 'dish',
      stance,
    });
    if (items.length >= max) break;
  }
  return items;
};

const normalizeSessionDraft = (value, subject) => {
  if (!value || value.schemaVersion !== ONBOARDING_SCHEMA_VERSION || value.subject !== subject || !value.answers) return null;
  const raw = value.answers;
  const allergyIds = cleanIds(raw.safety?.allergyIds, ALLOWED_ALLERGEN_IDS, ALLOWED_ALLERGEN_IDS.size);
  const intoleranceIds = cleanIds(raw.safety?.intoleranceIds, ALLOWED_ALLERGEN_IDS, ALLOWED_ALLERGEN_IDS.size)
    .filter((id) => !allergyIds.includes(id));
  const declared = allergyIds.length + intoleranceIds.length > 0;
  const rawStatus = raw.safety?.status;
  const status = declared ? 'declared' : rawStatus === 'none' ? 'none' : 'unknown';
  const likes = cleanTasteItems(raw.taste?.likes, 'like', 3);
  const likeIds = new Set(likes.map((item) => item.id));
  const dislikes = cleanTasteItems(raw.taste?.dislikes, 'dislike', 2).filter((item) => !likeIds.has(item.id));
  const rawStep = Number(value.step);
  const step = Number.isInteger(rawStep) ? Math.max(1, Math.min(REVIEW_STEP, rawStep)) : 1;
  const rawRevision = Number(value.revision);
  return {
    step,
    revision: Number.isInteger(rawRevision) && rawRevision >= 0 ? rawRevision : 0,
    answers: {
      safety: { status, allergyIds, intoleranceIds },
      dietaryRules: cleanIds(raw.dietaryRules, ALLOWED_RULE_IDS, ALLOWED_RULE_IDS.size),
      dietPattern: ALLOWED_DIET_IDS.has(raw.dietPattern) ? raw.dietPattern : '',
      weekdayTimeBucket: ALLOWED_TIME_IDS.has(raw.weekdayTimeBucket) ? raw.weekdayTimeBucket : '',
      cooksForCount: ALLOWED_COOKS_FOR_IDS.has(raw.cooksForCount) ? raw.cooksForCount : '',
      taste: { likes, dislikes },
    },
  };
};

const mutationId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `onb-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const messageFromError = (error, fallback) => {
  if (typeof error?.response?.data?.message === 'string') return error.response.data.message;
  if (Array.isArray(error?.response?.data?.message)) return error.response.data.message[0] || fallback;
  if (!error?.response && typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'اینترنت قطع است. پاسخ‌ها روی همین صفحه می‌مانند؛ بعد از اتصال دوباره تلاش کن.';
  }
  return fallback;
};

const readSessionDraft = (key, subject) => {
  if (!key || !subject) return null;
  try {
    return normalizeSessionDraft(JSON.parse(sessionStorage.getItem(key) || 'null'), subject);
  } catch {
    return null;
  }
};

const SAVED_TASTE_PLACEHOLDER = 'انتخاب ذخیره‌شده';

const toTasteItems = (ids, stance, knownItems = []) => {
  const knownNames = new Map(
    [...(knownItems?.likes || []), ...(knownItems?.dislikes || [])]
      .map((item) => [String(item?.id || ''), String(item?.name || '').trim()])
      .filter(([id, name]) => id && name && !name.startsWith(SAVED_TASTE_PLACEHOLDER)),
  );
  return unique(ids).map((id, index) => ({
    id,
    // The numbered fallback keeps multiple restored choices distinguishable
    // while their real titles are resolved from the recipe endpoint.
    name: knownNames.get(id) || `${SAVED_TASTE_PLACEHOLDER} ${index + 1}`,
    type: 'dish',
    stance,
  }));
};

const answersFromProfile = (profile, knownAnswers = null) => {
  if (!profile || profile.schemaVersion !== ONBOARDING_SCHEMA_VERSION) return null;
  const safety = profile.safety || {};
  const preferences = profile.preferences || {};
  const taste = profile.taste || {};
  return {
    safety: {
      status: safety.status || 'unknown',
      allergyIds: unique(safety.allergyIds),
      intoleranceIds: unique(safety.intoleranceIds),
    },
    dietaryRules: unique(safety.dietaryRules),
    dietPattern: preferences.dietPattern || '',
    weekdayTimeBucket: preferences.weekdayTimeBucket || '',
    cooksForCount: preferences.cooksForCount || '',
    taste: {
      likes: toTasteItems(taste.likedRecipeIds, 'like', knownAnswers?.taste),
      dislikes: toTasteItems(taste.dislikedRecipeIds, 'dislike', knownAnswers?.taste),
    },
  };
};

const recipeTitleFrom = (data) => {
  const recipe = data?.recipe || data?.data?.recipe || data?.data || data;
  const title = recipe?.title || recipe?.name;
  return typeof title === 'string' ? title.trim().slice(0, 120) : '';
};

const resolveTasteTitles = async (value) => {
  const items = [...(value?.taste?.likes || []), ...(value?.taste?.dislikes || [])];
  const unresolved = items.filter((item) => item.name.startsWith(SAVED_TASTE_PLACEHOLDER));
  if (!unresolved.length) return value;

  const resolved = new Map((await Promise.all(unresolved.map(async (item) => {
    try {
      const { data } = await apiClient.get(`/recipes/${encodeURIComponent(item.id)}`);
      return [item.id, recipeTitleFrom(data)];
    } catch {
      return [item.id, ''];
    }
  }))).filter(([, title]) => title));

  if (!resolved.size) return value;
  const withResolvedTitles = (list) => list.map((item) => ({
    ...item,
    name: resolved.get(item.id) || item.name,
  }));
  return {
    ...value,
    taste: {
      likes: withResolvedTitles(value.taste.likes),
      dislikes: withResolvedTitles(value.taste.dislikes),
    },
  };
};

const normalizeRecommendations = (data) => {
  const source = Array.isArray(data)
    ? data
    : data?.items || data?.recommendations || data?.recipes || data?.data || [];
  if (!Array.isArray(source)) return [];
  const seen = new Set();
  return source.map((entry) => {
    const recipe = entry?.recipe || entry;
    const id = String(recipe?.id || entry?.recipeId || '').trim();
    return {
      id,
      title: String(recipe?.title || recipe?.name || 'پیشنهاد غذایی').trim().slice(0, 160),
      imageUrl: recipe?.imageUrl || recipe?.image || null,
      reason: typeof (entry?.reason || entry?.explanation) === 'string'
        ? (entry.reason || entry.explanation).trim().slice(0, 240)
        : null,
      cookingTime: recipe?.cookingTime || recipe?.totalTime || null,
      diet: recipe?.diet || null,
    };
  }).filter((entry) => {
    // A recommendation without a stable recipe id cannot be opened safely and
    // must not become a broken `/recipe/` card.
    if (!entry.id || seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  }).slice(0, 3);
};

export function useOnboarding() {
  const navigate = useNavigate();
  const { token, user, refreshUser } = useAuth();
  const authed = Boolean(token);
  const subject = useMemo(() => sessionSubject(token, user), [token, user]);
  const sessionKey = useMemo(() => sessionKeyFor(subject), [subject]);
  const fallback = useMemo(() => readSessionDraft(sessionKey, subject), [sessionKey, subject]);

  const [step, setStep] = useState(fallback?.step || 1);
  const [answers, setAnswers] = useState(fallback?.answers || cloneInitialAnswers());
  const answersRef = useRef(answers);
  const [revision, setRevision] = useState(fallback?.revision || 0);
  const revisionRef = useRef(fallback?.revision || 0);
  const [hydrating, setHydrating] = useState(authed);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  // Consent is hydrated from the server. localStorage is only a non-authoritative
  // compatibility cache written after completion and must never grant consent.
  const [personalizationConsent, setPersonalizationConsent] = useState(false);
  const [personalizationAvailable, setPersonalizationAvailable] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState(null);
  const [revisionConflict, setRevisionConflict] = useState(false);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const recommendationsEndpointRef = useRef('/recommendations?limit=3');
  const nextPathRef = useRef('/');
  const recommendationsRequestedRef = useRef(false);
  const recommendationsRequestIdRef = useRef(0);
  const subjectRef = useRef(subject);
  const actionInFlightRef = useRef(false);

  const updateRevision = useCallback((next) => {
    const value = Number(next);
    if (!Number.isFinite(value)) return revisionRef.current;
    revisionRef.current = value;
    setRevision(value);
    return value;
  }, []);

  useEffect(() => {
    answersRef.current = answers;
    try {
      sessionStorage.removeItem(LEGACY_SESSION_KEY);
      if (hydrating) return;
      // Effects run in declaration order. On an in-place account switch, skip
      // the persistence pass until the subject-reset effect has loaded the new
      // user's own draft; otherwise old answers can be written under a new key.
      if (subjectRef.current !== subject) return;
      if (!sessionKey || !subject) return;
      if (alreadyCompleted || step === RESULT_STEP) {
        sessionStorage.removeItem(sessionKey);
        return;
      }
      const sessionAnswers = personalizationConsent && personalizationAvailable
        ? answers
        : { ...answers, taste: { likes: [], dislikes: [] } };
      sessionStorage.setItem(sessionKey, JSON.stringify({
        schemaVersion: ONBOARDING_SCHEMA_VERSION,
        subject,
        step,
        revision,
        answers: sessionAnswers,
      }));
    } catch { /* session fallback is best-effort */ }
  }, [alreadyCompleted, answers, hydrating, personalizationAvailable, personalizationConsent, revision, sessionKey, step, subject]);

  useEffect(() => {
    if (subjectRef.current === subject) return;
    subjectRef.current = subject;
    const scoped = readSessionDraft(sessionKey, subject);
    const nextAnswers = scoped?.answers || cloneInitialAnswers();
    answersRef.current = nextAnswers;
    setAnswers(nextAnswers);
    updateRevision(scoped?.revision || 0);
    setStep(scoped?.step || 1);
    setAlreadyCompleted(false);
    setError(null);
    setStatusMessage('');
    setRevisionConflict(false);
    setPersonalizationConsent(false);
    setPersonalizationAvailable(false);
    setTermsAccepted(false);
    setRecommendations([]);
    setRecommendationsError(null);
    setRecommendationsLoading(false);
    recommendationsRequestIdRef.current += 1;
    recommendationsRequestedRef.current = false;
    recommendationsEndpointRef.current = '/recommendations?limit=3';
    nextPathRef.current = '/';
  }, [sessionKey, subject, updateRevision]);

  useEffect(() => {
    if (!token) { setHydrating(false); return undefined; }
    let cancelled = false;
    setHydrating(true);
    Promise.all([
      apiClient.get('/onboarding/v2'),
      apiClient.get('/users/consent').catch(() => null),
    ])
      .then(async ([{ data }, consentResponse]) => {
        if (cancelled) return;
        const sessionDraft = readSessionDraft(sessionKey, subject);
        const personalizationDecision = consentResponse?.data?.purposes?.personalization;
        const termsDecision = consentResponse?.data?.purposes?.terms;
        const currentTermsAccepted = termsDecision?.granted === true
          && termsDecision?.policyVersion === CURRENT_TERMS_POLICY_VERSION;
        const available = OPTIONAL_PERSONALIZATION_UI_ENABLED
          && personalizationDecision?.processingEnabled === true;
        const personalizationGranted = available
          && personalizationDecision?.granted === true
          && personalizationDecision?.policyVersion === CURRENT_PRIVACY_POLICY_VERSION;
        const serverCompleted = data?.status === 'completed' || Boolean(data?.completedAt);
        const serverIsEmpty = Number(data?.revision || 0) === 0 && !data?.updatedAt && !serverCompleted;
        const restoredProfile = answersFromProfile(data, sessionDraft?.answers);
        const restoredSource = serverIsEmpty && sessionDraft?.answers
          ? sessionDraft.answers
          : restoredProfile;
        const restored = restoredSource && !personalizationGranted
          ? { ...restoredSource, taste: { likes: [], dislikes: [] } }
          : restoredSource;
        if (restored) {
          const namedAnswers = serverCompleted ? restored : await resolveTasteTitles(restored);
          if (cancelled) return;
          answersRef.current = namedAnswers;
          setAnswers(namedAnswers);
        }
        setPersonalizationAvailable(available);
        setPersonalizationConsent(personalizationGranted);
        setTermsAccepted(currentTermsAccepted);
        updateRevision(data?.revision || 0);
        if (serverCompleted) {
          setAlreadyCompleted(true);
          setStep(RESULT_STEP);
        } else if (!available && sessionDraft?.step === 5) {
          setStep(REVIEW_STEP);
        }
      })
      .catch(() => {
        // A session draft is intentionally retained when the canonical draft
        // cannot be reached. The next explicit save will surface any real error.
      })
      .finally(() => { if (!cancelled) setHydrating(false); });
    return () => { cancelled = true; };
  }, [sessionKey, subject, token, updateRevision]);

  const go = useCallback((nextStep) => {
    setError(null);
    setStatusMessage('');
    setStep(Math.max(1, Math.min(RESULT_STEP, nextStep)));
    requestAnimationFrame(() => {
      const scroller = document.querySelector('[data-onboarding-scroll]');
      if (scroller) scroller.scrollTop = 0;
    });
  }, []);

  const back = useCallback(
    () => go(step === REVIEW_STEP && !personalizationAvailable ? 4 : step - 1),
    [go, personalizationAvailable, step],
  );
  const start = useCallback(() => {
    if (hydrating) return;
    if (!token) {
      navigate('/login?mode=signup&from=/onboarding', { replace: true });
      return;
    }
    if (!termsAccepted) {
      setError('پیش از ثبت اطلاعات ایمنی، شرایط استفاده و اطلاعیهٔ حریم خصوصی را بخوان و بپذیر.');
      return;
    }
    go(2);
  }, [go, hydrating, navigate, termsAccepted, token]);

  const setSafetyNone = useCallback(() => {
    setAnswers((current) => ({
      ...current,
      safety: { status: 'none', allergyIds: [], intoleranceIds: [] },
    }));
    setStatusMessage('نداشتن آلرژی و عدم‌تحمل ثبت شد.');
  }, []);

  const toggleSafetyItem = useCallback((kind, id) => {
    const otherKey = kind === 'allergy' ? 'intoleranceIds' : 'allergyIds';
    if (answersRef.current.safety[otherKey].includes(id)) {
      setStatusMessage(kind === 'allergy'
        ? 'این مورد در عدم‌تحمل ثبت شده؛ ابتدا آن انتخاب را بردار.'
        : 'این مورد در آلرژی ثبت شده؛ برای ایمنی ابتدا آن انتخاب را بردار.');
      return;
    }
    setAnswers((current) => {
      const ownKey = kind === 'allergy' ? 'allergyIds' : 'intoleranceIds';
      // Re-check inside the functional update as two keyboard/click events can
      // be queued before answersRef is refreshed by an effect.
      if (current.safety[otherKey].includes(id)) return current;
      const own = new Set(current.safety[ownKey]);
      if (own.has(id)) own.delete(id); else own.add(id);
      const nextSafety = {
        ...current.safety,
        [ownKey]: [...own],
      };
      nextSafety.status = nextSafety.allergyIds.length || nextSafety.intoleranceIds.length ? 'declared' : 'unknown';
      return { ...current, safety: nextSafety };
    });
  }, []);

  const toggleAllergy = useCallback((id) => toggleSafetyItem('allergy', id), [toggleSafetyItem]);
  const toggleIntolerance = useCallback((id) => toggleSafetyItem('intolerance', id), [toggleSafetyItem]);
  const setDietPattern = useCallback((id) => setAnswers((current) => ({ ...current, dietPattern: id })), []);
  const setWeekdayTimeBucket = useCallback((id) => setAnswers((current) => ({ ...current, weekdayTimeBucket: id })), []);
  const setCooksForCount = useCallback((id) => setAnswers((current) => ({ ...current, cooksForCount: id })), []);
  const setPersonalizationChoice = useCallback((granted) => {
    const next = granted === true && personalizationAvailable;
    setPersonalizationConsent(next);
    if (!next) {
      setAnswers((current) => ({ ...current, taste: { likes: [], dislikes: [] } }));
    }
  }, [personalizationAvailable]);
  const toggleDietaryRule = useCallback((id) => {
    setAnswers((current) => {
      const selected = new Set(current.dietaryRules);
      if (selected.has(id)) selected.delete(id); else selected.add(id);
      return { ...current, dietaryRules: [...selected] };
    });
  }, []);

  const addTaste = useCallback((stance, item) => {
    if (!personalizationAvailable || !personalizationConsent || !item?.id) return;
    setAnswers((current) => {
      const target = stance === 'dislike' ? 'dislikes' : 'likes';
      const opposite = target === 'likes' ? 'dislikes' : 'likes';
      const limit = target === 'likes' ? 3 : 2;
      const cleanItem = { id: String(item.id), name: item.name || 'غذا', type: 'dish', stance };
      const withoutDuplicate = current.taste[target].filter((value) => value.id !== cleanItem.id);
      const nextTarget = [...withoutDuplicate, cleanItem].slice(-limit);
      return {
        ...current,
        taste: {
          ...current.taste,
          [target]: nextTarget,
          [opposite]: current.taste[opposite].filter((value) => value.id !== cleanItem.id),
        },
      };
    });
  }, [personalizationAvailable, personalizationConsent]);

  const removeTaste = useCallback((stance, id) => {
    const key = stance === 'dislike' ? 'dislikes' : 'likes';
    setAnswers((current) => ({
      ...current,
      taste: { ...current.taste, [key]: current.taste[key].filter((item) => item.id !== id) },
    }));
  }, []);

  const safetyPayload = useCallback(() => {
    const allergyIds = unique(answers.safety.allergyIds);
    const intoleranceIds = unique(answers.safety.intoleranceIds).filter((id) => !allergyIds.includes(id));
    const dietaryRules = unique(answers.dietaryRules);
    const hasDeclaration = allergyIds.length || intoleranceIds.length;
    return {
      status: hasDeclaration ? 'declared' : answers.safety.status,
      allergyIds,
      intoleranceIds,
      dietaryRules,
    };
  }, [answers.dietaryRules, answers.safety]);

  const preferencesPayload = useCallback(() => ({
    dietPattern: answers.dietPattern,
    weekdayTimeBucket: answers.weekdayTimeBucket,
    cooksForCount: answers.cooksForCount,
  }), [answers.cooksForCount, answers.dietPattern, answers.weekdayTimeBucket]);

  const tastePayload = useCallback(() => ({
    likedRecipeIds: unique(answers.taste.likes.map((item) => item.id)),
    dislikedRecipeIds: unique(answers.taste.dislikes.map((item) => item.id)),
  }), [answers.taste]);

  const patchDraft = useCallback(async (draftStep, payload) => {
    if (!token) return revisionRef.current;
    const requestSubject = subjectRef.current;
    const idempotencyKey = mutationId();
    const body = {
      schemaVersion: ONBOARDING_SCHEMA_VERSION,
      idempotencyKey,
      expectedRevision: revisionRef.current,
      step: draftStep,
      [draftStep]: payload,
      ...(draftStep === 'safety' ? {
        terms: {
          accepted: true,
          policyVersion: CURRENT_TERMS_POLICY_VERSION,
        },
      } : {}),
    };
    const request = () => apiClient.patch('/onboarding/v2/draft', body);
    try {
      const { data } = await request();
      if (subjectRef.current !== requestSubject) return null;
      return updateRevision(data?.profile?.revision ?? data?.revision ?? revisionRef.current);
    } catch (firstError) {
      if (subjectRef.current !== requestSubject) return null;
      const retryable = !firstError?.response || Number(firstError?.response?.status) >= 500;
      if (!retryable) throw firstError;
      const { data } = await request();
      if (subjectRef.current !== requestSubject) return null;
      return updateRevision(data?.profile?.revision ?? data?.revision ?? revisionRef.current);
    }
  }, [token, updateRevision]);

  const reloadDraft = useCallback(async () => {
    if (!token || hydrating || actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    const requestSubject = subjectRef.current;
    setSaving(true);
    try {
      const { data } = await apiClient.get('/onboarding/v2');
      if (subjectRef.current !== requestSubject) return;
      const restored = answersFromProfile(data);
      if (restored) setAnswers(restored);
      updateRevision(data?.revision || 0);
      setRevisionConflict(false);
      setError(null);
      setStatusMessage('آخرین نسخهٔ ذخیره‌شده بارگذاری شد.');
      if (data?.status === 'completed' || data?.completedAt) {
        setAlreadyCompleted(true);
        setStep(RESULT_STEP);
      }
    } catch (requestError) {
      if (subjectRef.current !== requestSubject) return;
      setError(messageFromError(requestError, 'نسخهٔ ذخیره‌شده بارگذاری نشد. دوباره تلاش کن.'));
    } finally {
      actionInFlightRef.current = false;
      setSaving(false);
    }
  }, [hydrating, token, updateRevision]);

  const validateStep = useCallback((targetStep = step) => {
    if (targetStep === 2) {
      if (!termsAccepted) return 'برای ثبت اطلاعات ایمنی، ابتدا شرایط استفاده و اطلاعیهٔ حریم خصوصی را بپذیر.';
      const safety = safetyPayload();
      if (safety.status === 'unknown') return 'برای ایمنی، یکی از گزینه‌ها را مشخص کن.';
      if (safety.status === 'declared' && !safety.allergyIds.length && !safety.intoleranceIds.length) {
        return 'حداقل یک مورد را انتخاب کن یا «هیچ‌کدام» را بزن.';
      }
    }
    if (targetStep === 3 && !answers.dietPattern) return 'الگوی غذایی نزدیک‌تر به خودت را انتخاب کن.';
    if (targetStep === 4 && !answers.weekdayTimeBucket) return 'زمان معمول آشپزی‌ات را انتخاب کن.';
    if (targetStep === 4 && !answers.cooksForCount) return 'مشخص کن معمولاً برای چند نفر آشپزی می‌کنی.';
    return null;
  }, [answers.cooksForCount, answers.dietPattern, answers.weekdayTimeBucket, safetyPayload, step, termsAccepted]);

  const saveStep = useCallback(async (targetStep) => {
    if (targetStep === 2) return patchDraft('safety', safetyPayload());
    if (targetStep === 3) {
      const safetyRevision = await patchDraft('safety', safetyPayload());
      if (safetyRevision === null) return null;
      return patchDraft('preferences', { dietPattern: answers.dietPattern });
    }
    if (targetStep === 4) return patchDraft('preferences', preferencesPayload());
    if (targetStep === 5) return revisionRef.current;
    return revisionRef.current;
  }, [answers.dietPattern, patchDraft, preferencesPayload, safetyPayload]);

  const continueStep = useCallback(async () => {
    if (hydrating || actionInFlightRef.current) return;
    const validationError = validateStep(step);
    if (validationError) { setError(validationError); return; }
    actionInFlightRef.current = true;
    const requestSubject = subjectRef.current;
    setSaving(true);
    setError(null);
    try {
      const savedRevision = await saveStep(step);
      if (savedRevision === null || subjectRef.current !== requestSubject) return;
      go(step === 4 && !personalizationAvailable ? REVIEW_STEP : step + 1);
      setStatusMessage('پاسخ ذخیره شد.');
    } catch (requestError) {
      if (Number(requestError?.response?.status) === 409) {
        setRevisionConflict(true);
        setError('این پروفایل در صفحهٔ دیگری تغییر کرده است. آخرین نسخه را بارگذاری کن و انتخابت را دوباره بررسی کن.');
      } else {
        setRevisionConflict(false);
        setError(messageFromError(requestError, 'ذخیره انجام نشد. پاسخ‌ها سر جایشان هستند؛ دوباره تلاش کن.'));
      }
    } finally {
      actionInFlightRef.current = false;
      setSaving(false);
    }
  }, [go, hydrating, personalizationAvailable, saveStep, step, validateStep]);

  const skipTaste = useCallback(async () => {
    if (hydrating || actionInFlightRef.current) return;
    setError(null);
    setPersonalizationChoice(false);
    go(REVIEW_STEP);
  }, [go, hydrating, setPersonalizationChoice]);

  const loadRecommendations = useCallback(async (endpoint = recommendationsEndpointRef.current) => {
    const requestId = ++recommendationsRequestIdRef.current;
    const requestSubject = subjectRef.current;
    recommendationsRequestedRef.current = true;
    setRecommendationsLoading(true);
    setRecommendationsError(null);
    try {
      const { data } = await apiClient.get(endpoint || '/recommendations?limit=3');
      if (requestId !== recommendationsRequestIdRef.current || subjectRef.current !== requestSubject) return;
      setRecommendations(normalizeRecommendations(data));
    } catch (requestError) {
      if (requestId !== recommendationsRequestIdRef.current || subjectRef.current !== requestSubject) return;
      setRecommendations([]);
      setRecommendationsError(messageFromError(requestError, 'پیشنهادها فعلاً بارگذاری نشدند؛ پروفایلت با موفقیت ذخیره شده است.'));
    } finally {
      if (requestId === recommendationsRequestIdRef.current && subjectRef.current === requestSubject) {
        setRecommendationsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!alreadyCompleted || step !== RESULT_STEP || recommendationsRequestedRef.current) return;
    loadRecommendations(recommendationsEndpointRef.current);
  }, [alreadyCompleted, loadRecommendations, step]);

  const complete = useCallback(async () => {
    if (hydrating || actionInFlightRef.current) return;
    if (!termsAccepted) {
      go(1);
      setError('برای ساخت حساب، پذیرش شرایط استفاده و آگاهی از حریم خصوصی لازم است.');
      return;
    }
    const safetyError = validateStep(2);
    const patternError = validateStep(3);
    const timeError = validateStep(4);
    if (safetyError || patternError || timeError) {
      go(safetyError ? 2 : patternError ? 3 : 4);
      setError(safetyError || patternError || timeError);
      return;
    }
    if (!token) {
      navigate('/login?mode=signup&from=/onboarding', { replace: true });
      return;
    }
    actionInFlightRef.current = true;
    const requestSubject = subjectRef.current;
    const effectivePersonalizationConsent = personalizationAvailable && personalizationConsent;
    setSaving(true);
    setError(null);
    try {
      const safetyRevision = await patchDraft('safety', safetyPayload());
      if (safetyRevision === null || subjectRef.current !== requestSubject) return;
      const preferencesRevision = await patchDraft('preferences', preferencesPayload());
      if (preferencesRevision === null || subjectRef.current !== requestSubject) return;
      const idempotencyKey = mutationId();
      const body = {
        schemaVersion: ONBOARDING_SCHEMA_VERSION,
        idempotencyKey,
        expectedRevision: revisionRef.current,
        consent: {
          personalization: effectivePersonalizationConsent,
          termsAccepted: true,
          termsPolicyVersion: CURRENT_TERMS_POLICY_VERSION,
          privacyPolicyVersion: CURRENT_PRIVACY_POLICY_VERSION,
        },
        taste: effectivePersonalizationConsent
          ? tastePayload()
          : { likedRecipeIds: [], dislikedRecipeIds: [] },
      };
      const request = () => apiClient.post('/onboarding/v2/complete', body);
      let response;
      try {
        response = await request();
      } catch (firstError) {
        if (subjectRef.current !== requestSubject) return;
        const retryable = !firstError?.response || Number(firstError?.response?.status) >= 500;
        if (!retryable) throw firstError;
        response = await request();
      }
      if (subjectRef.current !== requestSubject) return;
      updateRevision(response?.data?.profileRevision ?? response?.data?.profile?.revision ?? revisionRef.current);
      recommendationsEndpointRef.current = response?.data?.recommendationsEndpoint || '/recommendations?limit=3';
      nextPathRef.current = response?.data?.nextPath === '/app' ? '/' : (response?.data?.nextPath || '/');
      try {
        if (effectivePersonalizationConsent) localStorage.setItem('garnish.consent.personalization', 'true');
        else localStorage.removeItem('garnish.consent.personalization');
        if (sessionKey) sessionStorage.removeItem(sessionKey);
      } catch { /* storage is non-critical */ }
      await refreshUser?.().catch(() => null);
      setAlreadyCompleted(true);
      go(RESULT_STEP);
      await loadRecommendations(recommendationsEndpointRef.current);
    } catch (requestError) {
      if (Number(requestError?.response?.status) === 409) {
        setRevisionConflict(true);
        setError('نسخهٔ ذخیره‌شده تغییر کرده است. آخرین نسخه را بارگذاری کن و سپس دوباره تکمیل را بزن.');
      } else {
        setError(messageFromError(requestError, 'تکمیل پروفایل انجام نشد. چیزی از دست نرفته؛ دوباره تلاش کن.'));
      }
    } finally {
      actionInFlightRef.current = false;
      setSaving(false);
    }
  }, [go, hydrating, loadRecommendations, navigate, patchDraft, personalizationAvailable, personalizationConsent, preferencesPayload, refreshUser, safetyPayload, sessionKey, tastePayload, termsAccepted, token, updateRevision, validateStep]);

  const finish = useCallback(() => navigate(nextPathRef.current, { replace: true }), [navigate]);

  const summary = useMemo(() => {
    const safety = safetyPayload();
    return {
      safety: safety.status === 'none'
        ? 'آلرژی یا عدم‌تحمل ثبت نشده'
        : ([
          safety.allergyIds.length ? `آلرژی: ${allergenLabels(safety.allergyIds).join('، ')}` : null,
          safety.intoleranceIds.length ? `عدم تحمل: ${allergenLabels(safety.intoleranceIds).join('، ')}` : null,
        ].filter(Boolean).join(' · ') || 'آلرژی یا عدم‌تحمل ثبت نشده'),
      diet: optionLabel(PATTERN_OPTIONS, answers.dietPattern),
      rules: answers.dietaryRules.map((id) => optionLabel(DIETARY_RULE_OPTIONS, id, id)),
      time: optionLabel(COOKTIME_OPTIONS, answers.weekdayTimeBucket),
      cooksFor: optionLabel(COOKS_FOR_OPTIONS, answers.cooksForCount),
      tasteCount: answers.taste.likes.length + answers.taste.dislikes.length,
    };
  }, [answers, safetyPayload]);

  const canContinue = !hydrating && !saving && !validateStep(step);
  const stepMeta = STEP_META[step] || null;
  const progressTotal = personalizationAvailable ? QUESTION_STEP_TOTAL : QUESTION_STEP_TOTAL - 1;

  return {
    step,
    start,
    go,
    back,
    continueStep,
    skipTaste,
    answers,
    setSafetyNone,
    toggleAllergy,
    toggleIntolerance,
    setDietPattern,
    toggleDietaryRule,
    setWeekdayTimeBucket,
    setCooksForCount,
    addTaste,
    removeTaste,
    canContinue,
    stepMeta,
    progressIndex: Math.min(progressTotal, stepMeta?.index || progressTotal),
    progressTotal,
    hydrating,
    saving,
    error,
    statusMessage,
    summary,
    personalizationAvailable,
    personalizationConsent,
    setPersonalizationConsent: setPersonalizationChoice,
    termsAccepted,
    setTermsAccepted,
    complete,
    recommendations,
    recommendationsLoading,
    recommendationsError,
    retryRecommendations: loadRecommendations,
    revisionConflict,
    reloadDraft,
    alreadyCompleted,
    authed,
    finish,
  };
}
