# P0-A Phase 1 — Consent & Analytics Reproduction

## Reality Check و verdict

- [قطعی] `GAR-LAUNCH-007 = REPRODUCED / P0`: خاموش‌کردن یا withdrawal رضایت analytics، PostHog را متوقف می‌کند اما producer داخلی `POST /analytics/event` را متوقف نمی‌کند؛ backend نیز رویداد user-linked را مستقل از رضایت analytics ذخیره می‌کند.
- [قطعی] `GAR-LAUNCH-008 = REPRODUCED / P0`: یک checkbox مشترک، پذیرش Terms/Privacy و پیام ساخت پروفایل ذائقه را bundle می‌کند و مسیر persist بدون انتخاب مستقل، `personalization=true` را ثبت می‌کند.
- [قطعی] این verdict روی branch `fix/p0-a-safety-consent-session-isolation-v1` و hash `1631dc5dbf0f0d5b9699399ed8f50ebef4b053ab` ثبت شد؛ hash با audited master یکسان است و target-file delta وجود ندارد.
- [قطعی] هیچ browser provider، production analytics، production DB یا DB write اجرا نشد. runtime evidence فقط از unit/mockهای موجود و non-mutating به‌دست آمد.
- [نامطمئن] نتیجهٔ حقوقی دربارهٔ lawful basis یا اعتبار متن consent در صلاحیت این reproduction نیست و باید Privacy/Legal جداگانه review کند.

## روش و فرمان‌ها

```powershell
$env:CI='true'
pnpm.cmd --dir apps/server exec jest src/analytics/analytics.consent-gate.spec.ts src/consent/consent.service.spec.ts --runInBand
pnpm.cmd --dir apps/web exec vitest run src/app/onboarding/useOnboarding.test.jsx --reporter=verbose
```

- [قطعی] server: `2/2` suite و `11/11` test پاس؛ زمان Jest `14.98s`.
- [قطعی] web onboarding: `1/1` file و `6/6` test پاس؛ زمان Vitest `6.60s`.
- [قطعی] اجرای اولیه با `pnpm` به‌علت PowerShell execution policy قبل از شروع تست متوقف شد؛ اجرای بالا با `pnpm.cmd` موفق بود و failure محصول محسوب نمی‌شود.
- [قطعی] suite موجود server صریحاً رفتار نامطلوب فعلی را تثبیت می‌کند: در `EVENT_CONSENT_GATE_MODE=enforce` و بدون personalization consent، `UserEvent` همچنان ساخته می‌شود و فقط routing به personalization متوقف می‌شود.
- [احتمالاً] suite onboarding مسیر signup/finish فعلی را اجرا می‌کند، اما assertion مستقلی برای «عدم grant ضمنی» ندارد؛ سبز بودن آن evidence سلامت consent separation نیست.

## GAR-LAUNCH-007 — analytics پس از deny/withdrawal

### trace بازتولید

