# P0-A — Allergy & Onboarding Reproduction

## Verdict

Reality Check: [قطعی] هر سه finding یعنی `GAR-LAUNCH-004`، `GAR-LAUNCH-005` و `GAR-LAUNCH-006` روی hash ممیزی‌شده بازتولید شدند. `GAR-LAUNCH-004` از baseline ممیزی شدیدتر است: کاربر دارای آلرژی payload را به شکل JSON string می‌فرستد، ولی ValidationPipe و DTO آرایه می‌خواهند؛ بنابراین write آلرژی پیش از رسیدن به service رد می‌شود و onboarding همان خطا را پنهان می‌کند.

[قطعی] وضعیت این فاز `REPRODUCED / FAIL-CLOSED NOT IMPLEMENTED` است. این گزارش فقط حاصل source inspection و تست‌های mock/non-mutating است؛ هیچ HTTP دارای token، DB write، migration یا product edit انجام نشد.

| Finding | Verdict | درجهٔ اطمینان | خلاصهٔ مشاهده |
|---|---|---|---|
| `GAR-LAUNCH-004` | `REPRODUCED` | [قطعی] | failure یا timeout در allergy/preferences/consent مانع completion نیست. |
| `GAR-LAUNCH-005` | `REPRODUCED` | [قطعی] | severity فقط در state/UI است؛ persistence و enforcement باینری‌اند و hydration همه را `severe` می‌سازد. |
| `GAR-LAUNCH-006` | `REPRODUCED` | [قطعی] | خطای GET preferences به state آماده با snapshot خالی می‌رسد؛ تغییر diet می‌تواند `allergies: []` بفرستد و backend کل allergy set را حذف کند. |

## Scope و baseline

- [قطعی] `HEAD`: `1631dc5dbf0f0d5b9699399ed8f50ebef4b053ab`؛ برابر hash ممیزی‌شده.
- [قطعی] فایل‌های محصول و تست فقط خوانده شدند؛ تنها artifact این agent همین گزارش است.
- [قطعی] production، DB، recipe/content/media، Prisma و providerها لمس نشدند.

## GAR-LAUNCH-004 — completion پس از شکست critical write

### مسیر اجرایی بازتولیدشده

1. [قطعی] `apps/web/src/app/onboarding/useOnboarding.js:169-175` فقط شناسه‌های allergy را استخراج می‌کند و در `body.allergies` با `JSON.stringify` قرار می‌دهد.
2. [قطعی] `apps/server/src/users/dto/update-preferences.dto.ts:9-14` روی همان فیلد `@IsArray()` دارد؛ type union نوشته‌شده در TypeScript رفتار runtime validator را عوض نمی‌کند.
3. [قطعی] `apps/server/src/main.ts:39-44` ValidationPipe سراسری با validation فعال دارد. اجرای مستقیم DTO کامپایل‌شده نشان داد آرایه `0` خطا و JSON string یک خطا با constraints برابر `arrayMaxSize,isArray` دارد.
4. [قطعی] `apps/web/src/app/onboarding/useOnboarding.js:181-209` هر دو consent write را در `Promise.allSettled` و سپس preferences و signal writeها را در `Promise.allSettled` قرار می‌دهد؛ rejection به caller منتقل نمی‌شود.
5. [قطعی] همان تابع در `:208` پس از ۷ ثانیه race را تمام می‌کند، بدون cancel یا acknowledgment از request معلق.
6. [قطعی] مسیر کاربر authenticated در `:211-225`، `persist()` را داخل `try` و completion را داخل `finally` اجرا می‌کند؛ بنابراین rejection احتمالی persist نیز مانع completion نیست.
7. [قطعی] مسیر signup در `:228-260` پس از `persist()` مستقیماً `completeOnboarding()` را صدا می‌زند؛ چون critical rejectionها در `allSettled` absorb شده‌اند، completion ادامه پیدا می‌کند.
8. [قطعی] مسیر login در `:247-253` شکست additive allergy write را با `.catch(() => {})` پنهان می‌کند و بعد completion را اجرا می‌کند.
9. [قطعی] `apps/web/src/context/AuthContext.jsx:148-152` completion را با `PATCH /users/me/onboarding-complete` اجرا می‌کند.
10. [قطعی] `apps/server/src/users/users.controller.ts:28-32` و `apps/server/src/users/users.service.ts:283-299` هیچ prerequisite، canonical read-back یا تطبیق allergy/consent ندارند؛ endpoint فقط `onboardingCompletedAt` را به زمان جدید تغییر می‌دهد.

