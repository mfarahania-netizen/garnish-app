import LegalPage from '../legal/LegalPage';

// Honest, plain-Persian privacy notice reflecting Garnish's actual data practices (consent-based profiling,
// safety-critical allergens, export/erasure rights) — not fabricated boilerplate.
const SECTIONS = [
  { heading: 'چه داده‌ای جمع می‌شود', body: 'پروفایلِ ذائقهٔ شما از رفتارِ آشپزی‌تان در اپ (با رضایتِ خودتان) ساخته می‌شود؛ همچنین حساسیت‌ها و ترجیحاتی که خودتان اعلام می‌کنید.' },
  { heading: 'چرا', body: 'برای شخصی‌سازی پیشنهادها و برای ایمنی — مثل علامت‌زدنِ موادِ حساسیت‌زای اعلام‌شده در دستورها.' },
  { heading: 'کنترلِ شما', body: 'می‌توانید داده‌های پروفایل‌تان را ببینید، خروجی بگیرید یا حذف کنید. ساختِ پروفایلِ ذائقه با رضایتِ شماست و قابل لغو است.' },
  { heading: 'اشتراک‌گذاری', body: 'داده‌های شخصیِ شما فروخته نمی‌شود. اطلاعات تنها برای کارکردِ خودِ اپ استفاده می‌شود.' },
  { heading: 'نگه‌داری', body: 'داده‌ها تا زمانی که حسابِ شما فعال است نگه داشته می‌شوند؛ با حذفِ حساب یا درخواستِ پاک‌سازی، حذف می‌شوند.' },
];

export default function PrivacyPage() {
  return <LegalPage title="حریم خصوصی" updated="۱۴۰۵/۰۳/۲۹" intro="حریم خصوصیِ شما برای ما مهم است. خلاصهٔ کارِ گارنیش با داده‌های شما:" sections={SECTIONS} />;
}
