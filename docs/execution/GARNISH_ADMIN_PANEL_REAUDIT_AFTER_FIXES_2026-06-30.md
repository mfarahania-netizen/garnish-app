# گزارش بازبینی دوم پنل ادمین گارنیش بعد از اعمال ممیزی‌ها

تاریخ: 2026-06-30  
دامنه: فقط پنل ادمین، فرانت‌اند و بک‌اند  
نوع خروجی: گزارش ممیزی، بدون تغییر در کد اپلیکیشن  

## Reality Check

[قطعی] پنل ادمین نسبت به ممیزی قبلی بهتر شده، اما هنوز در سطح «مرکز فرماندهی بین‌المللی آماده لانچ» نیست. چند اصلاح مهم انجام شده، ولی هنوز چند شکاف launch-blocker باقی مانده که اگر قبل از لانچ حل نشوند، ریسک امنیت، حریم خصوصی، audit و عملیات واقعی دارند.

[قطعی] مهم‌ترین مشکل این نیست که UI زشت است؛ مشکل اصلی این است که چند عملیات حساس هنوز از نظر semantic API، audit fail-closed، نقش‌ها، و سیم‌کشی وضعیت محصولی کامل نیستند.

[احتمالاً] اگر فقط با یک تیم خیلی کوچک و یک مالک داخلی لانچ محدود انجام شود، بخشی از ریسک‌ها قابل کنترل موقت است. اما برای اپ عمومی/بین‌المللی با داده کاربر، وضعیت فعلی هنوز production-grade محسوب نمی‌شود.

## درجه اطمینان

- [قطعی] مواردی که با مسیر فایل و خط کد مشخص شده‌اند از خود سورس استخراج شده‌اند.
- [احتمالاً] موارد UX که نیاز به دیدن runtime دارند، بر اساس کد فرانت و رفتار کامپوننت‌ها تحلیل شده‌اند.
- [نامطمئن] تست‌های خودکار در این محیط به نتیجه نرسیدند؛ بنابراین وضعیت نهایی CI قابل تأیید نیست.

## فایل‌های اصلی بررسی‌شده

- `apps/server/src/admin/admin.controller.ts`
- `apps/server/src/admin/admin.service.ts`
- `apps/server/src/admin/admin-users.service.ts`
- `apps/server/src/admin/admin-tickets.service.ts`
- `apps/server/src/admin/observability.service.ts`
- `apps/server/src/admin/dto/admin-user.dto.ts`
- `apps/server/src/admin/dto/update-ticket-status.dto.ts`
- `apps/server/src/auth/owner.guard.ts`
- `apps/server/src/auth/roles.guard.ts`
- `apps/server/src/workflow/workflow.controller.ts`
- `apps/server/src/workflow/workflow.service.ts`
- `apps/server/src/workflow/workflow-scheduler.service.ts`
- `apps/server/src/workflow/workflow-runner.service.ts`
- `apps/web/src/app/admin/page.jsx`
- `apps/web/src/app/admin/tabs/UsersTab.jsx`
- `apps/web/src/app/admin/tabs/TicketsTab.jsx`
- `apps/web/src/app/admin/tabs/AutomationTab.jsx`
- `apps/web/src/app/admin/tabs/RealtimeTab.jsx`
- `apps/web/src/app/admin/_ui.jsx`
- `apps/web/src/app/admin/AttentionQueue.jsx`
- `apps/web/src/app/admin/PulseStrip.jsx`

## وضعیت کلی نسبت به گزارش قبلی

| بخش | وضعیت فعلی | جمع‌بندی |
|---|---:|---|
| حذف export کل cache ادمین | انجام شده | [قطعی] export کلاینتی cache از topbar حذف شده است. |
| ماسک PII در فهرست/پرونده کاربر | عمدتاً انجام شده | [قطعی] user list/detail ماسک شده، اما ticket و observability هنوز داده آزاد/حساس نشان می‌دهند. |
| reason modal برای عملیات حساس | ناقص | [قطعی] delete/export/reveal/role/reset/ban reason دارند، اما create admin و force logout نه. |
| owner guard برای عملیات خطرناک | ناقص ولی بهتر | [قطعی] export/delete/password/reset/recipe approve owner-gated هستند؛ reveal و workflow actions هنوز owner/role دقیق ندارند. |
| audit fail-closed | ناقص | [قطعی] برای بیشتر mutationهای حساس قبل از عمل ثبت می‌شود، اما create user بعد از mutation audit می‌شود. |
| ticket triage/SLA/assignee/tags | انجام شده | [قطعی] سطح عملیاتی بهتر شده؛ DTO و privacy و خطای UI هنوز ناقص‌اند. |
| workflow 404 و claim اتمیک | انجام شده | [قطعی] unknown workflow 404 می‌دهد و scheduler claim اتمیک دارد. |
| workflow audit/reason/role | انجام نشده | [قطعی] run/ack/resolve/snooze audit ledger و reason ندارند. |
| active users واقعی | انجام شده | [قطعی] RealtimeTab از `activeUsers30m` سرور استفاده می‌کند. |
| ناوبری job-based | انجام شده | [قطعی] گروه‌بندی Command، Users+Tickets، Product، AI، Safety، Automation/System بهتر شده. |
| تست‌های امنیتی دقیق | ناکافی/نامطمئن | [قطعی] تست‌های موجود همه سناریوهای بحرانی جدید را پوشش نمی‌دهند؛ اجرای تست‌ها در این محیط timeout شد. |

