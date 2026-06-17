import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';
import { getAnalyticsConsent, enableAnalytics, disableAnalytics } from '../../lib/analytics-init';
import { PATTERN_OPTIONS, ALLERGEN_OPTIONS } from '../onboarding/steps';

/**
 * useSettings — the food-profile + notification + consent + account editor.
 *
 * Honest persistence map (the backend is frozen):
 *  - dietary pattern + allergens  → PUT /users/preferences (diet + allergies JSON). The DTO has NO
 *    dislikes/severity field, so those are NOT shown here (no dead control) — documented.
 *  - consent (personalization, analytics) → POST /users/consent {type, granted} (real revoke/grant).
 *    There is no FE endpoint to READ server consent, so toggle state is mirrored locally (localStorage;
 *    analytics reuses the real 'garnish.analyticsConsent') — revoke still truly POSTs.
 *  - notification prefs → localStorage (no backend prefs endpoint) — honest client-side persistence.
 *  - account: phone (GET /users/me), data export (GET /users/me/export), delete (DELETE /users/me).
 */

const NOTIF_KEY = 'garnish.notifPrefs';
const PERS_KEY = 'garnish.consent.personalization';
const readJson = (k, fallback) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
const DEFAULT_NOTIF = { briefing: true, streak: true, reengage: false, quiet: true };

export function useSettings() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const me = useQuery({ queryKey: ['home', 'me'], queryFn: () => apiClient.get('/users/me').then((r) => r.data) });
  const prefs = useQuery({ queryKey: ['discover', 'preferences'], queryFn: () => apiClient.get('/users/preferences').then((r) => r.data) });

  const [pattern, setPattern] = useState('');
  const [allergens, setAllergens] = useState({}); // id → true
  const [notif, setNotif] = useState(() => ({ ...DEFAULT_NOTIF, ...readJson(NOTIF_KEY, {}) }));
  const [consent, setConsent] = useState(() => ({
    // conservative default: never assert a grant we can't verify (onboarding seeds this on real grant)
    personalization: readJson(PERS_KEY, false),
    analytics: (typeof getAnalyticsConsent === 'function' ? getAnalyticsConsent() : null) === 'granted',
  }));
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  // hydrate the food profile from the real preferences once
  useEffect(() => {
    if (hydrated || prefs.isLoading || prefs.isError) return;
    const allergyNames = (prefs.data?.allergies || []).map((a) => String(a).toLowerCase());
    const map = {};
    for (const o of ALLERGEN_OPTIONS) if (allergyNames.includes(o.id)) map[o.id] = true;
    setPattern(prefs.data?.diet || '');
    setAllergens(map);
    setHydrated(true);
  }, [hydrated, prefs.isLoading, prefs.isError, prefs.data]);

  const flash = useCallback((message, icon) => { setToast({ message, icon, ts: Date.now() }); }, []);

  const savePreferences = useCallback(async (next) => {
    setBusy(true);
    try {
      const body = {};
      if (next.pattern) body.diet = next.pattern;
      body.allergies = JSON.stringify(Object.keys(next.allergens));
      await apiClient.put('/users/preferences', body);
      flash('تغییرات ذخیره شد', 'ok');
    } catch {
      flash('ذخیره نشد — تغییرات محلی نگه داشته شد', 'err');
    } finally {
      setBusy(false);
    }
  }, [flash]);

  const choosePattern = useCallback((id) => {
    setPattern(id);
    savePreferences({ pattern: id, allergens });
  }, [allergens, savePreferences]);

  const toggleAllergen = useCallback((id) => {
    setAllergens((prev) => {
      const nextMap = { ...prev };
      if (nextMap[id]) delete nextMap[id]; else nextMap[id] = true;
      savePreferences({ pattern, allergens: nextMap });
      return nextMap;
    });
  }, [pattern, savePreferences]);

  const toggleNotif = useCallback((key) => {
    setNotif((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(NOTIF_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
      flash('تغییرات ذخیره شد', 'ok');
      return next;
    });
  }, [flash]);

  const toggleConsent = useCallback(async (key) => {
    const prev = consent[key];
    const nextVal = !prev;
    setConsent((c) => ({ ...c, [key]: nextVal }));
    const type = key === 'personalization' ? 'personalization' : 'analytics';
    if (key === 'analytics') { if (nextVal) enableAnalytics(); else disableAnalytics(); }
    if (key === 'personalization') { try { localStorage.setItem(PERS_KEY, JSON.stringify(nextVal)); } catch { /* */ } }
    try {
      await apiClient.post('/users/consent', { type, granted: nextVal });
      flash(nextVal ? 'رضایت ثبت شد' : 'رضایت لغو شد', 'ok');
    } catch {
      // revert — never show a successful-looking consent change that did not persist server-side
      setConsent((c) => ({ ...c, [key]: prev }));
      if (key === 'analytics') { if (prev) enableAnalytics(); else disableAnalytics(); }
      if (key === 'personalization') { try { localStorage.setItem(PERS_KEY, JSON.stringify(prev)); } catch { /* */ } }
      flash('ثبت نشد — دوباره امتحان کن', 'err');
    }
  }, [consent, flash]);

  const exportData = useCallback(async () => {
    setBusy(true);
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
      setBusy(false);
    }
  }, [flash]);

  const deleteAccount = useCallback(async () => {
    setBusy(true);
    try {
      await apiClient.delete('/users/me');
      logout();
      navigate('/onboarding', { replace: true });
    } catch {
      flash('حذف نشد — دوباره امتحان کن', 'err');
      setBusy(false);
    }
  }, [logout, navigate, flash]);

  const account = useMemo(() => ({ phone: me.data?.phone || '', email: me.data?.email || '' }), [me.data]);

  let status = 'ready';
  if (me.isLoading || prefs.isLoading) status = 'loading';
  else if (me.isError) status = 'error';

  return {
    status,
    refetch: () => { me.refetch(); prefs.refetch(); },
    patternOptions: PATTERN_OPTIONS, allergenOptions: ALLERGEN_OPTIONS,
    pattern, allergens, choosePattern, toggleAllergen,
    notif, toggleNotif,
    consent, toggleConsent,
    account, exportData, deleteAccount,
    busy, toast,
  };
}
