const faDigits = (value) => String(value ?? '').replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);

const stepLabel = (count, noun) => (count > 0 ? `${faDigits(count)} مرحله ${noun}` : '');

export function getRecipeActionCopy(mode, count = 0) {
  const copy = {
    COOK: {
      primaryLabel: 'شروع پخت',
      stepLabel: stepLabel(count, 'پخت'),
      shouldShowStickyCta: true,
      shouldOpenGuidedMode: true,
    },
    PREPARE: {
      primaryLabel: 'شروع آماده‌سازی',
      stepLabel: stepLabel(count, 'آماده‌سازی'),
      shouldShowStickyCta: true,
      shouldOpenGuidedMode: true,
    },
    ASSEMBLE: {
      primaryLabel: 'آماده‌اش کن',
      stepLabel: stepLabel(count, 'آماده‌سازی'),
      shouldShowStickyCta: true,
      shouldOpenGuidedMode: true,
    },
    DRINK: {
      primaryLabel: 'درستش کن',
      stepLabel: stepLabel(count, 'آماده‌سازی'),
      shouldShowStickyCta: true,
      shouldOpenGuidedMode: true,
    },
    NO_COOK_SIMPLE: {
      primaryLabel: 'جزئیات آماده‌سازی',
      stepLabel: count > 0 ? stepLabel(count, 'آماده‌سازی') : 'راهنمای کوتاه',
      shouldShowStickyCta: false,
      shouldOpenGuidedMode: false,
    },
  };
  return copy[mode] || copy.COOK;
}