## حکم اجرایی

[قطعی] وضعیت فعلی: **بهتر از قبل، اما هنوز آماده لانچ حرفه‌ای بدون اصلاح P0 نیست.**

حداقل شرط عبور برای لانچ:

1. [قطعی] اصلاح publish status رسپی از ادمین.
2. [قطعی] تبدیل reveal/export PII از GET با query reason به POST با body و headerهای no-store.
3. [قطعی] atomic/fail-closed کردن audit برای create admin/user.
4. [قطعی] audit کردن workflow actionها.
5. [احتمالاً] اجرای موفق تست‌های هدفمند امنیتی و smoke ادمین بعد از اصلاحات.

---

# P0 - ایرادهای حیاتی قبل از لانچ

## P0-1: تأیید رسپی در ادمین احتمالاً رسپی را واقعاً منتشر نمی‌کند

[قطعی] در `apps/server/src/admin/admin.controller.ts:91` مسیر approve این مقدار را می‌نویسد:

```ts
return this.adminService.updateRecipeStatus(id, 'approved');
```

[قطعی] بخش‌های عمومی اپ، AI tools، meal plan، favorites و recommendation رسپی منتشرشده را با `status: 'active'` و `isPublic: true` می‌شناسند. نمونه‌ها در `apps/server/src/recipes/recipes.service.ts:15`, `apps/server/src/recipes/recipes.service.ts:53`, `apps/server/src/recipes/recipe-visibility.ts:10` دیده می‌شود.

[قطعی] نتیجه: ادمین ممکن است فکر کند رسپی را approve کرده، اما رسپی در Home/Discover/Search/AI/Meal Plan منتشر نشود. این مشکل محصولی و عملیاتی است.

راه‌حل پیشنهادی:

- approve باید `status: 'active'` ست کند، نه `approved`.
- اگر به workflow سه‌مرحله‌ای نیاز است، status enum باید شفاف شود: `pending_review`, `active`, `rejected`, `archived`.
- تست اضافه شود: admin approve یک رسپی pending را active می‌کند و بلافاصله در public query قابل مشاهده می‌شود.

اولویت: P0، قبل از لانچ.

## P0-2: ساخت کاربر/ادمین audit را بعد از mutation ثبت می‌کند

[قطعی] در `apps/server/src/admin/admin.controller.ts:154-158` ابتدا کاربر ساخته می‌شود، بعد audit strict ثبت می‌شود:

```ts
const created = await this.adminUsers.create(body);
await this.adminService.recordAuditStrict(...)
```

[قطعی] اگر `recordAuditStrict` بعد از ساخت fail شود، user/admin ساخته شده اما audit durable ندارد. این خلاف قاعده fail-closed برای عملیات حساس است.

[قطعی] فرم فرانت در `apps/web/src/app/admin/tabs/UsersTab.jsx:438-448` امکان `isAdmin` دارد، اما reason ندارد و typed confirmation هم ندارد.

ریسک:

- [قطعی] ایجاد ادمین بدون reason الزامی ممکن است انجام شود.
- [قطعی] audit failure بعد از create باعث mutation بدون ledger می‌شود.
- [احتمالاً] در رخداد امنیتی، timeline قابل دفاع نخواهد بود.

راه‌حل پیشنهادی:

- اگر `body.isAdmin === true`، reason اجباری و حداقل ۳ کاراکتر باشد.
- create user/admin و create audit log داخل یک Prisma transaction انجام شود تا اگر audit fail شد، user هم ساخته نشود.
- برای ساخت ادمین، owner guard یا owner check قبل از mutation بماند، اما UI هم باید owner capability را بداند.
- تست اضافه شود: audit failure در create admin باعث rollback user creation می‌شود.

اولویت: P0.

## P0-3: reveal/export PII با GET و reason داخل URL انجام می‌شود

[قطعی] بک‌اند:

