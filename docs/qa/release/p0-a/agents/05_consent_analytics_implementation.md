# P0-A Phase 4 — Consent & Analytics Implementation

## Verdict

- [قطعی] owned implementation: `READY_FOR_COORDINATOR_INTEGRATION`.
- [قطعی] `GAR-LAUNCH-007` در producer و ingest owned بسته شد: analytics بدون grant canonical در runtime نه session می‌سازد، نه request/PostHog ایجاد می‌کند و نه `UserEvent` در backend می‌نویسد.
- [قطعی] بخش owned از `GAR-LAUNCH-008` بسته شد: ledger اکنون `declined` را از `withdrawn` جدا می‌کند و version/source server-owned دارد؛ separation نهایی onboarding در lane Allergy/Onboarding انجام می‌شود.
- [قطعی] Settings روی preferences/consent read failure و consent write timeout حالت `error/unknown` دارد؛ profile handlerها نیز مستقل از UI fail-closed هستند.
- [قطعی] هیچ production provider، production DB، migration یا analytics data mutation اجرا نشد.
- [قطعی] stage/commit/push انجام نشد.

## تصمیم پیاده‌سازی

1. [قطعی] runtime analytics در هر boot خاموش شروع می‌شود؛ localStorage به‌تنهایی proof canonical نیست.
2. [قطعی] فقط read یا write موفق server می‌تواند `enableAnalytics()` را در runtime فعال کند.
3. [قطعی] `useAnalytics` قبل از token access، `touchSession`، first-party POST و PostHog capture رضایت runtime را check می‌کند؛ نبود token نیز کل مسیر را متوقف می‌کند.
4. [قطعی] withdrawal ابتدا runtime/provider/session محلی را synchronously خاموش می‌کند و سپس ack server را می‌خواهد.
5. [قطعی] backend پیش از quality processing و هر `UserEvent.create`، purpose=`analytics` را fail-closed check می‌کند.
6. [قطعی] پس از grant analytics، routing به signal/profile یک check مستقل purpose=`personalization` دارد؛ deny یا read error فقط routing را می‌بندد و event consented analytics را با purpose=`analytics` نگه می‌دارد.
7. [قطعی] generic Settings DTO فقط `analytics|personalization` را قبول می‌کند؛ `core|terms` در آن allowlist نیست.

## تغییرات backend

### policy constants

`apps/server/src/consent/consent.constants.ts`

- [قطعی] `CURRENT_TERMS_POLICY_VERSION='terms-1405-03-29'`.
- [قطعی] `CURRENT_PRIVACY_POLICY_VERSION='privacy-1405-03-29'`.
- [قطعی] `OPTIONAL_CONSENT_PURPOSES=['analytics','personalization']`.
- [قطعی] این شناسه‌ها technical audit keys هستند و legal approval محسوب نمی‌شوند.

### ConsentService

`apps/server/src/consent/consent.service.ts`

- [قطعی] `recordDecision()` برای `granted|declined|withdrawn` اضافه شد.
- [قطعی] `declinePurpose()` و `withdrawPurpose()` معنای جدا دارند؛ فقط latest `granted` در `hasPurpose()` مجاز است.
- [قطعی] Terms به‌طور پیش‌فرض version جاری Terms و marker فنی basis=`pending_legal_review` می‌گیرد؛ این marker نتیجه‌گیری حقوقی نیست.
- [قطعی] analytics/personalization به‌طور پیش‌فرض version جاری Privacy می‌گیرند؛ source پیش‌فرض `api` است و caller می‌تواند `settings|onboarding` بدهد.
- [قطعی] read failure همچنان core-only و برای همهٔ purposeهای اختیاری fail-closed است.

### UpdateConsentDto

`apps/server/src/users/dto/update-consent.dto.ts`

- [قطعی] `type` با `@IsIn(OPTIONAL_CONSENT_PURPOSES)` محدود شده و `granted` باید boolean باشد.
- [قطعی] client نمی‌تواند source یا policyVersion دلخواه بفرستد.

### analytics ingest

`apps/server/src/analytics/analytics.service.ts`

