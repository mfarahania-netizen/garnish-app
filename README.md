# Garnish

Garnish یک اپلیکیشن فارسیِ پیشنهاد غذا، دستور پخت، برنامهٔ هفتگی، خرید و شخصی‌سازی غذایی است. این مخزن شامل وب React/Vite، API مبتنی بر NestJS و schema/migrationهای Prisma است.

## اجرای محلی

پیش‌نیازها: Node.js 18+، pnpm 9، PostgreSQL و Redis.

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd --dir apps/server db:generate
pnpm.cmd --dir apps/server exec prisma migrate deploy
pnpm.cmd dev
```

- وب: `http://localhost:5173`
- API: `http://localhost:3000`

مقادیر واقعی secret را فقط در فایل‌های `.env` محلی نگه دارید؛ `.env.example` قرارداد متغیرهاست و نباید secret داشته باشد.

برای پایلوت Household Core این سه مقدار نیز لازم‌اند:

```dotenv
VITE_HOUSEHOLD_V1_ENABLED=true
HOUSEHOLD_V1_ENABLED=true
HOUSEHOLD_INVITE_PEPPER=<random-secret-at-least-32-characters>
```

پس از تغییر متغیرهای Vite یا server هر دو سرویس را restart کنید.

## کنترل کیفیت

```powershell
pnpm.cmd lint
pnpm.cmd build
pnpm.cmd --dir apps/server test -- --runInBand
pnpm.cmd --dir apps/web test
```

برای تغییر کوچک ابتدا تست‌های همان دامنه را اجرا کنید؛ suite کامل فقط در gate نهایی لازم است.

## ساختار

- `apps/web` — رابط کاربری و PWA
- `apps/server` — API، auth، Household، recommendation و jobs
- `apps/server/prisma` — schema و migrationها
- `data` — داده و قراردادهای import
- `docs` — فقط قراردادهای فعال و اسناد معماری؛ گزارش‌های تاریخی و screenshotهای QA در Git نگه‌داری نمی‌شوند

فهرست اسناد فعال: [`docs/README.md`](docs/README.md)

## روش کار این مخزن

این نمونهٔ در حال توسعه با یک checkout و شاخهٔ `master` نگه‌داری می‌شود. worktree، clone آزمایشی، branch و artifact دائمی جدید نسازید مگر مالک پروژه صریحاً همان مورد را درخواست کند. خروجی‌های تست، log، screenshot و ZIP محلی و موقت‌اند.
