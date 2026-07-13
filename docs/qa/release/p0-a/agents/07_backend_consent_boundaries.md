# Agent 07 — Backend consent mutation boundaries

## Verdict

`[قطعی] PASS (focused lane)` — مسیرهای mutation بررسی‌شده بدون consent جاریِ `personalization` هیچ routing یا upsert پروفایل رفتاری انجام نمی‌دهند. این نتیجه فقط برای lane حاضر است؛ جایگزین verdict نهایی P0-A و browser QA نیست.

## Reality check

`[قطعی]` consent در زمان ingest به‌تنهایی کافی نبود. یک outbox row می‌توانست قبل از withdrawal ایجاد شود و scheduler بعد از withdrawal آن را route کند؛ در نتیجه downstream personalization state پس از لغو رضایت mutate می‌شد.

## تغییرات

- `BehaviorEngineService.processEventsForUser` اکنون در entry مشترک scheduler و direct caller، `ConsentService.hasPurpose(userId, 'personalization')` را پیش از هر behavioral read یا profile upsert بررسی می‌کند.
- deny و consent-read error هر دو fail-closed هستند و `null` برمی‌گردانند؛ هیچ `UserBehaviorProfile` mutation رخ نمی‌دهد.
- `EventOutboxService.processNow` درست پیش از `router.route` consent جاری را دوباره بررسی می‌کند.
- `EventOutboxService.drain` پس از claim و load کردن event و درست پیش از `router.route` همان re-check را انجام می‌دهد.
- row فاقد consent با `status=done`، `processedAt` و علت `suppressed: personalization consent not granted at routing` به حالت terminal می‌رود؛ retry بعدی نمی‌تواند دادهٔ قدیمی را پس از grant آینده retroactively route کند.
- `drain` شمارندهٔ صریح `suppressed` برمی‌گرداند تا suppression با success یا dead-letter اشتباه نشود.
- `BehaviorEngineModule` برای dependency injection، `ConsentModule` را import می‌کند.
- shadow A8 دیگر `ConsentLog` legacy را نمی‌خواند؛ `SHADOW_CONSENT_PORT` از `ConsentService.grantedPurposes` تغذیه می‌شود و در نتیجه latest-decision و current-policy را از منبع canonical اعمال می‌کند.
- outbox علاوه بر current consent، provenance رویداد و ledger interruption از زمان event را بررسی می‌کند. وجود هر `declined/withdrawn` بعد از event، حتی پس از re-grant، routing آن event قدیمی را برای همیشه fail-closed می‌کند.

## تست‌های adversarial متمرکز

فرمان:

```text
npm.cmd test -- --runInBand src/behavior-engine/routing/event-outbox.service.spec.ts src/behavior-engine/behavior-engine.consent-boundary.spec.ts src/recommendation/runtime-shadow/recommendation-shadow-a8-consent-adapter.spec.ts src/recommendation/runtime-shadow/recommendation-shadow-consent-plumbing.spec.ts src/recommendation/recommendation-requestid-capstone.spec.ts
```

نتیجه:

```text
Test Suites: 5 passed, 5 total
Tests:       33 passed, 33 total
```

سناریوهای مرزی جدید:

1. direct BehaviorEngine deny: صفر behavioral read و صفر profile upsert.
2. direct BehaviorEngine consent-read error: fail-closed و صفر mutation.
3. scheduler BehaviorEngine deny: همان entry مشترک اجرا و profile mutation متوقف می‌شود.
4. outbox `processNow` deny: صفر routing و terminal suppression.
5. outbox consent-read error: صفر routing و terminal suppression.
6. grant-at-queue سپس withdraw-before-drain: صفر routing، `suppressed=1` و row terminal.
7. مسیر grant قبلی و requestId capstone همچنان pass است.
8. stale-policy personalization grant در shadow adapter: `null` و fail-closed.
9. latest withdrawal پس از grant معتبر در shadow adapter: `null` و fail-closed.
10. consent-ledger read error در shadow adapter/outbox history: fail-closed.
11. سه terminal-write failure، سپس re-grant و drain: interruption ledger مانع retroactive routing می‌شود و row در retry بعدی terminal می‌گردد.

## Build و lint

- `[قطعی]` `npm.cmd run build`: PASS.
- `[قطعی]` ESLint روی فایل‌های lane: exit code 0 و صفر error. warningهای non-blocking موجود در فایل‌های legacy و test fixtureها (از جمله typing/prettier در fixture جدید) باقی هستند.
- `[قطعی]` `git diff --check`: PASS.

## محدودیت و ریسک باقی‌مانده

- `[قطعی]` withdrawal پروفایل personalization از قبل ساخته‌شده را حذف نمی‌کند؛ این lane فقط mutation/routing جدید را متوقف می‌کند. retention/deletion policy یک تصمیم جداگانهٔ privacy/data-lifecycle است.
- `[قطعی]` اگر نوشتن terminal status سه بار fail شود، row موقتاً pending/processing می‌ماند؛ اما retry بعدی علاوه بر current consent، هر withdrawal/decline ثبت‌شده از زمان event را از ledger append-only می‌خواند. بنابراین re-grant بعدی event سرکوب‌شده را resurrect نمی‌کند.
- `[احتمالاً]` یک race بسیار باریک بین آخرین ledger read و فراخوانی `router.route` باقی می‌ماند: withdrawal کاملاً هم‌زمان پس از read می‌تواند با routing overlap کند. حذف کامل آن بدون transaction/locking یا durable claim schema ممکن نیست؛ هر retry بعدی fail-closed است.
- `[قطعی]` `requestConsentPurposes` در A8 یک مسیر assertion داخلی و مستقل از persisted adapter باقی مانده است؛ این follow-up فقط port persisted را canonical کرد. A8 در live user path فعلی default-off/بدون production caller مستقیم است، اما پیش از activation باید provenance همین assertion نیز gate شود.
- `[قطعی]` هیچ migration، production DB operation، analytics write واقعی، stage یا commit توسط این agent انجام نشد.

## فایل‌های lane

- `apps/server/src/behavior-engine/behavior-engine.module.ts`
- `apps/server/src/behavior-engine/behavior-engine.service.ts`
- `apps/server/src/behavior-engine/behavior-engine.consent-boundary.spec.ts`
- `apps/server/src/behavior-engine/routing/event-outbox.service.ts`
- `apps/server/src/behavior-engine/routing/event-outbox.service.spec.ts`
- `apps/server/src/recommendation/recommendation-requestid-capstone.spec.ts` (constructor fixture only)
- `apps/server/src/recommendation/recommendation.module.ts`
- `apps/server/src/recommendation/runtime-shadow/recommendation-shadow-a8-adapters.ts`
- `apps/server/src/recommendation/runtime-shadow/recommendation-shadow-a8-consent-adapter.spec.ts`
- `apps/server/src/recommendation/runtime-shadow/recommendation-shadow-profile-feed.types.ts` (canonical source documentation)
- `apps/server/src/recommendation/runtime-shadow/recommendation-shadow-consent-plumbing.ts` (canonical source documentation)

## نتیجهٔ عملی

این lane برای merge در branch P0-A آماده است. coordinator باید آن را همراه کل suite و browser two-account isolation gate ارزیابی کند؛ به‌تنهایی مجوز PASS نهایی یا merge نیست.
