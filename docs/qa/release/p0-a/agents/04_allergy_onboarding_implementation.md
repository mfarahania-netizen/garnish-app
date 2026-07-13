# P0-A — Allergy & Onboarding Implementation

## Verdict

Reality Check: [قطعی] `GAR-LAUNCH-004` و `GAR-LAUNCH-005` در فایل‌های owned بسته شدند و bypass قدیمی completion fail-closed شد. focused test و build سبز است؛ verdict این agent برابر `IMPLEMENTED / INTEGRATION_QA_REQUIRED` است، نه PASS نهایی sprint.

[قطعی] هیچ production، DB، migration، recipe/content/media، stage یا commit انجام نشد.

## معماری اجراشده

- [قطعی] endpoint جدید احرازشده `POST /users/onboarding/complete` در `apps/server/src/users/users.controller.ts:34-40` تنها launch path جدید است.
- [قطعی] DTO جدید `apps/server/src/users/dto/complete-onboarding.dto.ts` یک allergy array باینری، `termsAccepted:true`، تصمیم boolean صریح personalization و versionهای جاری Terms/Privacy را اجباری می‌کند.
- [قطعی] command در `apps/server/src/users/users.service.ts:314-458` داخل یک Prisma transaction preference، allergy set، Terms، personalization و canonical read-back را اجرا می‌کند؛ `onboardingCompletedAt` فقط پس از تطبیق read-back نوشته می‌شود.
- [قطعی] retry متوالی با همان تصمیم، UserConsent یکسان جدید نمی‌سازد و completion timestamp موجود را حفظ می‌کند.
- [قطعی] Terms به‌صورت purpose مستقل `terms` با marker فنی `lawfulBasis=pending_legal_review`، source برابر onboarding و `CURRENT_TERMS_POLICY_VERSION` ثبت می‌شود؛ تعیین نهایی basis بر عهدهٔ Privacy/Legal است.
- [قطعی] personalization به‌صورت `granted` یا `declined` با `CURRENT_PRIVACY_POLICY_VERSION` ثبت می‌شود؛ agent رضایت تأیید کرد که gating فقط `granted` را قبول و `declined` را fail-closed می‌کند.
- [قطعی] mirror سازگار `ConsentLog` نیز در همان transaction فقط هنگام ایجاد یا تغییر تصمیم نوشته می‌شود.
- [قطعی] legacy `PATCH /users/me/onboarding-complete` برای user ازقبل‌کامل timestamp را حفظ می‌کند؛ برای user ناقص بدون preference، Terms جاری و تصمیم personalization جاری، 400 می‌دهد.

## Frontend

- [قطعی] `apps/web/src/app/onboarding/useOnboarding.js:179-205` فقط command اتمیک را برای critical state صدا می‌زند و پاسخ canonical را دوباره تطبیق می‌دهد.
- [قطعی] allergy request اکنون array واقعی است؛ JSON string ناسازگار قبلی حذف شد.
- [قطعی] critical hydration برای profile و consent با `loading | ready | error` پیاده شد؛ read failure دیگر به allergy empty تبدیل و persist نمی‌شود.
- [قطعی] `Promise.race` و timeout مربوط به critical writes حذف شدند؛ هیچ `PUT /users/preferences`، consent POST جدا یا legacy PATCH در launch flow باقی نمانده است.
- [قطعی] تنها `Promise.allSettled` باقی‌مانده در `useOnboarding.js:224` مختص signalهای غیرحیاتی و پس از موفقیت transaction است.
- [قطعی] optional taste/goals/style/time/favorite فقط وقتی personalization صریحاً true است ارسال می‌شوند.
- [قطعی] dish-dismiss analytics از onboarding حذف شد؛ analytics به consent مستقل Settings وابسته می‌ماند.
- [قطعی] Terms required و personalization optional/default-off به دو checkbox مستقل تبدیل شدند.
- [قطعی] severity از state، UI و test حذف شد؛ allergy باینری است.
- [قطعی] copy مطلق «هیچ‌وقت پیشنهاد نمی‌دهیم» حذف و با هشدار صادقانهٔ «تضمین ایمنی نیست؛ مواد را بررسی کن» جایگزین شد.
- [قطعی] single-flight ref فراخوانی تکراری سریع در همان hook instance را مسدود می‌کند.