### Observed در برابر Expected

| سناریو | Observed فعلی | Expected برای PASS |
|---|---|---|
| non-empty allergy | [قطعی] JSON string در DTO رد می‌شود؛ failure در `allSettled` گم می‌شود؛ completion ادامه دارد. | [قطعی] payload معتبر array، write موفق، سپس read-back دقیق و فقط بعد completion. |
| preferences 400/500 | [قطعی] rejection settle می‌شود و completion ادامه دارد. | [قطعی] completion=false، navigation متوقف، error و retry آشکار. |
| consent 400/500 | [قطعی] هر دو rejection settle می‌شوند و completion ادامه دارد. | [قطعی] critical consent failure باید completion را متوقف کند؛ optional consent باید جدا و default-off باشد. |
| timeout | [قطعی] پس از ۷ ثانیه completion می‌تواند در حالی آغاز شود که request هنوز pending است. | [قطعی] timeout باید state را unknown/failed کند؛ completion نباید اجرا شود. |
| returning login allergy failure | [قطعی] خطا صریحاً swallow و completion اجرا می‌شود. | [قطعی] declaration جدید باید acknowledgment و read-back داشته باشد یا flow متوقف شود. |

### تست موجود و خلأ آن

- [قطعی] `apps/web/src/app/onboarding/useOnboarding.test.jsx:79-86` فقط happy path را assert می‌کند: PUT صدا زده شود و completion نیز صدا زده شود.
- [قطعی] هیچ تست موجود در این suite، PUT/consent rejection، timeout، read-back mismatch یا منع completion را assert نمی‌کند.
- [قطعی] تست backend موجود completion prerequisite ندارد؛ `AuthContext.test.jsx:44-53` فقط forward شدن PATCH موفق را بررسی می‌کند.

## GAR-LAUNCH-005 — severity نمایشی و بدون round-trip

### مسیر اجرایی بازتولیدشده

1. [قطعی] `apps/web/src/app/onboarding/page.jsx:90-149` برای هر allergy دو کنترل قابل انتخاب `mild` و `severe` با عنوان «شدت برای ایمنی» نمایش می‌دهد.
2. [قطعی] `apps/web/src/app/onboarding/useOnboarding.js:149-154` severity را فقط به‌عنوان value در state محلی نگه می‌دارد.
3. [قطعی] `buildPreferences` در `:169-175` valueهای severity را حذف و فقط `Object.keys(answers.allergens)` را persist می‌کند.
4. [قطعی] hydration در `:102-104` هر allergy خوانده‌شده را بدون دادهٔ persisted به `severe` تبدیل می‌کند؛ انتخاب `mild` پس از reload به `severe` بدل می‌شود.
5. [قطعی] `apps/server/prisma/schema.prisma:134-175` در `UserPreference`، `Allergy` یا join مدل `UserAllergy` هیچ ستون severity ندارد.
6. [قطعی] `apps/server/src/users/dto/update-preferences.dto.ts:9-14` فقط آرایهٔ نام allergy را می‌پذیرد و severity contract ندارد.
7. [قطعی] `apps/server/src/behavior-engine/profile/read/profile-read.service.ts:102` فقط آرایهٔ نام‌ها را projection می‌کند؛ safety consumers نیز همان مجموعهٔ باینری را می‌گیرند.
8. [قطعی] `apps/server/src/behavior-engine/profile/declared/declared-dimension-registry.ts:71` حتی عبارت «with severity» دارد؛ این copy با persistence واقعی ناسازگار است و باید در scope اصلاح binary mode ثبت شود.

