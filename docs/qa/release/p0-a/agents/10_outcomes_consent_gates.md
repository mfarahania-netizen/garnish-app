# Agent 10 — Weekly outcomes consent gates

## Verdict

`[قطعی] PASS (focused lane)` — هر سه job هفتگی outcomes اکنون برای هر user، پیش از هر meal-plan، shopping-item یا outcome read/write، consent canonical و current-policy مربوط به `personalization` را بررسی می‌کنند. deny و consent-read error هر دو صفر sensitive IO دارند.

## Reality check

`[قطعی]` این jobها قبلاً تمام کاربران را بدون consent gate پردازش می‌کردند و از meal/shopping activity، outcome مشتق و ذخیره می‌کردند. analytics consent برای چنین profiling کافی نیست؛ purpose لازم `personalization` است.

## تغییرات

- `HealthOutcomeService.calculateWeeklyHealthOutcomes`: per-user `ConsentService.hasPurpose(userId, 'personalization')` پیش از `mealPlan.count` و تمام `userOutcome` read/write.
- `BehaviorOutcomeService.calculateWeeklyBehaviorOutcomes`: همان gate پیش از `shoppingItem.findMany` و outcome IO.
- `AdherenceOutcomeService.calculateWeeklyAdherenceOutcomes`: همان gate پیش از `mealPlan.count` و outcome IO.
- rejection یا unavailable بودن consent ledger با `.catch(() => false)` به deny تبدیل می‌شود و loop برای سایر userها ادامه می‌یابد.
- `OutcomesModule` اکنون `ConsentModule` را import می‌کند تا هر سه service منبع canonical یکسان داشته باشند.

## تست متمرکز

فرمان:

```text
npm.cmd test -- --runInBand src/outcomes/outcomes.consent-gate.spec.ts
```

نتیجه:

```text
Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total
```

پوشش:

1. deny برای هر سه service: سه consent check، صفر meal-plan read، صفر shopping read و صفر outcome read/write.
2. consent read error برای هر سه service: jobها throw نمی‌کنند و sensitive IO صفر می‌ماند.
3. current grant: هر سه محاسبه اجرا می‌شوند و `meal_consistency=25`، `shopping_efficiency=50` و `goal_adherence=25` نوشته می‌شوند.

## Build و lint

- `[قطعی]` server build: PASS.
- `[قطعی]` focused ESLint: exit code 0 و صفر error؛ warningهای non-blocking legacy/prettier و test-fixture typing باقی‌اند.
- `[قطعی]` هیچ تستی ضعیف یا skip نشد.

## محدودیت و ریسک باقی‌مانده

- `[قطعی]` لیست حداقلی user IDها پیش از per-user gate خوانده می‌شود؛ هیچ meal/shopping/outcome data پیش از gate خوانده یا نوشته نمی‌شود.
- `[احتمالاً]` withdrawal کاملاً هم‌زمان پس از consent check و پیش از آخرین write یک race باریک دارد. حذف کامل آن به transaction/locking یا job-claim design نیاز دارد و خارج از این تغییر محدود است.
- `[قطعی]` این gate outcomeهای قبلاً ذخیره‌شده را حذف نمی‌کند؛ retention/deletion پس از withdrawal سیاست data-lifecycle جداگانه می‌خواهد.
- `[قطعی]` هیچ migration، production DB operation، stage یا commit توسط این agent انجام نشد.

## فایل‌ها

- `apps/server/src/outcomes/health-outcome.service.ts`
- `apps/server/src/outcomes/behavior-outcome.service.ts`
- `apps/server/src/outcomes/adherence-outcome.service.ts`
- `apps/server/src/outcomes/outcomes.module.ts`
- `apps/server/src/outcomes/outcomes.consent-gate.spec.ts`

## نتیجهٔ عملی

lane outcomes برای ادغام در branch P0-A آماده است؛ coordinator باید focused result را با full server suite و gate نهایی release جمع‌بندی کند.
