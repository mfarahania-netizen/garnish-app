# Agent 12 — Optional consumer closure

## Verdict

`[قطعی] PASS (focused boundary)` — هفت consumer تعیین‌شده اکنون runtime/current-policy consent را پیش از optional/private IO اعمال می‌کنند و در OFF، withdrawal یا consent-read error به خروجی خنثی و صادقانه degrade می‌شوند.

## تغییرات بسته‌شده

1. **NotificationSchedulerService**
   - هر سه cron در runtime OFF پیش از هر DB/INE call متوقف می‌شوند.
   - در runtime ON ابتدا فقط user ID فهرست می‌شود؛ سپس consent هر user پیش از shopping-list، meal-plan، behavior-profile یا notification IO بررسی می‌شود.
   - queryهای cross-user شامل دادهٔ nested حذف و به query per-user پس از consent تبدیل شدند.
   - `churnRiskScore=null` با `0` رفتار می‌شود؛ compile blocker `TS18047` رفع شد.

2. **IneService**
   - `resolveState` و `resolveCandidates` ابتدا personalization runtime/current consent را بررسی می‌کنند.
   - OFF/withdraw/error به neutral state یا candidate list خالی می‌رسد؛ unified profile، notification stats، shopping، meal-plan و churn profile خوانده نمی‌شوند.
   - pure decision/ledger و core safety semantics حفظ شده‌اند؛ INE همچنان خودش dispatch انجام نمی‌دهد.

3. **BehaviorEngineService.getProfile**
   - direct profile read بدون current personalization grant یا در consent error، `null` و صفر profile IO می‌دهد.

4. **FeatureStoreService.findUsersByFeature**
   - runtime OFF پیش از consent/feature IO، `[]` می‌دهد.
   - در runtime ON، latest canonical personalization decision برای population محاسبه می‌شود؛ فقط current-policy grants مجازند.
   - feature query با per-user grant epoch (`updatedAt >= grant.createdAt`) محدود می‌شود؛ withdrawal، stale policy و ledger error پیش از feature IO خالی برمی‌گردند.

5. **ExposureTrackingService**
   - `countEvent` اکنون صریحاً فقط `UserEvent.consentPurpose='personalization'` را می‌شمارد.
   - exposure-memory پیش از IO هر دو analytics و personalization current consent را لازم دارد.
   - وقتی ledger در adapter موجود است، latest grant هر دو purpose و current policy دوباره بررسی می‌شود و تمام memory/event/penalty reads از جدیدترین grant epoch محدود می‌شوند.
   - withdrawal یا epoch-ledger error حتی با stale caller approval، صفر exposure IO دارد.

6. **ExplainRecommendationTool**
   - valid recipe پیش از exposure lookup هر دو analytics و personalization consent را بررسی می‌کند.
   - deny/error خروجی generic `limited_data` با reasons خالی و صفر exposure IO دارد.
   - مسیر recipeId نامعتبر و عدم افشای score/vector/weight حفظ شده است.

7. **GovernanceInsightsService**
   - analytics runtime OFF پیش از UserConsent/UserEvent IO، volume را صریحاً unavailable (`null`) گزارش می‌کند؛ experiment/user core summary همچنان کار می‌کند.
   - runtime ON فقط eventهای با provenance `analytics|personalization` متعلق به population دارای latest current analytics grant را از epoch هر grant می‌شمارد.
   - withdrawal population بدون UserEvent IO برابر صفر؛ read error صریحاً unavailable است.

## تست و verification

```text
npm.cmd test -- --runInBand src/notifications/notification-scheduler.service.spec.ts src/notifications/ine/ine.service.spec.ts src/behavior-engine/behavior-engine.consent-boundary.spec.ts src/behavior-engine/feature-store/feature-store.service.spec.ts src/recommendation/exposure/exposure-tracking.service.spec.ts src/ai/tools/explain-recommendation.tool.spec.ts src/governance/governance-insights.service.spec.ts
```

```text
Test Suites: 7 passed, 7 total
Tests:       55 passed, 55 total
```

- `[قطعی]` server build: PASS.
- `[قطعی]` focused ESLint: exit code 0، صفر error؛ warningهای non-blocking legacy/prettier/test-fixture typing باقی‌اند.
- `[قطعی]` `git diff --check`: PASS.

## Residual risks / GAPs

- `[قطعی]` scheduler در runtime ON برای کشف subjectها، فقط `User.id` را پیش از per-user consent می‌خواند؛ تمام shopping/meal/behavior/notification IO پس از gate است. حذف همین minimal enumeration نیازمند canonical consent-population query مشترک است.
- `[قطعی]` INE در runtime OFF می‌تواند برای یک core candidate از قبل ساخته‌شده pure dry-run decision بسازد، اما optional DB IO و dispatch ندارد. این رفتار برای حفظ core/general path نگه داشته شد.
- `[احتمالاً]` race بسیار باریک withdrawal پس از آخرین check و هم‌زمان با downstream read باقی می‌ماند؛ حذف کامل آن transaction/locking یا consent-epoch column روی همهٔ derived rows می‌خواهد.
- `[قطعی]` exposure epoch enforcement در production فعال است چون Prisma `userConsent` delegate موجود است. offline harness بدون آن delegate فقط current dual-purpose `ConsentService` gate دارد و epoch را `null` می‌گیرد.
- `[قطعی]` این closure داده‌های مشتق قدیمی را حذف نمی‌کند؛ retention/deletion پس از withdrawal همچنان data-lifecycle work جداگانه است.
- `[قطعی]` هیچ bypass حل‌نشده‌ای در methodهای دقیق assigned مشاهده نشد. موارد خارج از فایل‌های ownership در این lane تغییر نکردند.

## فایل‌های این boundary

- `apps/server/src/notifications/notification-scheduler.service.ts`
- `apps/server/src/notifications/notification-scheduler.service.spec.ts`
- `apps/server/src/notifications/ine/ine.service.ts`
- `apps/server/src/notifications/ine/ine.service.spec.ts`
- `apps/server/src/behavior-engine/behavior-engine.service.ts`
- `apps/server/src/behavior-engine/behavior-engine.consent-boundary.spec.ts`
- `apps/server/src/behavior-engine/feature-store/feature-store.service.ts`
- `apps/server/src/behavior-engine/feature-store/feature-store.service.spec.ts`
- `apps/server/src/recommendation/exposure/exposure-tracking.service.ts`
- `apps/server/src/recommendation/exposure/exposure-tracking.service.spec.ts`
- `apps/server/src/ai/tools/explain-recommendation.tool.ts`
- `apps/server/src/ai/tools/explain-recommendation.tool.spec.ts`
- `apps/server/src/governance/governance-insights.service.ts`
- `apps/server/src/governance/governance-insights.service.spec.ts`

## نتیجهٔ عملی

این boundary برای ادغام coordinator آماده است؛ full suite و browser release gate همچنان verdict نهایی P0-A را تعیین می‌کنند.
