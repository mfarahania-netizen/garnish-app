// apps/web/src/i18n/useTranslation.js
// E41 — translation hook. Mirrors the react-i18next surface (`t`, language
// controls) so migrating to that library later is a drop-in change.
import { useContext } from 'react';
import { I18nContext } from './I18nProvider';

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useTranslation must be used within <I18nProvider>');
  return ctx;
}