## فایل‌های تغییرکرده در ownership این agent

- [قطعی] `apps/server/src/users/users.controller.ts`
- [قطعی] `apps/server/src/users/users.service.ts`
- [قطعی] `apps/server/src/users/dto/complete-onboarding.dto.ts` — جدید
- [قطعی] `apps/server/src/users/users-onboarding.spec.ts` — جدید
- [قطعی] `apps/web/src/app/onboarding/useOnboarding.js`
- [قطعی] `apps/web/src/app/onboarding/page.jsx`
- [قطعی] `apps/web/src/app/onboarding/useOnboarding.test.jsx`
- [قطعی] `apps/web/src/app/onboarding/onboarding.smoke.test.jsx`
- [قطعی] `docs/qa/release/p0-a/agents/04_allergy_onboarding_implementation.md` — جدید

## Test و build evidence

```text
# apps/server
.\node_modules\.bin\jest.cmd \
  src/users/users-onboarding.spec.ts \
  src/users/users-add-allergies.spec.ts --runInBand
=> PASS: 2 suites, 16/16 tests

# apps/web
.\node_modules\.bin\vitest.cmd run \
  src/app/onboarding/useOnboarding.test.jsx \
  src/app/onboarding/onboarding.smoke.test.jsx \
  src/app/onboarding/allergen-options.test.js --reporter=verbose
=> PASS: 3 files, 18/18 tests

# apps/server
.\node_modules\.bin\nest.cmd build
=> PASS

# apps/web
.\node_modules\.bin\vite.cmd build
=> PASS; production PWA artifact generated
```

- [قطعی] server tests پوشش success، read-back mismatch پیش از completion، invalid allergen، sequential idempotent retry، legacy fail-closed و DTO stale/malformed را دارند.
- [قطعی] frontend tests پوشش default-off personalization، binary array، legacy bypass absence، command failure، no optional writes after deny، جدا بودن checkboxها و حذف severity را دارند.

## Lint

- [قطعی] focused ESLint روی DTO/spec جدید server برابر صفر error و صفر warning است.
- [قطعی] focused ESLint روی چهار فایل onboarding web برابر صفر error و سه warning قدیمی unused component برای `ChipSelect`، `Stepper` و dead `Auth` است؛ هیچ‌کدام توسط implementation جدید ایجاد نشده‌اند.
- [قطعی] focused ESLint گسترده‌تر server برابر صفر error بود؛ warningهای formatter/type-mock baseline در فایل service موجود است و full baseline این agent بازنویسی نشد.
- [قطعی] `git diff --check` PASS است.

## Remaining integration needs

- [قطعی] coordinator باید full server/web suite، lint baseline-delta و browser fault-injection را پس از ادغام تغییرات هم‌زمان Consent/Analytics و Session/PWA اجرا کند.
- [قطعی] browser باید 400/500/timeout command، reload canonical equality، personalization deny/grant، retry و viewportهای خواسته‌شده را بررسی کند.
- [نامطمئن] concurrent retry واقعی از دو tab با latency معکوس روی DB واقعی در این agent اجرا نشد؛ same-instance rapid retry با single-flight و sequential server retry با unit test پوشش دارد.
- [نامطمئن] legal sufficiency نسخه و copy همچنان نیازمند Privacy/Legal است؛ constants فقط identifier فنی تاریخ صفحات جاری‌اند.
- [قطعی] هیچ migration لازم نیست.

**نتیجهٔ عملی:** [قطعی] این implementation را فقط همراه با constants/consent gating هم‌زمان نگه دار و اکنون integration QA را اجرا کن. اگر command failure بتواند navigation بدهد، canonical read-back mismatch completion بسازد، یا decline هر optional signal را ارسال کند، merge باید رد شود.