- `apps/server/src/admin/admin.controller.ts:136` برای export از `@Get('users/:id/export')` استفاده می‌کند.
- `apps/server/src/admin/admin.controller.ts:146` برای reveal از `@Get('users/:id/reveal')` استفاده می‌کند.
- reason با `@Query('reason')` خوانده می‌شود.

[قطعی] فرانت:

- `apps/web/src/app/admin/tabs/UsersTab.jsx:106` خروجی را با `/export?reason=...` می‌گیرد.
- `apps/web/src/app/admin/tabs/UsersTab.jsx:121` reveal را با `/reveal?reason=...` می‌گیرد.

مشکل:

- [قطعی] reason داخل URL می‌تواند در browser history، proxy log، server access log، analytics ابزارها یا crash report دیده شود.
- [قطعی] GET برای عملیات حساسِ audit‌شونده و PII reveal/export semantic اشتباه است.
- [احتمالاً] prefetch/cache/extension/browser tooling می‌تواند ریسک جانبی ایجاد کند.

راه‌حل پیشنهادی:

- تبدیل به:
  - `POST /admin/users/:id/export` با `{ reason }` در body.
  - `POST /admin/users/:id/reveal` با `{ reason }` در body.
- پاسخ‌ها `Cache-Control: no-store` بگیرند.
- export فقط owner یا نقش privacy/export-admin.
- reveal حداقل role جدا یا owner/support role با step-up/re-auth.
- تست اضافه شود که query reason دیگر پذیرفته نمی‌شود.

اولویت: P0.

## P0-4: workflow actionها audit ledger ندارند

[قطعی] در `apps/server/src/workflow/workflow.controller.ts:33-50` عملیات زیر وجود دارد:

- `POST /admin/workflows/:key/run`
- `POST /admin/workflows/alerts/:id/ack`
- `POST /admin/workflows/alerts/:id/resolve`
- `POST /admin/workflows/alerts/:id/snooze`

[قطعی] هیچ‌کدام `recordAuditStrict` یا ledger ادمین ندارند. فقط داخل خود workflow/alert رکوردهایی آپدیت می‌شود.

ریسک:

- [قطعی] در مرکز فرماندهی واقعی، اینکه چه کسی alert را snooze/resolve کرده، باید audit-grade باشد.
- [قطعی] `runNow` می‌تواند load، alert، AI/cost یا DB work ایجاد کند؛ بدون audit و reason برای عملیات دستی کافی نیست.

راه‌حل پیشنهادی:

- برای `runNow`, `ack`, `resolve`, `snooze` audit strict اضافه شود.
- برای `resolve` و `snooze` reason کوتاه اجباری شود.
- `runNow` حداقل ops-owner یا owner guard داشته باشد، یا role جدا `ops_admin`.
- در UI پیام خطا و ثبت reason اضافه شود.
- تست اضافه شود: workflow action بدون audit انجام نمی‌شود.

اولویت: P0 برای run/resolve/snooze، P1 برای ack.

## P0-5: تست‌های اطمینان‌بخش برای این ریسک‌ها دیده نشد و تست‌های موجود در این محیط pass نشدند

[قطعی] اجرای تست‌ها در این محیط:

- `pnpm --dir apps/server test -- admin workflow --runInBand`
  - بار اول بدون CI به خطای pnpm interactive/no TTY خورد.
  - با `CI=true` بعد از ۱۲۴ ثانیه timeout شد.
- `pnpm --dir apps/web test src/app/admin/admin.smoke.test.jsx --runInBand`
  - با `CI=true` بعد از ۱۲۴ ثانیه timeout شد.

[نامطمئن] بنابراین نمی‌شود گفت وضعیت CI سبز است.

[قطعی] تست‌های جست‌وجوشده سناریوهای زیر را صریحاً پوشش نمی‌دهند:

- reveal/export نباید GET با query reason باشند.
- create admin باید reason و atomic audit داشته باشد.
- approve باید `active` کند.
- workflow actions باید audit شوند.

راه‌حل پیشنهادی:

- تست‌های P0 بالا به‌صورت unit/controller/service اضافه شود.
- smoke ادمین web باید زیر ۳۰ ثانیه قابل اجرا باشد.
- commandهای CI باید بدون نصب تعاملی و بدون purge prompt اجرا شوند.

اولویت: P0 برای تست‌های مرتبط با امنیت/لانچ.

---

# P1 - ایرادهای مهم امنیت، حریم خصوصی و معماری

## P1-1: reveal PII برای هر admin مجاز است، نه فقط owner یا نقش privacy/support دقیق

[قطعی] `GET /admin/users/:id/reveal` در `apps/server/src/admin/admin.controller.ts:146-150` reason و strict audit دارد، اما `OwnerGuard` ندارد.