### Observed در برابر Expected

| سناریو | Observed فعلی | Expected تصمیم sprint |
|---|---|---|
| انتخاب `mild` | [قطعی] UI مقدار را نگه می‌دارد ولی request فقط نام allergy را می‌فرستد. | [قطعی] severity از surface و copy launch حذف شود. |
| reload | [قطعی] هر allergy ذخیره‌شده به‌صورت ساختگی `severe` hydrate می‌شود. | [قطعی] allergy باینری، بدون synthesis شدت نمایش داده شود. |
| enforcement | [قطعی] safety gate فقط وجود نام allergy را enforce می‌کند. | [قطعی] تا نبود schema/API/policy/test کامل، هیچ claim مبتنی بر شدت وجود نداشته باشد. |

## GAR-LAUNCH-006 — overwrite آلرژی پس از GET failure

### مسیر اجرایی بازتولیدشده

1. [قطعی] `apps/web/src/app/settings/useSettings.js:31-43` allergy state را با `{}` آغاز و `hydrated` را false می‌کند.
2. [قطعی] hydration effect در `:48-57` هنگام `prefs.isError` بازمی‌گردد؛ در نتیجه unknown/error به known-empty تبدیل نشده، اما state قابل ارسال همچنان `{}` باقی می‌ماند.
3. [قطعی] status در `:165-168` فقط خطای `me` را error می‌داند؛ خطای preferences نادیده گرفته می‌شود و پس از پایان loading صفحه `ready` است.
4. [قطعی] `hydrated` در return contract `:169-178` وجود ندارد؛ page نمی‌تواند از آن برای read-only کردن controlها استفاده کند.
5. [قطعی] `apps/web/src/app/settings/page.jsx:100-123` diet/allergy chipها را بدون disabled guard مربوط به hydration نمایش می‌دهد.
6. [قطعی] تغییر diet در `useSettings.js:89-93` snapshot فعلی allergens را به save می‌دهد؛ پس از GET failure همان `{}` است.
7. [قطعی] `savePreferences` در `:70-87` همیشه `body.allergies = Object.keys(next.allergens)` می‌سازد، حتی اگر کاربر فقط diet را تغییر داده باشد؛ payload نتیجه `allergies: []` است.
8. [قطعی] `apps/server/src/users/users.service.ts:203-212` با وجود فیلد `allergies` ابتدا `userAllergy.deleteMany({ where: { userId } })` را اجرا می‌کند؛ empty array یعنی حذف کامل و بدون re-create.

### Observed در برابر Expected

| سناریو | Observed فعلی | Expected برای PASS |
|---|---|---|
| GET preferences=500 | [قطعی] صفحه ready و food controls فعال می‌شوند؛ allergy state محلی خالی است. | [قطعی] state=`error/unknown` و controlهای قادر به overwrite، read-only. |
| سپس تغییر diet | [قطعی] PUT شامل `allergies: []` می‌شود. | [قطعی] diet-only request نباید فیلد allergy داشته باشد، یا server باید field-specific merge کند. |
| backend apply | [قطعی] explicit empty set تمام join rowها را حذف می‌کند. | [قطعی] allergy set موجود بدون تصمیم آگاهانهٔ کاربر دست‌نخورده بماند. |

### تست موجود و خلأ آن

- [قطعی] `apps/web/src/app/settings/settings.smoke.test.jsx:5-7` کل `useSettings` را mock می‌کند؛ بنابراین GET failure، state hydration و payload PUT را اصلاً اجرا نمی‌کند.
- [قطعی] سه smoke test فقط ready/loading/error shape ساختگی page را بررسی می‌کنند؛ `prefs.isError` واقعی قابل کشف نیست.
- [قطعی] backend unitها allowlist و additive endpoint را پوشش می‌دهند، اما sequence «GET fail → diet-only change → explicit empty replacement» پوشش ندارد.

