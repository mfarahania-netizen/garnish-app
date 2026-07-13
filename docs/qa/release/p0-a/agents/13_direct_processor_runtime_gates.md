# Agent 13 — Direct processor runtime gates

## Verdict

`[قطعی] PASS (focused boundary)` — تمام direct public entry pointهای تعیین‌شده اکنون در حالت personalization runtime OFF، در اولین خط اجرایی و پیش از dedupe/read/write متوقف می‌شوند. خروجی‌ها خنثی‌اند و تست مستقیم، صفر DB/downstream call را اثبات می‌کند.

## تغییرات production

- `EventRouterService.route`: خروجی `undefined`؛ حتی `registry.get` فراخوانی نمی‌شود.
- پنج processor (`recipe`, `recommendation`, `meal-plan`, `shopping`, `personalization`): خروجی `undefined` پیش از `alreadyConsumed`، DB IO و `SignalCalculatorService`.
- `SignalCalculatorService`:
  - `updateSignal`: خروجی `null` و صفر read/upsert.
  - `applyNegativeFeedback`, `applyPositiveFeedback`, `applyIngredientPreference`: خروجی `undefined` و صفر recipe/corpus/signal IO.
- `IdentityDimensionBuilder.buildAll`: خروجی `[]` و صفر snapshot/signal read یا dimension upsert.
- `LifestyleGraphBuilder.build`: خروجی `{}` و صفر profile read.
- `LifestyleGraphBuilder.getPrimaryLabel`: خروجی خنثی `Balanced User` پیش از nested `build`.

در همهٔ موارد از `isOptionalPurposeRuntimeEnabled('personalization')` استفاده شده است. هیچ consent epoch، refactor گسترده یا cleanup جدیدی در این lane اضافه نشد.

## تست‌های اضافه‌شده

- `behavior-engine/routing/event-router.service.spec.ts`
- `behavior-engine/processors/direct-processor-runtime-gates.spec.ts`
- `behavior-engine/signals/signal-calculator.service.spec.ts`
- `behavior-engine/identity/identity-dimension.builder.spec.ts`
- `lifestyle/lifestyle-graph.builder.spec.ts`

تست processor با eventهای mutation-heavy برای هر پنج processor اجرا می‌شود و تمام mockهای DB و calculator را `not.toHaveBeenCalled()` بررسی می‌کند.

## سازگاری تست‌های runtime ON

برای semantic specهای موجود opt-in صریح `OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED=true` اضافه شد؛ assertionها تغییر نکردند. با مجوز coordinator سه spec بیرون از مسیر ownership نیز فقط برای همین opt-in اصلاح شدند:

- `recommendation/recommendation-requestid-capstone.spec.ts`
- `recommendation/pipeline/l0-loop.integration.spec.ts`
- `recommendation/pipeline/fi-phase-2-3-ingredient-soft-taste.spec.ts`

در capstone، تغییر هم‌زمان `AnalyticsService` اکنون `userEvent.update` را برای provenance فراخوانی می‌کند. با مجوز coordinator فقط mock stateful همان متد اضافه شد؛ production code و assertionها تغییر نکردند.

## Verification

### Direct OFF gates

```text
pnpm.cmd --dir apps/server exec jest --runInBand \
  src/behavior-engine/routing/event-router.service.spec.ts \
  src/behavior-engine/processors/direct-processor-runtime-gates.spec.ts \
  src/behavior-engine/signals/signal-calculator.service.spec.ts \
  src/behavior-engine/identity/identity-dimension.builder.spec.ts \
  src/lifestyle/lifestyle-graph.builder.spec.ts

Test Suites: 5 passed, 5 total
Tests:       13 passed, 13 total
```

### Runtime ON semantic regression

```text
pnpm.cmd --dir apps/server exec jest --runInBand <10 focused semantic spec paths>

Test Suites: 10 passed, 10 total
Tests:       56 passed, 56 total
```

### Build / lint / diff hygiene

- `[قطعی]` `pnpm.cmd --dir apps/server build`: PASS (`prisma generate` + `nest build`).
- `[قطعی]` focused ESLint روی 23 فایل lane: exit `0` و `0 errors`; اجرای عادی 773 warning قدیمی/Prettier/test-fixture typing گزارش کرد. پنج spec جدید با Prettier format شدند؛ lint نهایی با `--quiet` نیز exit `0` بود.
- `[قطعی]` targeted `git diff --check`: PASS.
- `[قطعی]` هیچ stage/commit/push انجام نشد.

## Residual risks / boundaries

- `[قطعی]` این تغییر یک kill-switch سراسری و fail-closed است، نه authorization مستقل per-user. وقتی runtime روشن است، این methodها خودشان current user consent را از ledger نمی‌خوانند؛ enforcement per-user باید در ingress/outbox/caller boundary باقی بماند و caller جدید نباید آن را دور بزند.
- `[قطعی]` consent epoch و جلوگیری transaction-level از race withdrawal طبق scope صریحاً پیاده‌سازی نشد.
- `[احتمالاً]` `Balanced User` از نظر type یک fallback خنثی است، اما اگر UI آن را به‌عنوان استنتاج واقعی نمایش دهد می‌تواند misleading باشد؛ consumer باید runtime-OFF را unavailable تلقی کند.
- `[قطعی]` full repository suite در این lane اجرا نشد؛ shared worktree هم‌زمان تغییر می‌کرد. coordinator باید full-suite/release-gate نهایی را اجرا کند.

## فایل‌های production این boundary

- `apps/server/src/behavior-engine/routing/event-router.service.ts`
- `apps/server/src/behavior-engine/processors/{recipe,recommendation,meal-plan,shopping,personalization}.signal-processor.ts`
- `apps/server/src/behavior-engine/signals/signal-calculator.service.ts`
- `apps/server/src/behavior-engine/identity/identity-dimension.builder.ts`
- `apps/server/src/lifestyle/lifestyle-graph.builder.ts`

## نتیجهٔ عملی

این focused boundary برای freeze و review coordinator آماده است. شرط حرکت به gate بعدی: full-suite مشترک و review مستقلِ این نکته که runtime ON همچنان به caller-level current-consent enforcement متکی است.