[احتمالاً] شاید تصمیم محصولی این بوده که support admin بتواند تلفن/ایمیل را ببیند. اما برای استاندارد بین‌المللی، همه adminها نباید یک سطح دسترسی به PII داشته باشند.

راه‌حل:

- roleهای جدا: `owner`, `support_admin`, `privacy_admin`, `content_admin`, `ops_admin`.
- reveal فقط برای support/privacy با reason و rate limit.
- برای owner-grade actionها step-up auth یا re-auth.

## P1-2: ticket detail و ticket list هنوز PII خام کاربر را برمی‌گردانند

[قطعی] `apps/server/src/admin/admin-tickets.service.ts:42` در list، user phone/email را include می‌کند.

[قطعی] `apps/server/src/admin/admin-tickets.service.ts:53` در detail هم phone/email خام را برمی‌گرداند.

[قطعی] فرانت در `apps/web/src/app/admin/tabs/TicketsTab.jsx:163` phone/email را در drawer نشان می‌دهد.

ریسک:

- [قطعی] user list masked شده، اما support ticket مسیر فرار PII خام دارد.
- [احتمالاً] برای support گاهی لازم است، اما باید masked-by-default + reveal action باشد.

راه‌حل:

- ticket list همیشه masked.
- ticket detail masked-by-default.
- دکمه reveal contact در ticket drawer با reason و audit.
- یا حداقل فقط support/privacy role واقعی ببیند.

## P1-3: user observability ticket subject را به‌عنوان metadata نشان می‌دهد، اما subject free text است

[قطعی] `apps/server/src/admin/observability.service.ts:92` فیلد `subject` را در user dossier tickets برمی‌گرداند.

[قطعی] `apps/web/src/app/admin/tabs/UsersTab.jsx:353-355` همین subject را در کابین observability نشان می‌دهد.

مشکل:

- [قطعی] subject می‌تواند شامل شماره تماس، ایمیل، آدرس، بیماری، یا متن حساس باشد.
- [احتمالاً] این با ادعای «metadata-only dossier» سازگار نیست.

راه‌حل:

- در observability فقط `ticketId`, `status`, `priority`, `category`, `createdAt` نشان داده شود.
- subject فقط در Ticket detail و با role مناسب دیده شود.
- یا subject با PII scrub/truncate نمایش داده شود.

## P1-4: allergy/health data در admin user detail برای همه adminها قابل مشاهده است

[قطعی] user detail در `apps/server/src/admin/admin-users.service.ts:87-109` allergies، healthGoals، dietaryPrefs و سایر داده‌های حساس‌تر از contact را برمی‌گرداند.

[قطعی] profileTrace در observability allergy values را redacted می‌کند، اما user detail هنوز نام allergy را نشان می‌دهد.

ریسک:

- [قطعی] allergy و health goal از نظر privacy حساس‌تر از شماره تلفن هستند.
- [احتمالاً] برای اپ غذا/سلامت، این داده‌ها باید purpose-bound و role-gated باشند.

راه‌حل:

- default user detail: counts/flags، نه لیست کامل.
- reveal health/allergy با reason و نقش privacy/support.
- audit جدا برای مشاهده health-sensitive data.

## P1-5: DTOها شکل را چک می‌کنند، اما validation حرفه‌ای هنوز ناقص است

[قطعی] `apps/server/src/admin/dto/admin-user.dto.ts` فقط `IsString`, `IsBoolean`, `IsOptional` دارد.

[قطعی] `apps/server/src/admin/dto/update-ticket-status.dto.ts` مقدارهای `open`, `in-progress`, `closed` را قبول می‌کند، در حالی که ticket constants شامل `in_progress`, `pending`, `resolved`, `closed` است. این DTO هم در controller فعلی استفاده نشده است.

ریسک:

- [قطعی] DTO ticket فعلی هم ناقص است، هم با status واقعی mismatch دارد، هم unused است.
- [احتمالاً] validation به service منتقل شده، اما controller-level contract و Swagger/SDK/CI ضعیف می‌ماند.

راه‌حل:

- DTOهای واقعی برای:
  - `RespondTicketDto`
  - `UpdateTicketDto`
  - `CreateTicketNoteDto`
  - `RevealPiiDto`
  - `ExportUserDto`
  - `WorkflowActionDto`
- enumها از constants مشترک بیایند.
- `MaxLength`, `MinLength`, `IsEmail`, phone normalization و string trim transform اضافه شود.

## P1-6: سیستم audit دوپاره است و metrics غلط می‌دهد

[قطعی] `recordAuditStrict` به `UserAuditLog` می‌نویسد، اما `getSystemHealth` در `apps/server/src/admin/admin.service.ts:542` هنوز adminActions را از `UserEvent` با typeهای قدیمی می‌شمارد.