## Rapid و idempotent behavior

- [قطعی] `POST /users/allergies` برای retry یک payload یکسان، با `skipDuplicates` و بدون delete، value-idempotent است؛ `users-add-allergies.spec.ts:18-35` این بخش را اثبات می‌کند.
- [احتمالاً] تکرار دقیق یک `PUT /users/preferences` به state نهایی یکسان می‌رسد، اما contract idempotency/version ندارد و full replacement انجام می‌دهد؛ این برای retryِ payload یکسان کافی است، نه برای race بین snapshotهای متفاوت.
- [قطعی] settings درخواست‌ها را serialize یا abort نمی‌کند؛ `saveSeq` در `useSettings.js:46,70-86` فقط آزاد کردن `busy` برای آخرین request را کنترل می‌کند و مانع اجرای write قدیمی نمی‌شود.
- [احتمالاً] دو تغییر سریع با latency معکوس می‌توانند server یا query cache را با snapshot قدیمی‌تر نهایی کنند؛ تست deferred-response برای اثبات runtime لازم است.
- [قطعی] `PATCH /users/me/onboarding-complete` از نظر timestamp idempotent نیست؛ هر retry در `users.service.ts:283-299` زمان completion را دوباره می‌نویسد.
- [قطعی] `submit` یک guard مبتنی بر render-state دارد (`useOnboarding.js:228-236`) و `finish` هیچ guard ابتدای تابع ندارد (`:211-226`)؛ idempotency key، single-flight ref یا server command key موجود نیست.
- [نامطمئن] race واقعی double-click در مرورگر از این فاز اثبات نشد؛ رفتار React event flushing و latency شبکه باید در تست component/browser اندازه‌گیری شود.

## Commands و خروجی مشاهده‌شده

```text
git rev-parse HEAD
=> 1631dc5dbf0f0d5b9699399ed8f50ebef4b053ab

# cwd: apps/web
.\node_modules\.bin\vitest.cmd run \
  src/app/onboarding/useOnboarding.test.jsx \
  src/app/onboarding/onboarding.smoke.test.jsx \
  src/app/settings/settings.smoke.test.jsx --reporter=verbose
=> 15 passed / 2 failed (17 total)
=> useOnboarding hook: 6/6 PASS
=> settings page smoke: 3/3 PASS (hook mocked)
=> onboarding page smoke: 6/8 PASS؛ دو account-step assertion قدیمی FAIL

# cwd: apps/server
.\node_modules\.bin\jest.cmd src/users/users-add-allergies.spec.ts --runInBand
=> 1 suite PASS؛ 9/9 tests PASS

# DTO validation؛ compiled artifact همان hash، بدون DB
array ['egg']                 => errors=0
JSON string '["egg"]'        => errors=1؛ constraints=arrayMaxSize,isArray
```

[قطعی] دو failure smoke مربوط به انتظار step 6 قدیمی‌اند و reproduction سه finding را رد نمی‌کنند؛ با این حال baseline کلی targeted command سبز نیست و نباید PASS گزارش شود.

## Minimal proposed test harness

### اولویت ۱ — frontend fault-injection

1. [قطعی] یک hook test واقعی برای `useOnboarding` بساز: token فعال، `toggleAllergen('egg')`، سپس PUT preferences را با 400/500/rejection شکست بده؛ assert کن completion، navigation و success state رخ نمی‌دهند.
2. [قطعی] همان test را برای هر POST consent و برای pending promise با fake timer بالاتر از ۷ ثانیه تکرار کن؛ timeout نباید completion را فعال کند.
3. [قطعی] read-back را mock کن: write success ولی GET canonical mismatch؛ completion باید false بماند و retry نمایش داده شود.
4. [قطعی] برای binary decision، component test باید نبود متن/کنترل `mild` و `severe` را assert کند و reload باید دقیقاً همان مجموعهٔ نام‌ها را برگرداند.
5. [قطعی] دو فراخوانی هم‌زمان `finish/submit` را با deferred promises اجرا کن؛ فقط یک command completion مجاز باشد.

