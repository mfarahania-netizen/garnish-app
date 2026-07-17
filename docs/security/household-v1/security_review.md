# مرور امنیت و حریم خصوصی Household Core

وضعیت: **پیاده‌سازی‌شده برای پایلوت محدود؛ آمادهٔ عرضهٔ عمومی نیست.**

## کنترل‌های تأییدشده

- همهٔ endpointهای Household زیر JWT guard هستند.
- هر read/write با `userId + householdId` و عضویت فعال scope می‌شود؛ عملیات مالک فقط برای owner مجاز است.
- دعوت به HMAC شمارهٔ تأییدشده bind می‌شود؛ token و شمارهٔ خام در persistence، response، event یا log ذخیره نمی‌شوند.
- mutationهای حساس از idempotency/version checks استفاده می‌کنند و DTOها با whitelist و `forbidNonWhitelisted` محدودند.
- حذف حسابِ مالکِ خانهٔ مشترک تا انتقال صریح مالکیت متوقف می‌شود.
- پاسخ‌های خصوصی با `no-store` و cache clearing محافظت می‌شوند.

## پیش‌نیاز اجرای پایلوت

- `VITE_HOUSEHOLD_V1_ENABLED=true`
- `HOUSEHOLD_V1_ENABLED=true`
- `HOUSEHOLD_INVITE_PEPPER` تصادفی و حداقل ۳۲ کاراکتر
- اعمال migrationهای Prisma و restart هر دو سرویس

## محدودیت‌های باز پیش از عرضهٔ عمومی

1. حساب Google بدون شمارهٔ متصل و تأییدشده نمی‌تواند Household بسازد یا دعوت بپذیرد؛ attach-phone اتمیک با OTP و سیاست merge لازم است.
2. دعوت هنوز delivery واقعی SMS/push و hint قابل‌تشخیص با retention محدود ندارد؛ مسیر share/delivery باید تکمیل شود.
3. push notification، realtime چنددستگاهی، pantry و meal-board کامل جزو این هستهٔ پایلوت نیستند و نباید در UI ادعا شوند.

ماتریس field-level و retention پیشنهادی در [`privacy_scope_matrix.csv`](privacy_scope_matrix.csv) است. هر قابلیت تازه باید پیش از فعال‌شدن، همان ماتریس و تست‌های permission/IDOR را به‌روز کند.
