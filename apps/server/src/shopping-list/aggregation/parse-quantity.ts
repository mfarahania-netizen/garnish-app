/**
 * Peel a quantity off a free shopping item so the amount never sticks to the name (founder: «خیار دو کیلو» should be
 * name «خیار» + amount «دو کیلو», not one literal name). Deterministic — used by BOTH the manual/free add path and the
 * AI add tool, so every entry point splits consistently. «دو کیلو سبزی خوردن» → {name:'سبزی خوردن', amount:'دو کیلو'};
 * «خیار» → {name:'خیار'}.
 */
const QTY_WORDS = 'یک|یه|دو|سه|چهار|پنج|شش|شیش|هفت|هشت|نه|ده|نیم|ربع|چند|چندتا';
const QTY_UNITS = 'کیلوگرمی|کیلوگرم|کیلو|گرمی|گرم|تایی|تا|عددی|عدد|بسته‌ای|بسته|شیشه|قوطی|حلب|لیتری|لیتر|بطری|فنجان|قاشق|پیمانه|کیسه|پاکت|مثقال';
// peel an orphan unit the model/user sometimes leaves at the name's edge («کیلو موز» → «موز»).
const stripOrphanUnit = (name: string): string =>
  name.replace(new RegExp(`^(?:${QTY_UNITS})\\s+`), '').replace(new RegExp(`\\s+(?:${QTY_UNITS})$`), '').trim();

export function splitQuantity(raw: string): { name: string; amount?: string } {
  const s = String(raw ?? '').trim();
  if (!s) return { name: s };
  const digit = '[\\d۰-۹]+(?:[.,٫][\\d۰-۹]+)?';
  const qty = `(?:${digit}|${QTY_WORDS})(?:\\s*(?:${QTY_UNITS}))?`;
  let m = s.match(new RegExp(`^(${qty})\\s+(.{2,})$`)); // leading: «۵۰۰ گرم گوشت چرخ‌کرده»
  if (m) return { name: stripOrphanUnit(m[2].trim()) || m[2].trim(), amount: m[1].trim() };
  m = s.match(new RegExp(`^(.{2,}?)\\s+(${qty})$`)); // trailing: «سبزی خوردن دو کیلو»
  if (m && new RegExp(`${digit}|${QTY_UNITS}`).test(m[2])) return { name: stripOrphanUnit(m[1].trim()) || m[1].trim(), amount: m[2].trim() };
  return { name: stripOrphanUnit(s) || s };
}
