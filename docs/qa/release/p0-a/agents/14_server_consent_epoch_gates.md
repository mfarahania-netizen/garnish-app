# Agent 14 — Server consent grant-epoch gates

## Verdict

`[قطعی] PASS (focused boundary)` — analytics و personalization اکنون یک grant epoch مشترک، latest-decision/current-policy/runtime-aware دارند. outbox و exposure از همان مرز زمانی استفاده می‌کنند؛ withdrawal و regrant نمی‌تواند event یا exposure قدیمی را دوباره وارد personalization کند.

## تغییرات

### ConsentService

- API عمومی `currentGrantEpoch(userId, purposes)` اضافه شد.
- برای همهٔ purposeهای خواسته‌شده، runtime باید روشن، آخرین تصمیم `granted` و policy version جاری باشد.
- خروجی، بیشینهٔ `createdAt` آخرین grantهای معتبر است؛ missing/withdrawn/stale-policy/runtime-OFF/read-error همگی `null` می‌دهند.

### EventOutboxService

- `enqueue` پیش از `eventOutbox.create`، event موجود و personalization-provenance را بررسی می‌کند و current analytics+personalization epoch می‌خواهد.
- event قدیمی‌تر از بیشینهٔ grant epoch هرگز enqueue نمی‌شود.
- `processNow` و `drain` هر دو analytics+personalization و همان epoch را دوباره بررسی می‌کنند.
- withdrawal جاری، analytics withdrawal و regrant پس از event، row را terminally suppress می‌کنند و router فراخوانی نمی‌شود.

### ExposureTrackingService

- `getPenalty`, `getPenalties` و `getExposureMemory` همگی query را از بیشینهٔ current grant epoch محدود می‌کنند؛ exposure/event قدیمی وارد penalty یا memory نمی‌شود.
- writeهای single و batch پیش از persistence epoch را می‌گیرند و پس از persistence دوباره consent+epoch را می‌خوانند.
- اگر consent حذف شود یا epoch تغییر کند، فقط UUIDهای ساخته‌شده توسط همان call حذف می‌شوند؛ حذف user-wide انجام نمی‌شود و method مقدار `false/0` برمی‌گرداند.

### RecommendationController

- impression ابتدا از `AnalyticsService.trackEvent` عبور می‌کند.
- exposure فقط برای recipeهایی نوشته می‌شود که AnalyticsService event با `consentPurpose='personalization'` برگردانده باشد.
- analytics-only پاسخ accepted ولی `learned:false` می‌دهد؛ null/withdrawal هیچ exposure write ندارد و پاسخ denied صادقانه باقی می‌ماند.

## Verification

```text
pnpm.cmd --dir apps/server exec jest --runInBand \
  src/consent/consent.service.spec.ts \
  src/behavior-engine/routing/event-outbox.service.spec.ts \
  src/recommendation/exposure/exposure-tracking.service.spec.ts \
  src/recommendation/recommendation.controller.spec.ts

Test Suites: 4 passed, 4 total
Tests:       56 passed, 56 total
```

پوشش مستقیم شامل max latest grant epoch، analytics withdrawal، regrant-old-event suppression، enqueue zero-write، old-exposure exclusion، post-write compensation و analytics-first ordering است.

- `[قطعی]` server build: PASS (`prisma generate` + `nest build`).
- `[قطعی]` focused ESLint `--quiet`: exit 0.
- `[قطعی]` targeted `git diff --check`: PASS.
- `[قطعی]` stage/commit/push انجام نشد.

## Concurrent diagnostic

`recommendation-requestid-capstone.spec.ts` پس از build به‌عنوان integration diagnostic اجرا شد، اما پیش از اجرای تست با خطای concurrent خارج از scope متوقف شد:

```text
feature-store.service.ts:119 TS2554
getDataMaturity expected 1 argument, call supplied 2
```

`[قطعی]` این خطا متعلق به فایل‌های این lane نیست؛ coordinator اعلام کرد owner دیگر آن را رفع می‌کند.

## Residual risks

- `[احتمالاً]` یک race بسیار باریک پس از آخرین consent recheck و قبل/حین مصرف downstream باقی می‌ماند؛ حذف کامل آن به transaction/locking یا ثبت consent epoch روی derived rows نیاز دارد.
- `[قطعی]` اگر compensating DELETE دیتابیس fail شود، write method خطا می‌دهد و موفقیت کاذب گزارش نمی‌کند، اما row درج‌شده ممکن است نیازمند cleanup عملیاتی باشد.
- `[قطعی]` این lane retention/deletion همهٔ داده‌های قدیمی پس از withdrawal را انجام نمی‌دهد؛ فقط replay/read جدید را از grant epoch جاری محدود می‌کند.

## نتیجهٔ عملی

این boundary برای review/freeze آماده است. پس از رفع compile regression هم‌زمان، capstone و full-suite مشترک باید دوباره اجرا شوند.
