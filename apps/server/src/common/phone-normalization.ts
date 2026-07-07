const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function normalizeIranMobile(value: unknown): string {
  let phone = String(value ?? '').trim();
  phone = phone.replace(/[۰-۹٠-٩]/g, (digit) => {
    const fa = FA_DIGITS.indexOf(digit);
    if (fa >= 0) return String(fa);
    const ar = AR_DIGITS.indexOf(digit);
    return ar >= 0 ? String(ar) : digit;
  });
  phone = phone.replace(/[\s\-()]/g, '');
  if (phone.startsWith('+98')) return `0${phone.slice(3)}`;
  if (phone.startsWith('0098')) return `0${phone.slice(4)}`;
  if (phone.startsWith('98') && phone.length === 12) return `0${phone.slice(2)}`;
  return phone;
}