1. [قطعی] در settings، خاموش‌کردن analytics ابتدا `disableAnalytics()` را اجرا می‌کند و سپس `{ type: 'analytics', granted: false }` را به server می‌فرستد: `apps/web/src/app/settings/useSettings.js:113-131`.
2. [قطعی] `disableAnalytics()` فقط کلید `garnish.analyticsConsent=denied` را می‌نویسد و در صورت load بودن PostHog، `opt_out_capturing()` و `reset()` را صدا می‌زند: `apps/web/src/lib/analytics-init.js:53-68`.
3. [قطعی] `useAnalytics.trackEvent()` هیچ‌کدام از state یا کلیدهای رضایت را نمی‌خواند؛ تنها شرط first-party POST وجود token با طول حداقل ۱۰ است: `apps/web/src/hooks/useAnalytics.js:6-25`.
4. [قطعی] `RouteTracker` بعد از هر route change غیر-admin، `page_view` و در شرایط مربوط `page_dwell/page_clicks` را فراخوانی می‌کند: `apps/web/src/App.jsx:89-119,120-136`. بنابراین یک navigation بعد از withdrawal برای ایجاد درخواست first-party کافی است.
5. [قطعی] controller از JWT، `req.user.userId` را روی event می‌گذارد: `apps/server/src/analytics/analytics.controller.ts:32-43`. مدل نیز `UserEvent.userId` را required و مرتبط با `User` تعریف کرده است: `apps/server/prisma/schema.prisma:483-507`. این event «anonymous» نیست.
6. [قطعی] backend رضایت `analytics` را اصلاً check نمی‌کند. تنها `hasPurpose(userId, 'personalization')` در حالت gate روشن فراخوانی می‌شود؛ سپس `prisma.userEvent.create` همیشه پیش از تصمیم routing اجرا می‌شود: `apps/server/src/analytics/analytics.service.ts:105-128,134-147`.
7. [قطعی] در حالت deny/withdraw personalization نیز رویداد خام با `consentPurpose='analytics'` ذخیره می‌شود؛ این مقدار برچسب purpose است، نه proof وجود consent analytics: `apps/server/src/analytics/analytics.service.ts:116-128` و تست `apps/server/src/analytics/analytics.consent-gate.spec.ts:37-44,70-75`.
8. [قطعی] copy settings رفتار دیگری وعده می‌دهد: label «آمار ناشناس» و متن «با خاموش‌کردن، جمع‌آوری همان مورد متوقف می‌شود»: `apps/web/src/app/settings/page.jsx:134-142`.

### observed / expected

| سناریو | observed فعلی | expected برای خروج از P0 |
|---|---|---|
| analytics=`denied` و route change | [قطعی] `useAnalytics` برای token معتبر `POST /analytics/event` می‌سازد | [قطعی] optional analytics request تولید نشود؛ operational telemetry فقط از allowlist مستقل و مستند عبور کند |
| withdrawal در settings | [قطعی] PostHog opt-out می‌شود، اما first-party producer هیچ state تازه‌ای نمی‌خواند | [قطعی] withdrawal در client و ingest server enforce شود |
| direct API call پس از withdrawal | [قطعی] server analytics consent را نمی‌خواند و raw `UserEvent` را ذخیره می‌کند | [قطعی] event اختیاری reject/drop شود؛ bypass مستقیم client ممکن نباشد |
| copy «آمار ناشناس» | [قطعی] event دارای `userId` احراز‌شده است | [قطعی] واژهٔ anonymous حذف شود مگر re-identification واقعاً ناممکن باشد |

### محدودیت evidence

- [قطعی] مسیر PostHog از نظر کد با consent gate جداگانه محافظت شده است: init فقط با `garnish.analyticsConsent='granted'` انجام می‌شود و deny، opt-out را اجرا می‌کند (`analytics-init.js:8-68`). این reproduction ادعا نمی‌کند PostHog پس از deny همچنان capture می‌کند.
- [نامطمئن] رفتار tenant واقعی PostHog، retention واقعی، reverse proxy و policy حقوقی بررسی نشد؛ provider واقعی عمداً فعال نشد.

## GAR-LAUNCH-008 — grant ضمنی personalization و bundling

### trace بازتولید

1. [قطعی] onboarding فقط یک state به نام `consent` دارد که default آن `false` است و signup را تا true شدن همان state می‌بندد: `apps/web/src/app/onboarding/useOnboarding.js:78-84,161-165,228-235`.
2. [قطعی] همان checkbox با aria-label «پذیرش شرایط استفاده و حریم خصوصی» نمایش داده می‌شود و متن کنار آن Terms، Privacy و ساخت پروفایل ذائقه را در یک action جمع می‌کند: `apps/web/src/app/onboarding/page.jsx:319-334`.
3. [قطعی] هیچ state یا control مستقل برای personalization opt-in در onboarding وجود ندارد. `persist()` بدون خواندن یک انتخاب مستقل، همواره این دو درخواست را اجرا می‌کند:

   - `POST /users/consent { type: 'personalization', granted: true }`
   - `POST /users/consent { type: 'core', granted: true }`

   Evidence: `apps/web/src/app/onboarding/useOnboarding.js:177-187`.