[قطعی] sensitive actions جدید مثل `admin_user_export`, `admin_user_pii_reveal`, `admin_user_delete`, `admin_user_password_reset`, `admin_user_force_logout` در این metric شمرده نمی‌شوند.

ریسک:

- [قطعی] عدد admin actions در health dashboard کمتر از واقعیت نشان داده می‌شود.
- [احتمالاً] اپراتور فکر می‌کند فعالیت مدیریتی کمتر بوده.

راه‌حل:

- health metric از `UserAuditLog` بخواند یا هر دو ledger را جدا گزارش کند.
- UI audit ledger viewer برای owner/security اضافه شود.
- taxonomy admin actions یکدست شود.

## P1-7: read auditها fire-and-forget هستند و برای user dossier کافی نیستند

[قطعی] مسیرهایی مثل user list/detail و analytics events از `recordAudit` fire-and-forget روی `UserEvent` استفاده می‌کنند.

[احتمالاً] برای dashboard عمومی ادمین قابل قبول است، اما برای مشاهده پرونده کاربر، session، health/allergy و observability باید audit durable باشد.

راه‌حل:

- user dossier open/view باید `UserAuditLog` سبک و durable داشته باشد.
- metadata view و sensitive reveal از هم جدا شوند.
- برای readهای سنگین rate limit و audit sampling policy تعریف شود.

## P1-8: force logout نه reason دارد، نه confirm، نه owner/ops role

[قطعی] بک‌اند در `apps/server/src/admin/admin.controller.ts:189-192` force logout را strict audit می‌کند، اما reason نمی‌گیرد.

[قطعی] فرانت در `apps/web/src/app/admin/tabs/UsersTab.jsx:101` مستقیم mutation می‌زند.

ریسک:

- [احتمالاً] force logout برای support لازم است، اما در حادثه امنیتی باید معلوم باشد چرا session کاربر باطل شد.

راه‌حل:

- reason اختیاری برای force logout حداقل در UI و audit.
- برای force logout دسته‌جمعی یا admin target، owner/ops role.
- confirm سبک.

## P1-9: کابین observability در maturity مقدار object را ممکن است `[object Object]` نشان دهد

[قطعی] بک‌اند `maturity` را object برمی‌گرداند: `apps/server/src/admin/observability.service.ts:64`.

[قطعی] فرانت در `apps/web/src/app/admin/tabs/UsersTab.jsx:339` این را render می‌کند:

```jsx
String(d.maturity?.stage ?? d.maturity ?? '—')
```

[قطعی] اگر `maturity.stage` وجود نداشته باشد و خود `maturity` object باشد، خروجی UI می‌شود `[object Object]`.

راه‌حل:

- نمایش `d.maturity?.band` یا `overallScore/band`.
- fallback object-safe formatter.
- smoke test برای profile trace با maturity object.

## P1-10: mutation error در Ticket drawer برای اپراتور واضح نیست

[قطعی] در `apps/web/src/app/admin/tabs/TicketsTab.jsx:151-153` mutationهای reply/update/note تعریف شده‌اند.

[قطعی] در همان drawer نمایش خطای متمرکز برای `respondM.error`, `updateM.error`, `noteM.error` دیده نمی‌شود.

ریسک:

- [احتمالاً] اپراتور روی ارسال پاسخ/تغییر وضعیت کلیک می‌کند، درخواست fail می‌شود، ولی feedback کافی نمی‌گیرد.

راه‌حل:

- ErrorLine مشترک در بالای drawer.
- disable/rollback optimistic یا حداقل toast/inline failure.
- log correlation id در خطا برای پشتیبانی.

## P1-11: TagsInput روی هر تغییر فوراً PATCH می‌زند

[قطعی] در `apps/web/src/app/admin/tabs/TicketsTab.jsx:178` `TagsInput` روی هر `onChange` مستقیم `updateM.mutate({ tags: v })` می‌زند.

ریسک:

- [احتمالاً] هنگام تایپ/حذف tag چند PATCH پشت سر هم می‌خورد.
- [احتمالاً] race condition باعث ذخیره آخرین وضعیت اشتباه می‌شود.

راه‌حل:

- دکمه Save برای tags یا debounce 600ms با cancellation.
- mutation key جدا برای tags.
- pending/error state کنار همان field.

## P1-12: freshness indicator حس اطمینان کاذب می‌دهد

[قطعی] `FreshnessPill` در `apps/web/src/app/admin/page.jsx:34` فقط ساعت/حالت کلی را نشان می‌دهد.

[قطعی] این pill نشان نمی‌دهد کدام query stale/error است.

