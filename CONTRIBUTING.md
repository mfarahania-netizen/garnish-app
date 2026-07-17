# قرارداد مشارکت

## قبل از تغییر

1. فقط از checkout اصلی و شاخهٔ `master` استفاده کنید؛ worktree یا clone موازی نسازید مگر با درخواست صریح مالک پروژه.
2. وضعیت Git و تغییرات موجود کاربر را بررسی و حفظ کنید.
3. ساده‌ترین تغییر لازم را انتخاب کنید؛ قابلیت نمایشی، endpoint دروغین و کنترل بدون backend اضافه نکنید.

## کیفیت و امنیت

- ورودی API باید DTO، validation، authorization و تست مرز مالکیت داشته باشد.
- secret، OTP، token، شمارهٔ کامل و دادهٔ خصوصی را log یا commit نکنید.
- عملیات consent، auth، delete/export و Household باید fail-closed باشند.
- success UI فقط بعد از acknowledgement واقعی backend نمایش داده شود.
- تست متمرکز دامنه، سپس `pnpm.cmd lint` و `pnpm.cmd build` در gate نهایی اجرا شود.

## اسناد و artifactها

- کد و تست مرجع وضعیت پیاده‌سازی‌اند.
- گزارش QA، screenshot، ZIP، log و handoff جدید را commit نکنید.
- اگر یک تصمیم معماریِ ماندگار تغییر کرد، فقط سند فعال مرتبط در [`docs/README.md`](docs/README.md) را به‌روز کنید.
- ریسک‌های واقعاً باز در [`docs/execution/RISK_REGISTER.md`](docs/execution/RISK_REGISTER.md) نگه‌داری می‌شوند.

## Git

- commitها کوچک، روشن و بدون secret باشند.
- تاریخچهٔ منتشرشده را force-push یا rewrite نکنید.
- قبل از push، working tree باید تمیز و build قابل تکرار باشد.