- [قطعی] نبود/deny/withdraw/read-error analytics پیش از هر row write، `null` برمی‌گرداند.
- [قطعی] personalization consent جداگانه و fail-closed بررسی می‌شود.
- [قطعی] ENV mode قبلی که در dev/test gate را bypass می‌کرد حذف شد؛ safety invariant در همهٔ environmentها یکسان است.
- [قطعی] payload ورودی از `any` به `Record<string, unknown>` محدود و floating enrichment promise صریحاً `void` شد.

## تغییرات frontend

### runtime/provider gate

`apps/web/src/lib/analytics-init.js`

- [قطعی] persisted grant در boot trusted نیست؛ `initAnalyticsIfConsented()` runtime را خاموش نگه می‌دارد.
- [قطعی] `enableAnalytics()` فقط برای server-ack/read caller است و grant capture فقط با `{captureGrant:true}` انجام می‌شود.
- [قطعی] withdrawal، PostHog opt-out/reset و analytics session keys را پاک می‌کند.

`apps/web/src/hooks/useAnalytics.js`

- [قطعی] بدون runtime consent یا token معتبر هیچ session، network یا PostHog capture ایجاد نمی‌شود.
- [قطعی] این guard پیش از `touchSession()` قرار دارد.

### Settings

`apps/web/src/app/settings/useSettings.js`

- [قطعی] `prefs` یا `consent` loading/fetch/error، controls را ready نمی‌کند.
- [قطعی] diet update فقط `{diet}` و allergy update فقط `{allergies}` می‌فرستد.
- [قطعی] response قدیمی‌تر با sequence guard نمی‌تواند query state جدیدتر را جایگزین کند.
- [قطعی] grant تا ack server در UI/runtime فعال نمی‌شود.
- [قطعی] withdrawal محلی فوراً disable می‌شود؛ timeout، canonical state را unknown/error می‌کند و حالت فعال را restore نمی‌کند.

`apps/web/src/app/settings/page.jsx`

- [قطعی] عبارت خلاف رفتار «آمار ناشناس» حذف و با «آمار استفادهٔ اختیاری / رویدادهای متصل به حساب» جایگزین شد.
- [قطعی] switch در زمان mutation همان purpose غیرفعال است.
- [نامطمئن] متن نهایی privacy/legal همچنان نیازمند Privacy/Legal approval است.

## فایل‌های تغییرکرده در lane

1. `apps/server/src/consent/consent.constants.ts` — new
2. `apps/server/src/consent/consent.service.ts`
3. `apps/server/src/consent/consent.service.spec.ts`
4. `apps/server/src/users/dto/update-consent.dto.ts` — new
5. `apps/server/src/analytics/analytics.service.ts`
6. `apps/server/src/analytics/analytics.consent-gate.spec.ts`
7. `apps/web/src/lib/analytics-init.js`
8. `apps/web/src/lib/analytics-init.test.js` — new
9. `apps/web/src/hooks/useAnalytics.js`
10. `apps/web/src/hooks/useAnalytics.test.jsx` — new
11. `apps/web/src/app/settings/useSettings.js`
12. `apps/web/src/app/settings/useSettings.test.jsx` — new
13. `apps/web/src/app/settings/page.jsx`
14. `apps/web/src/app/settings/settings.smoke.test.jsx`

## Test و build evidence

### focused server

```powershell
pnpm.cmd --dir apps/server exec jest src/consent/consent.service.spec.ts src/analytics/analytics.consent-gate.spec.ts --runInBand
```

- [قطعی] `2/2` suites PASS؛ `11/11` tests PASS؛ final run `11.631s`.
- [قطعی] پوشش: declined/withdrawn provenance، policy versions، latest-decision fail-close، analytics deny/read-error no-row، personalization deny/read-error no-routing و dual-grant routing.

### focused web

```powershell
pnpm.cmd --dir apps/web exec vitest run src/lib/analytics-init.test.js src/hooks/useAnalytics.test.jsx src/app/settings/useSettings.test.jsx src/app/settings/settings.smoke.test.jsx --reporter=dot
```

- [قطعی] `4/4` files PASS؛ `14/14` tests PASS؛ final run `6.98s`.
- [قطعی] پوشش: no-consent zero session/network/PostHog، no-token isolation، server-ack-only grant، immediate withdrawal، read/write unknown، field-specific preference writes و copy regression.