ریسک:

- [احتمالاً] اپراتور فکر می‌کند کل داشبورد تازه است، در حالی که یک پنل ممکن است error یا stale باشد.

راه‌حل:

- هر panel `lastUpdated`, `source`, `status` داشته باشد.
- topbar یک aggregate واقعی از query failures/staleness نشان دهد.
- errorهای partial در dashboard با badge دیده شوند.

## P1-13: revenue tab هنوز زودتر از اتصال پرداخت در navigation است

[قطعی] `apps/web/src/app/admin/page.jsx:63` revenue را به عنوان tab نمایش می‌دهد، اما فقط `PostLaunch` است.

[احتمالاً] برای داخلی بودن مشکلی ندارد، اما در پنل لانچ، tabهای post-launch اگر داده واقعی ندارند باید یا hidden باشند یا در بخش planning جدا باشند.

راه‌حل:

- revenue تا اتصال payment پنهان شود.
- یا زیر `Post-launch / Planning` جدا از عملیات روزانه باشد.

## P1-14: admin roles هنوز flat هستند

[قطعی] `RolesGuard` فقط مفهوم `admin` را اعمال می‌کند و owner بودن از env allowlist می‌آید.

[احتمالاً] برای MVP داخلی قابل تحمل است، اما برای اپ بین‌المللی کافی نیست.

راه‌حل:

- role/permission matrix:
  - owner
  - ops_admin
  - support_admin
  - content_moderator
  - privacy_admin
  - finance_admin
  - ai_ops
- endpoint `GET /admin/me/permissions` برای UI.
- frontend hide/disable واقعی actionها بر اساس capability.

## P1-15: OwnerGuard مبتنی بر env allowlist است، نه RBAC پایدار

[قطعی] OwnerGuard با `ADMIN_OWNER_IDS` کار می‌کند و اگر env خالی باشد fail-closed است.

[احتمالاً] fail-closed خوب است، اما برای مدیریت تیم، audit، تغییر مالک، emergency access، و rotation کافی نیست.

راه‌حل:

- owner role در DB با migration و bootstrap امن.
- break-glass account با audit و expiry.
- MFA/step-up برای owner actionها.

## P1-16: analytics events limit در admin service clamp کامل ندارد

[قطعی] `getRecentEvents(limit = 100, page = 1, ...)` در `apps/server/src/admin/admin.service.ts:218-246` از limit ورودی برای `take` استفاده می‌کند.

[احتمالاً] اگر controller limit بزرگ بگیرد، admin endpoint می‌تواند load غیرضروری ایجاد کند.

راه‌حل:

- clamp: `take = Math.min(Math.max(limit, 1), 200)`.
- page max یا cursor pagination.
- query DTO با transform.

## P1-17: search/content gaps هنوز policy روشن برای raw query ندارد

[قطعی] `getContentGaps` در `apps/server/src/admin/admin.service.ts:88-99` اگر `payload.query` وجود داشته باشد، آن را aggregate می‌کند.

[احتمالاً] کامنت‌ها می‌گویند shape-only/raw query ذخیره نمی‌شود، اما این service خودش enforce نمی‌کند. اگر producer اشتباه raw query بنویسد، admin آن را نشان می‌دهد.

راه‌حل:

- فقط `queryHash`, `normalizedIntent`, `ingredientTag` یا category مجاز باشد.
- raw query در content gaps حذف یا scrub شود.
- تست payload با PII query اضافه شود.

---

# P2 - ایرادهای مهم اما غیرمسدودکننده

## P2-1: duplication و drift در masking utilities

[قطعی] masking در `apps/server/src/admin/pii.util.ts` وجود دارد، اما `apps/server/src/admin/admin.service.ts:10-18` هم `maskPhone/maskEmail` جدا تعریف کرده است.

ریسک:

- [احتمالاً] در آینده یک نسخه اصلاح می‌شود و دیگری نه.

راه‌حل:

- فقط `pii.util.ts` منبع واحد باشد.
- تست shared برای فرمت mask.

## P2-2: dead/legacy methods در AdminService باقی مانده‌اند

[قطعی] `getAllTickets`, `respondToTicket`, `updateTicketStatus`, `getAllUsers` در `apps/server/src/admin/admin.service.ts:154-215` هنوز وجود دارند، در حالی که مسیرهای جدید از `AdminTicketsService` و `AdminUsersService` استفاده می‌کنند.

ریسک:

- [احتمالاً] توسعه‌دهنده بعدی ممکن است اشتباهی از مسیر قدیمی استفاده کند.

راه‌حل:

- حذف یا deprecate با تست import/usage.
- AdminService فقط analytics/content/system بماند.

