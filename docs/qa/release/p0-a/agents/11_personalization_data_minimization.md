# Agent 11 — Personalization runtime gates and budget minimization

## Verdict

`[قطعی] PASS (focused lane)` — smart notification، smart meal-plan budget و AI behavioral snapshot اکنون از `ConsentService.hasPurpose(..., 'personalization')` استفاده می‌کنند؛ این check هم latest/current-policy consent و هم server runtime switch را اعمال می‌کند.

## تغییرات

- `NotificationsService.generateSmartSuggestion` پیش از هر profile/meal/favorite/notification IO gate می‌شود. runtime OFF، deny یا consent-read error همگی `null`، صفر downstream read و صفر notification row می‌دهند.
- `NotificationsModule` برای منبع canonical، `ConsentModule` را import می‌کند.
- `MealPlansService.generateSmartPlan` ابتدا personalization را resolve می‌کند. diet و skill به‌عنوان core planning input همیشه select می‌شوند و hard safety filter همیشه اجرا می‌شود؛ `budget` فقط با runtime ON + current grant select و در recipe cost filter استفاده می‌شود.
- `BehavioralContextSnapshotService.build` consent را قبل از preference query resolve می‌کند، بدون consent فقط diet/skill را select می‌کند و budget را نه می‌خواند و نه در snapshot می‌گذارد. همان decision برای behavioral-signal hydration نیز reuse می‌شود.

## تست متمرکز

```text
npm.cmd test -- --runInBand src/notifications/notifications.smart-suggestion-consent.spec.ts src/meal-plans/meal-plans.smart-plan-consent.spec.ts src/meal-plans/meal-plans.service.spec.ts src/ai/context/behavioral-context-snapshot.service.spec.ts
```

```text
Test Suites: 4 passed, 4 total
Tests:       18 passed, 18 total
```

پوشش کلیدی:

1. smart suggestion runtime OFF: حتی consent ledger query هم صفر؛ تمام suggestion IO صفر.
2. smart suggestion deny/read-error: صفر profile/meal/favorite read و صفر notification create.
3. smart suggestion current grant + runtime ON: مسیر موجود اجرا و یک row ساخته می‌شود.
4. smart plan OFF/denied: query صریح `{ diet, skillLevel }` و recipe filter بدون `cost`؛ safety filter همچنان اجرا می‌شود.
5. smart plan current grant + runtime ON: query صریح budget و cost filter مجاز است.
6. snapshot consent resolution پیش از preference IO؛ OFF/denied query budget ندارد و active query budget دارد.

## Build و lint

- `[قطعی]` server build: PASS.
- `[قطعی]` focused ESLint: exit code 0 و صفر error؛ warningهای non-blocking legacy/prettier/test-fixture typing باقی‌اند.
- `[قطعی]` `git diff --check`: PASS.

## ریسک باقی‌مانده

- `[قطعی]` طبقه‌بندی diet/skill به‌عنوان core و budget به‌عنوان personalization مطابق scope این task پیاده شد؛ purpose matrix نهایی هنوز نیازمند تأیید Privacy/Legal است.
- `[قطعی]` endpoint تولید suggestion در حالت disabled اکنون `null` برمی‌گرداند. caller نباید وجود notification را فرض کند.
- `[احتمالاً]` withdrawal هم‌زمان پس از check و پیش از downstream query یک race بسیار باریک دارد؛ حذف کامل آن transaction/locking گسترده‌تری می‌خواهد.
- `[قطعی]` هیچ migration، production DB operation، stage یا commit توسط این agent انجام نشد.

## فایل‌های lane

- `apps/server/src/notifications/notifications.service.ts`
- `apps/server/src/notifications/notifications.module.ts`
- `apps/server/src/notifications/notifications.smart-suggestion-consent.spec.ts`
- `apps/server/src/meal-plans/meal-plans.service.ts`
- `apps/server/src/meal-plans/meal-plans.smart-plan-consent.spec.ts`
- `apps/server/src/ai/context/behavioral-context-snapshot.service.ts`
- `apps/server/src/ai/context/behavioral-context-snapshot.service.spec.ts`

## نتیجهٔ عملی

این سه boundary برای ادغام coordinator آماده‌اند؛ full server suite و browser release gate همچنان verdict نهایی P0-A را تعیین می‌کنند.