### build/lint

```powershell
pnpm.cmd --dir apps/server build
pnpm.cmd --dir apps/web build
pnpm.cmd --dir apps/server exec eslint src/consent/consent.constants.ts src/consent/consent.service.ts src/consent/consent.service.spec.ts src/analytics/analytics.service.ts src/analytics/analytics.consent-gate.spec.ts src/users/dto/update-consent.dto.ts
pnpm.cmd --dir apps/web exec eslint src/hooks/useAnalytics.js src/hooks/useAnalytics.test.jsx src/lib/analytics-init.js src/lib/analytics-init.test.js src/app/settings/useSettings.js src/app/settings/useSettings.test.jsx src/app/settings/page.jsx src/app/settings/settings.smoke.test.jsx
```

- [قطعی] server build PASS.
- [قطعی] web production build PASS؛ PWA generation PASS.
- [قطعی] server owned lint `0 errors / 0 warnings`.
- [قطعی] web owned lint `0 errors / 0 warnings`.
- [قطعی] `git diff --check` برای lane PASS.

## Coordinator integration — الزامی پیش از verdict نهایی

### 1. UsersController DTO wiring

- [قطعی] `apps/server/src/users/users.controller.ts` هنوز body inline دارد. باید `UpdateConsentDto` import و در `POST /users/consent` استفاده شود تا global ValidationPipe، `core|terms|unknown` را reject کند.

```ts
async grantConsent(@Req() req, @Body() body: UpdateConsentDto) { ... }
```

### 2. UsersService defense-in-depth و write consistency

- [قطعی] `apps/server/src/users/users.service.ts:535-548` هنوز runtime list عمومی `CONSENT_PURPOSES` را می‌خواند. coordinator باید داخل service نیز فقط `OPTIONAL_CONSENT_PURPOSES` را قبول کند؛ DTO-only defense کافی نیست.
- [قطعی] grant باید `source='settings'` و server-owned Privacy version بگیرد؛ ConsentService اکنون default version را فراهم می‌کند.
- [احتمالاً] `ConsentLog.upsert` و `UserConsent.create` باید در یک transaction یا command واحد قرار گیرند. وضعیت فعلی می‌تواند در failure دوم، legacy log و canonical ledger را ناسازگار کند.
- [قطعی] `getConsentStatus()` نباید legacy grant بدون canonical `UserConsent` را به‌عنوان optional grant قابل‌فعال‌سازی برگرداند؛ analytics ingest فقط canonical ledger را می‌پذیرد.

### 3. AuthContext canonical hydration/logout

- [قطعی] چون boot عمداً persisted grant را trust نمی‌کند، coordinator باید پس از auth/refresh موفق `GET /users/consent` را canonical hydrate کند و بر اساس پاسخ `enableAnalytics()` یا `disableAnalytics()` را صدا بزند.
- [قطعی] logout، 401، cross-tab token removal و account switch باید `disableAnalytics()` را اجرا کنند.
- [قطعی] تا این wiring انجام نشود analytics خاموش می‌ماند مگر کاربر Settings را با read موفق باز کند؛ این fail-safe است ولی feature-complete نیست.

## باقی‌مانده و ریسک

- [قطعی] هیچ browser/network inspection با دو حساب در این lane انجام نشد؛ QA/Adversarial باید withdrawal، re-login و A→logout→B را در production preview بررسی کند.
- [احتمالاً] دو consent read برای هر event هزینه دارد؛ launch safety مقدم است، اما performance بعداً می‌تواند با cache کوتاه‌عمر و invalidation مطمئن بهینه شود.
- [نامطمئن] purpose matrix عملیاتی، retention، processor disclosure و lawful basis نیازمند Privacy/Legal approval است.
- [قطعی] هیچ analytics event user-linked نباید به‌عنوان anonymous معرفی شود.

## نتیجهٔ عملی

[قطعی] lane owned آمادهٔ integration است، نه merge approval مستقل. coordinator باید سه wiring بالا را انجام دهد؛ سپس QA باید direct API bypass، withdrawal no-row، canonical re-login و دوحساب را اجرا کند. فقط بعد از آن می‌توان `GAR-LAUNCH-007/008` را در verdict نهایی PASS نامید.