4. [قطعی] همان تابع همچنین mirror محلی personalization را بدون شرط به `true` می‌برد: `apps/web/src/app/onboarding/useOnboarding.js:187`.
5. [قطعی] هر دو مسیر signup و finish احرازشده، `persist()` را اجرا می‌کنند: `apps/web/src/app/onboarding/useOnboarding.js:211-226,228-260`. در مسیر finish حتی checkbox signup حاضر نیست.
6. [قطعی] server تصمیم را در `ConsentLog` و سپس `UserConsent` ثبت می‌کند؛ `grantConsent()` source را همیشه `settings` می‌گذارد، حتی وقتی caller onboarding است، و `policyVersion` ارسال نمی‌شود: `apps/server/src/users/users.service.ts:340-353` و `apps/server/src/consent/consent.service.ts:27-41`.
7. [قطعی] schema فیلدهای `purpose/status/policyVersion/source/grantedAt/withdrawnAt` را دارد، اما flow فعلی onboarding نسخهٔ policy و source صحیح onboarding را تأمین نمی‌کند: `apps/server/prisma/schema.prisma:734-750`.
8. [قطعی] Terms acceptance به‌صورت یک رکورد مستقل و versioned در این flow قابل تشخیص نیست؛ `core=true` همراه personalization ارسال می‌شود و metadata آن برای اثبات Terms version کافی نیست.

### observed / expected

| سناریو | observed فعلی | expected برای خروج از P0 |
|---|---|---|
| signup با checkbox واحد | [قطعی] action برای Terms/Privacy، personalization را نیز grant می‌کند | [قطعی] Terms acceptance required و مستقل؛ personalization optional و default-off |
| personalization decline | [قطعی] control مستقلی برای decline در onboarding نیست | [قطعی] کاربر با decline بتواند onboarding را کامل کند |
| authenticated finish | [قطعی] `persist()` بدون action تازه personalization=true می‌فرستد | [قطعی] state canonical قبلی حفظ شود؛ implicit grant ممنوع |
| auditability | [قطعی] source به‌صورت `settings` hardcode و policyVersion تهی است | [قطعی] purpose، decision، timestamp، policyVersion و source واقعی ثبت شود |

## حداقل test harness برای Phase 4

### frontend — deny باید request را قبل از network قطع کند

```jsx
// focused Vitest؛ پس از implementation باید PASS شود.
localStorage.setItem('token', 'valid-token-at-least-10-chars');
localStorage.setItem('garnish.analyticsConsent', 'denied');
const { result } = renderHook(() => useAnalytics());
act(() => result.current.trackEvent('page_view', { page: '/settings' }));
expect(apiClient.post).not.toHaveBeenCalledWith('/analytics/event', expect.anything(), expect.anything());
```

- [قطعی] این assertion در پیاده‌سازی فعلی شکست می‌خورد، چون branch خطوط `useAnalytics.js:10-25` فقط token را بررسی می‌کند.
- [قطعی] این snippet در Phase 1 به repo اضافه یا اجرا نشد؛ harness موردنیاز implementation/QA است، نه evidence ساختگی.

### backend — direct API bypass باید بسته شود

```ts
process.env.EVENT_CONSENT_GATE_MODE = 'enforce';
const { svc, created, outbox } = make(false);
await svc.trackEvent({ userId: 'u1', type: 'page_view', page: '/settings', payload: {} });
expect(created).toHaveLength(0);       // optional event after deny: no storage
expect(outbox.enqueue).not.toHaveBeenCalled();
```

- [قطعی] تست موجود اکنون عمداً `created.length === 1` را انتظار دارد (`analytics.consent-gate.spec.ts:37-44`)؛ acceptance جدید باید با purpose matrix و operational allowlist تعریف شود، نه با حذف کور همهٔ telemetry.

### onboarding — decline مستقل و عدم implicit grant