## P2-3: refresh کل admin query namespace را invalidate می‌کند

[قطعی] `apps/web/src/app/admin/page.jsx:134` از `queryClient.invalidateQueries({ queryKey: ['admin'] })` استفاده می‌کند.

[احتمالاً] React Query معمولاً فقط active observerها را refetch می‌کند، اما برای پنل سنگین، refresh دقیق‌تر بهتر است.

راه‌حل:

- refresh مخصوص tab فعال.
- یا topbar refresh با dropdown: active tab / all live data / hard refresh.

## P2-4: narrow nav با title تنها برای موبایل/تاچ کافی نیست

[احتمالاً] nav باریک icon-only شده و title دارد، اما روی touch title کمکی نمی‌کند.

راه‌حل:

- aria-label برای هر tab button.
- selected state واضح.
- bottom sheet یا compact tab switcher برای موبایل.

## P2-5: نمایش contact بعد از reveal فقط phone یا email را نشان می‌دهد

[قطعی] `apps/web/src/app/admin/tabs/UsersTab.jsx:209` بعد از reveal این را نشان می‌دهد:

```jsx
revealed.phone || revealed.email || '—'
```

[احتمالاً] اگر کاربر هر دو را دارد، یکی پنهان می‌ماند.

راه‌حل:

- هر دو مقدار با label جدا نشان داده شود.
- copy button جدا برای هرکدام با audit اختیاری.

## P2-6: create admin switch برای همه adminها دیده می‌شود

[قطعی] `apps/web/src/app/admin/tabs/UsersTab.jsx:447` switch «نقش مدیر (فقط مالک)» را نشان می‌دهد.

[احتمالاً] backend غیرمالک را رد می‌کند، اما UX برای admin غیرمالک گیج‌کننده است.

راه‌حل:

- UI capability endpoint.
- برای غیرمالک disabled با توضیح کوتاه.
- برای مالک reason و confirm.

---

# نکات مثبت واقعی بعد از اصلاحات

[قطعی] این موارد نسبت به گزارش قبلی بهتر شده‌اند:

- user list و user detail دیگر phone/email خام را پیش‌فرض نشان نمی‌دهند.
- reveal PII reason و audit دارد، هرچند route semantic و role هنوز ایراد دارد.
- export user owner-gated و reason/audit دارد، هرچند هنوز GET/query است.
- delete/password reset/recipe approve/reject owner-gated شده‌اند.
- role change برای غیر owner رد می‌شود.
- ban/delete/password reset دلیل می‌گیرند.
- topbar دیگر export کل cache ندارد.
- ticket metrics، assignee، priority، category، SLA و tags اضافه شده‌اند.
- rowهای user/ticket با keyboard قابل باز شدن هستند.
- active users در realtime از server-side distinct count می‌آید، نه حدس client-side.
- workflow unknown key در runs/runNow 404 می‌دهد.
- scheduler workflow claim اتمیک دارد و duplicate run را کم می‌کند.
- runbook برای workflowها در UI دیده می‌شود.
- attention queue ترکیبی از alerts و tickets ساخته شده است.

---

# نقشه اصلاح پیشنهادی برای Claude Code

## مرحله ۱ - قبل از هر چیز، P0ها

1. [قطعی] `admin approve recipe` را از `approved` به `active` اصلاح کن و تست public visibility اضافه کن.
2. [قطعی] `reveal/export` را از GET به POST body تبدیل کن؛ reason را از URL حذف کن؛ `no-store` بگذار.
3. [قطعی] create user/admin را transaction کن: create + audit log atomic؛ برای `isAdmin` reason اجباری.
4. [قطعی] workflow run/resolve/snooze/ack را audit کن؛ برای run/resolve/snooze reason یا role دقیق بگذار.
5. [قطعی] تست‌های امنیتی همین چهار مورد را اضافه کن.

معیار موفقیت:

- هیچ sensitive mutation بدون audit durable انجام نشود.
- هیچ reason در URL نباشد.
- approve در ادمین باعث public visibility واقعی شود.
- workflow manual action در audit ledger قابل جست‌وجو باشد.

## مرحله ۲ - privacy و role model

1. [احتمالاً] role matrix را اضافه کن: owner/support/content/ops/privacy.
2. [قطعی] ticket contact را masked-by-default کن.
3. [قطعی] user observability ticket subject را حذف یا scrub کن.
4. [قطعی] allergy/health data را default-redacted کن.
5. [احتمالاً] `GET /admin/me/permissions` برای فرانت اضافه کن.

معیار موفقیت:

- admin معمولی بدون reason و role مناسب نتواند contact/health-sensitive data کامل ببیند.
- UI actionهای غیرمجاز را از قبل disable/hide کند، نه اینکه فقط backend خطا بدهد.

