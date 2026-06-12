// apps/web/src/i18n/I18nProvider.jsx
// E41 — i18n skeleton (EN-first ready), dependency-free. A thin React-context
// translator with EN/FA catalogs, localStorage-persisted language, and automatic
// document dir/lang. Designed to be swappable for react-i18next later without
// changing call sites (see useTranslation()). String migration is gradual (E41/E46).
import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import en from './locales/en.json';
import fa from './locales/fa.json';

const CATALOGS = { en, fa };
const DEFAULT_LANG = 'fa';
const FALLBACK_LANG = 'en';
const STORAGE_KEY = 'garnish.lang';

export const I18nContext = createContext(null);

function getNested(obj, keyPath) {
  return keyPath
    .split('.')
    .reduce((acc, k) => (acc && typeof acc === 'object' ? acc[k] : undefined), obj);
}

function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored && CATALOGS[stored] ? stored : DEFAULT_LANG;
    } catch {
      return DEFAULT_LANG;
    }
  });

  useEffect(() => {
    const dir = lang === 'fa' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang]);

  const setLang = useCallback((next) => {
    if (!CATALOGS[next]) return;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable — language just won't persist */
    }
    setLangState(next);
  }, []);

  const t = useCallback(
    (key, vars) => {
      const fromLang = getNested(CATALOGS[lang], key);
      const value = fromLang ?? getNested(CATALOGS[FALLBACK_LANG], key);
      return interpolate(typeof value === 'string' ? value : key, vars);
    },
    [lang],
  );

  const value = useMemo(
    () => ({ lang, setLang, t, available: Object.keys(CATALOGS) }),
    [lang, setLang, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