### اولویت ۱ — settings integrity

1. [قطعی] `useSettings` را با QueryClient واقعی و `retry:false` render کن؛ `/users/me` و consent موفق، `/users/preferences` برابر 500؛ assert کن status خطا/unknown، controls read-only و PUT count برابر صفر است.
2. [قطعی] کاربر با `['egg']` را hydrate کن، سپس فقط diet را تغییر بده؛ request باید allergy را omit کند و read-back همچنان `['egg']` باشد.
3. [قطعی] دو deferred update با ترتیب پاسخ معکوس بساز؛ final UI، cache و canonical GET باید انتخاب دوم را نشان دهند.
4. [قطعی] retry همان request و rapid allergen toggles را اجرا کن؛ duplicate، lost update یا stale cache مجاز نیست.

### اولویت ۱ — backend command/contract

1. [قطعی] اگر atomic onboarding command انتخاب شد، transaction را در allergy، preferences و read-back به‌صورت جدا fault-inject کن و assert کن `onboardingCompletedAt` null می‌ماند.
2. [قطعی] اگر sequential design انتخاب شد، completion endpoint باید canonical state/prerequisite را بررسی کند؛ فقط اعتماد به ترتیب frontend کافی نیست.
3. [قطعی] contract test باید payload allergy را به‌صورت array اجرا کند؛ JSON string نباید از frontend تولید شود.
4. [قطعی] diet-only update باید ثابت کند هیچ `userAllergy.deleteMany` رخ نمی‌دهد.
5. [قطعی] retry/double-submit باید state یکسان و completion timestamp پایدار یا command-result قابل replay تولید کند.

## فایل‌های محتمل تحت مالکیت implementation

### مالکیت اصلی Allergy & Onboarding

- [قطعی] `apps/web/src/app/onboarding/useOnboarding.js`
- [قطعی] `apps/web/src/app/onboarding/page.jsx`
- [قطعی] `apps/web/src/app/onboarding/useOnboarding.test.jsx` یا یک safety test جدید کنار آن
- [قطعی] `apps/web/src/app/settings/useSettings.js`
- [احتمالاً] `apps/web/src/app/settings/page.jsx` برای نمایش unknown/error و disabled controls
- [قطعی] یک hook/integration test واقعی جدید کنار settings؛ smoke فعلی کافی نیست

### coupling محتمل با backend

- [احتمالاً] `apps/server/src/users/users.controller.ts`
- [احتمالاً] `apps/server/src/users/users.service.ts`
- [احتمالاً] DTO/contract جدید زیر `apps/server/src/users/dto/**` و unit/integration test متناظر
- [قطعی] `apps/server/src/behavior-engine/profile/declared/declared-dimension-registry.ts:71` برای حذف copy نادرست severity در binary mode
- [احتمالاً] `apps/server/prisma/schema.prisma` برای تصمیم پیش‌فرض binary لازم نیست؛ افزودن migration severity در این sprint خلاف تصمیم scope است.

## ریسک و قدم بعدی

- [قطعی] اصلاح صرف `Promise.allSettled` کافی نیست؛ payload type، read-back، completion prerequisite و settings unknown-state هم‌زمان باید بسته شوند.
- [قطعی] اصلاح صرف frontend کافی نیست؛ completion endpoint فعلی هر caller احرازشده را بدون اثبات state کامل می‌کند.
- [قطعی] severity باید اکنون حذف شود؛ حفظ آن بدون schema و enforcement واقعی false safety است.

**نتیجهٔ عملی:** [قطعی] implementation را با سه test قرمز آغاز کن: «allergy PUT=400 مانع completion»، «preferences GET=500 مانع diet PUT»، و «mild/severe در launch UI وجود ندارد». سپس کوچک‌ترین command fail-closed با canonical read-back را بساز؛ تا سبز شدن این سه gate، completion نباید قابل merge باشد.
