import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';
import { enableAnalytics, disableAnalytics } from '../../lib/analytics-init';
import { CURRENT_PRIVACY_POLICY_VERSION } from '../../lib/consent-policy';
import { clearRecommendationAttribution } from '../../lib/recommendationAttribution';
import { PATTERN_OPTIONS, ALLERGEN_OPTIONS, ONBOARDING_ALLERGEN_OPTIONS } from '../onboarding/steps';
import { invalidateProfileDomain, queryKeys } from '../../lib/queryKeys';

/**
 * useSettings — the food-profile + consent + account editor.
 *
 * Honest persistence map (the backend is frozen):
 *  - dietary pattern + allergens  → PUT /users/preferences (diet + allergies JSON). The DTO has NO
 *    dislikes/severity field, so those are NOT shown here (no dead control) — documented.
 *  - consent (personalization, analytics) → GET/POST /users/consent. Server is the source of truth;
 *    localStorage is only an optimistic mirror for quick boot/analytics wiring.
 *  - notifications are intentionally not exposed as editable settings until a delivery service consumes them.
 *  - account: phone (GET /users/me), data export (GET /users/me/export), delete (DELETE /users/me).
 */

const PERS_KEY = 'garnish.consent.personalization';
const SUPPORTED_ALLERGEN_IDS = new Set(ONBOARDING_ALLERGEN_OPTIONS.map((option) => option.id));
const ALLERGEN_BY_ID = new Map(ALLERGEN_OPTIONS.map((option) => [option.id, option]));

