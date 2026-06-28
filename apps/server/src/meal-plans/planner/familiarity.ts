// Curated «famous, beloved» Persian dishes — the ones a general audience (including a Dutch newcomer) actually knows and
// wants to see first. The meal-plan ranking had NO popularity/familiarity signal, so it surfaced obscure regional stews
// (e.g. «آبگوشت متنجنه کرمانی») above «قرمه‌سبزی / کباب کوبیده / زرشک‌پلو» — a poor first impression. This boosts the famous
// ones to the top, especially for a new user with no taste history. Stems are matched ZWNJ/space-insensitively against the
// recipe title; both قرمه/قورمه-style spellings are included so DB spelling never matters.
import { norm } from '../../ai/tools/grounding-utils';

const FAMOUS_STEMS = [
  // خورش‌ها
  'قرمه', 'قورمه', 'قیمه', 'فسنجان', 'کرفس', 'بادمجان', 'مسما', 'هویج',
  // پلوها / چلوها
  'زرشک پلو', 'باقالی پلو', 'لوبیا پلو', 'عدس پلو', 'سبزی پلو', 'شیرین پلو', 'ته چین', 'استانبولی', 'دمپخت', 'کلم پلو', 'آلبالو پلو', 'ماش پلو', 'چلو', 'کته', 'لوبیاپلو',
  // کباب‌ها
  'کوبیده', 'جوجه', 'کباب برگ', 'شیشلیک', 'کباب تابه', 'چنجه', 'بختیاری', 'کباب',
  // کوکو / کتلت / شامی / میرزا
  'کوکو', 'کتلت', 'شامی', 'میرزا', 'کشک بادمجان',
  // آش / سوپ / حبوبات / آبگوشت کلاسیک
  'آش رشته', 'آش شله', 'عدسی', 'حلیم', 'دیزی', 'سوپ جو', 'خوراک لوبیا',
  // صبحانه
  'املت', 'نیمرو', 'نان و پنیر', 'خاگینه', 'کله پاچه', 'حلوا', 'فرنی', 'شیر برنج', 'عسل',
  // کوفته / دلمه / پاستا و محبوب‌های روزمره
  'دلمه', 'کوفته', 'ماکارونی', 'لازانیا', 'سالاد شیرازی', 'الویه', 'پیتزا', 'برگر', 'اسپاگتی',
].map(norm);

/** True when the dish is a well-known/beloved one that should lead the list (vs an obscure regional dish). */
export function isFamiliarDish(title: string): boolean {
  const t = norm(title);
  if (!t) return false;
  return FAMOUS_STEMS.some((f) => f && t.includes(f));
}