```jsx
const { result } = renderHook(() => useOnboarding(), { wrapper });
// Terms accepted؛ personalization untouched/default false
act(() => result.current.acceptTerms());
await act(async () => result.current.submit());
expect(apiMock.post).not.toHaveBeenCalledWith('/users/consent', {
  type: 'personalization', granted: true,
});
expect(completeOnboardingSpy).toHaveBeenCalled();
```

- [قطعی] API پیشنهادی `acceptTerms()` فعلاً وجود ندارد؛ نام نهایی تابع جزو architecture/implementation decision است.
- [قطعی] matrix حداقلی باید onboarding با `declined`, `granted`, write failure، withdrawal، re-login و policy-version change را پوشش دهد.

## مالکیت احتمالی implementation

| لایه | فایل‌های مستقیم | دلیل |
|---|---|---|
| producer frontend | `apps/web/src/hooks/useAnalytics.js` + focused test جدید | [قطعی] gate first-party قبل از network اینجاست |
| analytics bootstrap | `apps/web/src/lib/analytics-init.js` + focused test | [احتمالاً] source واحد consent و withdrawal باید PostHog/first-party را هم‌زمان کنترل کند |
| onboarding consent UI/state | `apps/web/src/app/onboarding/useOnboarding.js`, `apps/web/src/app/onboarding/page.jsx`, تست‌های onboarding | [قطعی] bundling و implicit grant در این دو فایل است |
| settings consent UI/state | `apps/web/src/app/settings/useSettings.js`, `apps/web/src/app/settings/page.jsx`, settings tests | [قطعی] withdrawal و copy فعلی اینجاست |
| server ingest | `apps/server/src/analytics/analytics.controller.ts`, `apps/server/src/analytics/analytics.service.ts`, analytics consent integration tests | [قطعی] direct-call bypass و unconditional raw write اینجاست |
| consent command/DTO | `apps/server/src/users/users.controller.ts`, `apps/server/src/users/users.service.ts`, `apps/server/src/consent/consent.service.ts`, DTO/tests | [احتمالاً] purpose validation، source و policyVersion باید از contract معتبر بیاید |
| legal copy | `apps/web/src/app/privacy/page.jsx` و consent labels | [قطعی] فقط حذف ادعای خلاف رفتار در scope فنی است؛ متن نهایی و lawful-basis conclusion نیازمند Privacy/Legal approval است |

- [احتمالاً] برای فیلدهای consent موجود migration لازم نیست، چون schema فعلی purpose/status/version/source/timestamps را دارد.
- [نامطمئن] اگر architecture تصمیم بگیرد Terms acceptance ledger جدا داشته باشد، schema/migration ممکن است لازم شود؛ قبل از تصمیم معماری نباید migration ساخت.

## ریسک‌های implementation که reviewer باید بشکند

- [قطعی] frontend-only gate کافی نیست؛ caller می‌تواند مستقیم `POST /analytics/event` بزند.
- [قطعی] gate صرفاً بر اساس personalization، withdrawal analytics را enforce نمی‌کند.
- [احتمالاً] cache/localStorage قدیمی می‌تواند UI را موقتاً غلط نشان دهد؛ server canonical state باید source of truth باشد.
- [قطعی] eventهای operational و optional اکنون purpose contract/allowlist قابل‌اجرا ندارند؛ blanket allow با label `analytics` همان شکاف را حفظ می‌کند.
- [قطعی] تغییر copy بدون تغییر ingest یک false-fix است؛ تغییر ingest بدون network/DB inspection نیز evidence کامل نیست.

## نتیجهٔ عملی

[قطعی] هر دو finding باید وارد Phase 2/4 implementation شوند. safe default تا تصویب purpose matrix این است که optional first-party analytics و personalization ingest خاموش بماند؛ Terms از personalization جدا شود؛ withdrawal هم در producer و هم server enforce شود. این گزارش فقط reproduction است و هیچ product/test/schema/package file را تغییر نداده است.