export function useSettings() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: queryKeys.me, queryFn: () => apiClient.get('/users/me').then((r) => r.data) });
  const prefs = useQuery({ queryKey: queryKeys.preferences, queryFn: () => apiClient.get('/users/preferences').then((r) => r.data) });
  const serverConsent = useQuery({ queryKey: queryKeys.consent, queryFn: () => apiClient.get('/users/consent').then((r) => r.data) });

  const [pattern, setPattern] = useState('');
  const [allergens, setAllergens] = useState({}); // id → true
  // Historical declarations outside the currently audited option set remain
  // visible/removable and are never silently lost on an unrelated save.
  const [legacyAllergens, setLegacyAllergens] = useState([]);
  // Persisted mirrors are never canonical: a grant may have been withdrawn on another device.
  const [consent, setConsent] = useState({ personalization: false, analytics: false });
  const [consentActive, setConsentActive] = useState({ personalization: false, analytics: false });
  const [consentRuntimeAvailable, setConsentRuntimeAvailable] = useState({ personalization: false, analytics: false });
  const [consentHydrated, setConsentHydrated] = useState(false);
  const [consentWriteUnknown, setConsentWriteUnknown] = useState(false);
  const [consentBusy, setConsentBusy] = useState({ personalization: false, analytics: false });
  const [preferenceBusy, setPreferenceBusy] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const preferenceSnapshot = useRef({ pattern: '', allergens: {} });
  const preferenceWriteChain = useRef(Promise.resolve());
  const pendingPreferenceWrites = useRef(0);
  const deleteInFlight = useRef(false);
  const consentWrites = useRef(new Set());

  // hydrate the food profile from the real preferences and keep it synced after assistant/profile writes
  useEffect(() => {
    if (preferenceBusy || prefs.isLoading || prefs.isError) return;
    const allergyNames = (prefs.data?.allergies || []).map((a) => String(a).toLowerCase());
    const map = {};
    for (const o of ONBOARDING_ALLERGEN_OPTIONS) if (allergyNames.includes(o.id)) map[o.id] = true;
    setLegacyAllergens(allergyNames.filter((id) => !SUPPORTED_ALLERGEN_IDS.has(id) && ALLERGEN_BY_ID.has(id)));
    const nextPattern = prefs.data?.diet || '';
    preferenceSnapshot.current = { pattern: nextPattern, allergens: map };
    setPattern(nextPattern);
    setAllergens(map);
  }, [preferenceBusy, prefs.isLoading, prefs.isError, prefs.data]);

  useEffect(() => {
    if (serverConsent.isLoading || serverConsent.isFetching || serverConsent.isError || !serverConsent.data?.purposes) {
      disableAnalytics();
      clearRecommendationAttribution();
      setConsent({ personalization: false, analytics: false });
      setConsentActive({ personalization: false, analytics: false });
      setConsentRuntimeAvailable({ personalization: false, analytics: false });
      try { localStorage.setItem(PERS_KEY, 'false'); } catch { /* storage unavailable */ }
      setConsentHydrated(false);
      return;
    }
    const personalizationDecision = serverConsent.data.purposes.personalization;
    const analyticsDecision = serverConsent.data.purposes.analytics;
    const personalization = personalizationDecision?.granted === true
      && personalizationDecision?.policyVersion === CURRENT_PRIVACY_POLICY_VERSION;
    const analytics = analyticsDecision?.granted === true
      && analyticsDecision?.policyVersion === CURRENT_PRIVACY_POLICY_VERSION;
    const active = {
      personalization: personalization && personalizationDecision?.processingEnabled === true,
      analytics: analytics && analyticsDecision?.processingEnabled === true,
    };
    setConsent({ personalization, analytics });
    setConsentActive(active);
    setConsentRuntimeAvailable({
      personalization: personalizationDecision?.processingEnabled === true,
      analytics: analyticsDecision?.processingEnabled === true,
    });
    try { localStorage.setItem(PERS_KEY, JSON.stringify(active.personalization)); } catch { /* storage unavailable */ }
    if (!active.personalization) clearRecommendationAttribution();
    if (active.analytics) enableAnalytics(); else disableAnalytics();
    setConsentWriteUnknown(false);
    setConsentHydrated(true);
  }, [serverConsent.isLoading, serverConsent.isFetching, serverConsent.isError, serverConsent.data]);

  const flash = useCallback((message, icon) => { setToast({ message, icon, ts: Date.now() }); }, []);

  const savePreferences = useCallback((next) => {
    const snapshot = { pattern: next.pattern, allergens: { ...next.allergens } };
    pendingPreferenceWrites.current += 1;
    setPreferenceBusy(true);

    const write = preferenceWriteChain.current.then(async () => {
      try {
        // Unsupported historical values are deliberately omitted. The server preserves
        // them unless the dedicated DELETE endpoint is used, and its DTO rejects them on PUT.
        const body = {
          diet: snapshot.pattern || null,
          allergies: Object.keys(snapshot.allergens),
        };
        const saved = await apiClient.put('/users/preferences', body).then((r) => r.data);
        queryClient.setQueryData(queryKeys.preferences, saved);
        invalidateProfileDomain(queryClient);
        flash('تغییرات ذخیره شد', 'ok');
      } catch {
        flash('ذخیره نشد — دوباره تلاش کن', 'err');
      } finally {
        pendingPreferenceWrites.current -= 1;
        if (pendingPreferenceWrites.current === 0) setPreferenceBusy(false);
      }
    });
    preferenceWriteChain.current = write;
    return write;
  }, [flash, queryClient]);

  const choosePattern = useCallback((id) => {
    const current = preferenceSnapshot.current;
    const nextPattern = current.pattern === id ? '' : id;
    const next = { pattern: nextPattern, allergens: { ...current.allergens } };
    preferenceSnapshot.current = next;
    setPattern(nextPattern);
    void savePreferences(next);
  }, [savePreferences]);

  const toggleAllergen = useCallback((id) => {
    const current = preferenceSnapshot.current;
    const nextMap = { ...current.allergens };
    if (nextMap[id]) delete nextMap[id]; else nextMap[id] = true;
    const next = { pattern: current.pattern, allergens: nextMap };
    preferenceSnapshot.current = next;
    setAllergens(nextMap);
    void savePreferences(next);
  }, [savePreferences]);

  const removeLegacyAllergen = useCallback((id) => {
    pendingPreferenceWrites.current += 1;
    setPreferenceBusy(true);
    const removal = preferenceWriteChain.current.then(async () => {
      try {
        await apiClient.delete('/users/allergies', { data: { allergies: [id] } });
        setLegacyAllergens((prev) => prev.filter((value) => value !== id));
        queryClient.setQueryData(queryKeys.preferences, (current) => current ? ({
          ...current,
          allergies: (current.allergies || []).filter((value) => String(value).toLowerCase() !== id),
        }) : current);
        invalidateProfileDomain(queryClient);
        flash('حساسیت قدیمی حذف شد', 'ok');
      } catch {
        flash('حذف نشد — مورد ایمنی حفظ شد', 'err');
      } finally {
        pendingPreferenceWrites.current -= 1;
        if (pendingPreferenceWrites.current === 0) setPreferenceBusy(false);
      }
    });
    preferenceWriteChain.current = removal;
    return removal;
  }, [flash, queryClient]);

  const toggleConsent = useCallback(async (key) => {
    if (!['personalization', 'analytics'].includes(key)) return;
    if (
      !consentHydrated
      || consentWriteUnknown
      || serverConsent.isLoading
      || serverConsent.isFetching
      || serverConsent.isError
      || consentBusy[key]
      || consentWrites.current.has(key)
    ) return;
    const nextVal = !consent[key];
    const type = key === 'personalization' ? 'personalization' : 'analytics';
    consentWrites.current.add(key);
    setConsentBusy((state) => ({ ...state, [key]: true }));

    // Withdrawal is a local deny boundary. Apply it before any network await and never
    // restore an old grant merely because the acknowledgement times out.
    if (!nextVal) {
      setConsent((state) => ({ ...state, [key]: false }));
      setConsentActive((state) => ({ ...state, [key]: false }));
      if (key === 'analytics') disableAnalytics();
      if (key === 'personalization') {
        clearRecommendationAttribution();
        try { localStorage.setItem(PERS_KEY, 'false'); } catch { /* storage unavailable */ }
      }
    }
    try {
      const acknowledged = await apiClient
        .post('/users/consent', { type, granted: nextVal })
        .then((response) => response.data);
      const canonicalDecision = acknowledged?.purposes?.[type];
      const canonicalMatch = canonicalDecision?.granted === nextVal
        && canonicalDecision?.policyVersion === CURRENT_PRIVACY_POLICY_VERSION;
      if (!canonicalMatch) throw new Error('CONSENT_READBACK_MISMATCH');

      const runtimeAvailable = canonicalDecision?.processingEnabled === true;
      const active = nextVal && runtimeAvailable;
      setConsent((state) => ({ ...state, [key]: nextVal }));
      setConsentActive((state) => ({ ...state, [key]: active }));
      setConsentRuntimeAvailable((state) => ({ ...state, [key]: runtimeAvailable }));
      if (key === 'analytics') {
        if (active) enableAnalytics(); else disableAnalytics();
      }
      if (key === 'personalization') {
        if (!active) clearRecommendationAttribution();
        try { localStorage.setItem(PERS_KEY, JSON.stringify(active)); } catch { /* storage unavailable */ }
      }
      setConsentWriteUnknown(false);
      invalidateProfileDomain(queryClient);
      flash(nextVal ? 'رضایت ثبت شد' : 'رضایت لغو شد', 'ok');
    } catch {
      // A timeout can leave canonical state unknown. Keep the local runtime off and
      // require a fresh canonical read instead of reviving a possibly withdrawn grant.
      setConsent((state) => ({ ...state, [key]: false }));
      setConsentActive((state) => ({ ...state, [key]: false }));
      setConsentRuntimeAvailable((state) => ({ ...state, [key]: false }));
      if (key === 'analytics') disableAnalytics();
      if (key === 'personalization') {
        clearRecommendationAttribution();
        try { localStorage.setItem(PERS_KEY, 'false'); } catch { /* storage unavailable */ }
      }
      setConsentWriteUnknown(true);
      flash('ثبت نشد — برای بررسی وضعیت دوباره تلاش کن', 'err');
    } finally {
      consentWrites.current.delete(key);
      setConsentBusy((state) => ({ ...state, [key]: false }));
    }
  }, [
    consent,
    consentBusy,
    consentHydrated,
    consentWriteUnknown,
    flash,
    queryClient,
    serverConsent.isError,
    serverConsent.isFetching,
    serverConsent.isLoading,
  ]);

  const exportData = useCallback(async () => {
    setAccountBusy(true);
    try {
      const data = await apiClient.get('/users/me/export').then((r) => r.data);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = 'garnish-data.json';
      document.body.appendChild(link); link.click(); link.remove();
      URL.revokeObjectURL(url);
      flash('فایلِ خروجی آماده شد', 'ok');
    } catch {
      flash('خروجی نشد — دوباره امتحان کن', 'err');
    } finally {
      setAccountBusy(false);
    }
  }, [flash]);

  const deleteAccount = useCallback(async () => {
    if (deleteInFlight.current) return;
    deleteInFlight.current = true;
    setAccountBusy(true);
    try {
      await apiClient.delete('/users/me');
      logout();
      navigate('/login', { replace: true });
    } catch {
      deleteInFlight.current = false;
      flash('حذف نشد — دوباره امتحان کن', 'err');
      setAccountBusy(false);
    }
  }, [logout, navigate, flash]);

  const account = useMemo(() => ({ phone: me.data?.phone || '', email: me.data?.email || '' }), [me.data]);

  let status = 'ready';
  if (me.isLoading || me.isFetching || prefs.isLoading || prefs.isFetching) status = 'loading';
  else if (me.isError || prefs.isError) status = 'error';

  let consentStatus = 'ready';
  if (serverConsent.isLoading || serverConsent.isFetching) consentStatus = 'loading';
  else if (serverConsent.isError || consentWriteUnknown) consentStatus = 'error';
  else if (!consentHydrated) consentStatus = 'loading';

  const refetch = useCallback(() => {
    setConsentHydrated(false);
    setConsentWriteUnknown(false);
    setConsent({ personalization: false, analytics: false });
    setConsentActive({ personalization: false, analytics: false });
    setConsentRuntimeAvailable({ personalization: false, analytics: false });
    disableAnalytics();
    clearRecommendationAttribution();
    try { localStorage.setItem(PERS_KEY, 'false'); } catch { /* storage unavailable */ }
    me.refetch();
    prefs.refetch();
    serverConsent.refetch();
  }, [me, prefs, serverConsent]);

  return {
    status,
    consentStatus,
    refetch,
    patternOptions: PATTERN_OPTIONS,
    allergenOptions: ONBOARDING_ALLERGEN_OPTIONS,
    legacyAllergenOptions: legacyAllergens.map((id) => ALLERGEN_BY_ID.get(id)).filter(Boolean),
    pattern, allergens, choosePattern, toggleAllergen, removeLegacyAllergen,
    consent, consentActive, consentRuntimeAvailable, toggleConsent, consentBusy,
    account, exportData, deleteAccount,
    busy: preferenceBusy || accountBusy, toast,
  };
}