## مرحله ۳ - reliability و UX عملیاتی

1. [قطعی] Ticket drawer error states اضافه کن.
2. [قطعی] TagsInput را debounced/save-based کن.
3. [قطعی] maturity object در observability درست render شود.
4. [احتمالاً] FreshnessPill به status واقعی queryها وصل شود.
5. [احتمالاً] Revenue tab تا اتصال پرداخت hide شود.

معیار موفقیت:

- اپراتور هیچ mutation شکست‌خورده‌ای را بی‌خبر نماند.
- داشبورد تازه/خراب/در انتظار را صادقانه نشان دهد.

## مرحله ۴ - cleanup و نگهداری

1. [قطعی] masking utility را یکی کن.
2. [احتمالاً] legacy admin service methods را حذف/deprecate کن.
3. [قطعی] DTOهای ticket/workflow/user را کامل کن.
4. [قطعی] admin health metric را از UserAuditLog هم بخوان.
5. [احتمالاً] audit ledger viewer برای owner/security بساز.

---

# تست‌هایی که باید اضافه شوند

## Backend

- [قطعی] `approveRecipe_sets_status_active_and_public_surfaces_can_read`
- [قطعی] `createAdmin_requires_owner_and_reason`
- [قطعی] `createAdmin_rolls_back_when_audit_fails`
- [قطعی] `exportUser_rejects_GET_and_accepts_POST_body_reason`
- [قطعی] `revealPii_rejects_query_reason`
- [قطعی] `workflow_run_writes_admin_audit`
- [قطعی] `workflow_resolve_requires_reason_or_records_reason`
- [قطعی] `ticket_detail_masks_contact_by_default`
- [قطعی] `observability_tickets_do_not_return_subject_or_scrub_pii`
- [قطعی] `analytics_events_limit_is_clamped`

## Frontend

- [قطعی] user create admin flow shows reason/confirm.
- [قطعی] reveal/export call POST with body, not GET query.
- [قطعی] ticket drawer shows mutation errors.
- [قطعی] observability maturity object renders band/score, not `[object Object]`.
- [قطعی] non-owner cannot see/trigger owner-only actions if permissions endpoint says false.
- [قطعی] revenue tab hidden when payment is disconnected.

---

# وضعیت تست در این ممیزی

[قطعی] تست‌ها در این محیط به نتیجه قابل اتکا نرسیدند:

```text
pnpm --dir apps/server test -- admin workflow --runInBand
```

نتیجه: ابتدا به no-TTY/CI مشکل خورد؛ با `CI=true` در ۱۲۴ ثانیه timeout شد.

```text
pnpm --dir apps/web test src/app/admin/admin.smoke.test.jsx --runInBand
```

نتیجه: با `CI=true` در ۱۲۴ ثانیه timeout شد.

[نامطمئن] ممکن است در CI واقعی pass شود، اما در این ممیزی pass/fail قابل تأیید نیست.

---

# ریسک‌های لانچ اگر همین الان deploy شود

| ریسک | شدت | دلیل |
|---|---:|---|
| رسپی approve شده منتشر نشود | P0 | status mismatch بین `approved` و `active`. |
| admin ساخته شود ولی audit نداشته باشد | P0 | audit بعد از create انجام می‌شود. |
| reason و PII action در URL log شود | P0 | reveal/export با GET query reason. |
| workflow action بدون audit انجام شود | P0 | run/resolve/snooze/ack ledger ندارند. |
| PII از ticket مسیر فرار داشته باشد | P1 | ticket detail/list contact خام دارد. |
| health/allergy data بیش از حد دیده شود | P1 | user detail sensitive data را default نشان می‌دهد. |
| dashboard عدد audit غلط بدهد | P1 | health فقط UserEvent قدیمی را می‌شمارد. |
| اپراتور خطای mutation ticket را نبیند | P1 | خطای inline برای mutationها دیده نمی‌شود. |
| observability مقدار خراب نشان دهد | P1 | maturity object ممکن است `[object Object]` شود. |

---

# نتیجه عملی

[قطعی] این پنل بعد از اصلاحات قبلی بهتر شده، اما هنوز برای لانچ حرفه‌ای باید اول چهار P0 حل شود: status انتشار رسپی، POST شدن reveal/export، atomic audit برای create admin/user، و audit workflow actionها.

[قطعی] پیشنهاد من این است که Claude Code اول فقط همین P0ها را اصلاح کند و برای هرکدام تست هدفمند بگذارد؛ بعد سراغ role matrix و privacy cleanup برود. تا وقتی این چهار مورد بسته نشود، پنل ادمین از نظر من «مرکز فرماندهی قابل دفاع» نیست.
