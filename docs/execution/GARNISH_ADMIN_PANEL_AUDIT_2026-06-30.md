# گزارش ممیزی پنل ادمین گارنیش - 2026-06-30

## ✅ رفعِ ایرادها — لاگِ پیشرفت (در حالِ اجرا)
- **P0-4 (export کلِ cache):** ✅ حذف شد + پوش (`430f03c5`). دکمه + onExport + import رفت — هر export باید server-side + owner + reason + audit + redaction شود.
- **P0-3 (audit ledger):** ✅ `recordAuditStrict` روی `UserAuditLog` (بادوام/SetNull، **fail-closed**، actor+target+reason+ip+userAgent+after) جای fire-and-forgetِ `UserEvent`؛ روی هر ۷ عملیاتِ حساس؛ **live-tested** (ساخت→ردیفِ audit نشست، حذف پاک شد) + پوش (`3c7fc5ab`).
- **مسیرِ کم‌ریسکِ انتخابی:** بدونِ DB migration روی DBِ پیش‌از‌لانچ — OwnerGuard با allowlistِ env + استفادهٔ مجددِ `UserAuditLog`.
- **P0-1 + P0-2 (owner gate + reason + تأییدِ تایپی):** ✅ OwnerGuard روی delete/password/export/role (`ADMIN_OWNER_IDS` در .env) + `requireReason` + DangerModalِ یک‌پارچهٔ FE (reason الزامی + تایپِ نامِ کاربر برای حذف + خطای 403/400) + تفکیکِ tier (P1-9). **زنده تست:** بی‌دلیل→۴۰۰، با‌دلیل→۲۰۰، owner مجاز. پوش (`2531b322`).
- **P0-3 (پایداریِ audit در برابرِ erasure):** ✅ کشفِ گپ: `erasure.service.ts:62` details/ip ردیف‌های UserAuditLogِ هدف را null می‌کند → audit حذف به **actor (ادمین)** کلید خورد، targetId در details. **زنده تست:** بعد از حذفِ کاربر، audit با کلِ `{actorId, targetId, reason, ip}` ماند.
- **P0-5 (PII):** ✅ list/detail با `pii.util` mask + endpointِ `reveal` (reason + audit) + دکمهٔ «نمایشِ کامل» در FE. **زنده تست:** detail `+99•••••0066`، reveal با reason `+99000000066`، بی‌reason→۴۰۰. پوش (`5c881109`).
- **P1-2 + P1-3 (workflow):** ✅ منبعِ ناموجود→۴۰۴ (NotFoundException) + scheduler claimِ اتمیک (`updateMany` شرطی، ضدِ double-fire). **زنده تست:** ack/runsِ ناموجود→۴۰۴، لیستِ معتبر→۲۰۰. پوش (`421b8604`).
- **✅✅ تیرِ P0 ۱۰۰٪ کامل + زنده‌تأیید + پوش.** ضمناً: P1-9 (تفکیکِ tierِ drawer) + P2-2ِ کاربران (a11yِ ردیف: role/tabIndex/Enter) هم انجام شد.
- **P1-1 (DTOها + validation):** ✅ DTOهای typed (Create/Update/ResetPassword/Ban/Reason) روی endpointهای کاربر؛ قواعدِ business در service (کدهای خطای FE حفظ). **زنده تست:** معتبر→ok، فیلدِ ناشناخته→۴۰۰. پوش (`891ef530`).
- **مانده (P1/P2 — کیفیت/UX/معماری، نه بلاکرِ امنیتی):** P1-4 UIِ تیکت · P1-5 moderation · P1-6 observability drawer · P1-7/8 بازچینیِ تب‌ها · P1-12 برچسبِ near-realtime · P1-13 active-users · P1-14 runbook · P1-15 تست‌های e2e · P1-16 any · P2-1 mobile · P2-2 a11yِ تیکت · P2-3 خطا. (بزرگ‌ها: drawer · بازچینی · تست.)
- **حادثهٔ ابزاری:** `pnpm install` (برای رفعِ vite که خراب شده بود) کلاینتِ Prisma را پاک کرد → سرور لحظه‌ای down شد → `prisma generate` + restart → سالم. درس: `pnpm install` وسطِ کارِ زنده نزن.

---


## 1. Reality Check

[قطعی] پنل ادمین گارنیش از نظر گستره فیچرها ضعیف نیست؛ مشکل اصلی این است که برای لانچ بین المللی، «مرکز فرماندهی» باید کمتر شبیه مجموعه ای از تب های تحلیلی و بیشتر شبیه سیستم عملیات، امنیت، پشتیبانی و incident response باشد.

[قطعی] برای لانچ هفته بعد، وضعیت فعلی را «قابل استفاده برای founder/admin داخلی» می دانم، نه «پنل ادمین بین المللی در سطح بهترین اپ های دنیا».

[احتمالاً] بزرگ ترین ریسک لانچ، UI نیست؛ ترکیب این موارد است: دسترسی ادمین تک سطحی، عملیات خطرناک بدون re-auth / MFA / approval، audit غیرکافی برای کارهای حساس، و نبود runbook/SLA عملیاتی داخل خود پنل.

[قطعی] طبق درخواست، هیچ فایل اپ، کد، schema یا تستی را تغییر ندادم. فقط همین فایل گزارش اضافه شده است.

## 2. دامنه بررسی

[قطعی] فایل های اصلی فرانت ادمین بررسی شدند:

- `apps/web/src/app/admin/page.jsx`
- `apps/web/src/app/admin/useAdmin.js`
- `apps/web/src/app/admin/_ui.jsx`
- `apps/web/src/app/admin/AttentionQueue.jsx`
- `apps/web/src/app/admin/PulseStrip.jsx`
- `apps/web/src/app/admin/DailyBrief.jsx`
- `apps/web/src/app/admin/tabs/*.jsx`
- `apps/web/src/app/admin/admin.smoke.test.jsx`

[قطعی] فایل های اصلی بک اند ادمین و workflow بررسی شدند:

- `apps/server/src/admin/*.ts`
- `apps/server/src/workflow/*.ts`
- `apps/server/src/auth/roles.guard.ts`
- `apps/server/src/auth/jwt.strategy.ts`
- `apps/server/src/app.module.ts`
- `apps/server/src/main.ts`
- بخش های مرتبط در `apps/server/prisma/schema.prisma`

[نامطمئن] تست های هدفمند ادمین/workflow در این محیط به نتیجه نرسیدند. اجرای `pnpm --dir apps/server test -- admin workflow --runInBand` و `pnpm --dir apps/web test src/app/admin/admin.smoke.test.jsx --runInBand` ابتدا به خطای purge بدون TTY خورد و با `CI=true` بعد از حدود 2 دقیقه timeout شد. بنابراین این گزارش «تحلیل کد» است، نه تأیید کامل تست/رندر زنده.

## 3. خلاصه اجرایی

| اولویت | حوزه | وضعیت | تصمیم پیشنهادی قبل از لانچ |
|---|---|---:|---|
| P0 | امنیت ادمین | [قطعی] تک نقش `admin` همه کاره است | اضافه کردن `super-admin` برای delete/export/role-change/password-reset یا حداقل re-auth اجباری |
| P0 | Audit حساس | [قطعی] audit روی `UserEvent` و fire-and-forget است | انتقال عملیات حساس به audit ledger append-only و fail-closed برای رخدادهای حساس |
| P0 | Export/PII | [قطعی] export کل cache ادمین در UI وجود دارد | حذف یا محدودسازی export کلی؛ export هدفمند با reason و audit |
| P0 | عملیات خطرناک کاربر | [قطعی] delete/ban/reset/admin-role در یک drawer انجام می شود | confirmation قوی، reason اجباری، re-auth و محدودیت نقش |
| P1 | معماری تب ها | [احتمالاً] دسته بندی فعلی برای کنترل برج مراقبت بهینه نیست | بازچینی به Command, Users & Support, Product, AI/Cost, Safety, System |
| P1 | Backend validation | [قطعی] اکثر body/queryهای admin DTO ندارند | DTO + class-validator برای endpointهای admin/workflow |
| P1 | Incident workflow | [قطعی] alert هست، runbook/escalation/owner/SLA نیست | اضافه کردن owner, runbookUrl, dueAt, escalationChannel به alert/workflow |
| P1 | Observability UI | [قطعی] backend observability دارد ولی فرانت مستقیم برای آن دیده نشد | اضافه کردن user timeline/profile trace داخل Users drawer |
| P1 | Ticket ops | [قطعی] backend assignee/tags دارد ولی UI کنترل کامل ندارد | افزودن assignee/tags/SLA breach filters در Tickets tab |
| P2 | Design polish | [احتمالاً] UI مینیمال و کاربردی است اما dense ops grid کامل نیست | بهبود hierarchy، sticky action bars، error boundaries، keyboard flow |

## 4. نقاط قوت واقعی

[قطعی] ادمین با `AuthGuard('jwt')` و `RolesGuard` محافظت شده است. شواهد: `apps/server/src/admin/admin.controller.ts:11-12` و `apps/server/src/workflow/workflow.controller.ts:13-14`.

[قطعی] JWT invalidation برای ban / force logout / password reset با `sessionEpoch` طراحی شده و این از حذف صرف session بهتر است. شواهد: `apps/server/src/auth/jwt.strategy.ts:28` و `apps/server/src/admin/admin-users.service.ts:148`, `157`, `167`.

[قطعی] پنل فقط عدد fake نشان نمی دهد و الگوی `real / awaiting_pilot / partial / awaiting_rates` در UI وجود دارد. شواهد: `apps/web/src/app/admin/_ui.jsx:41-44`, `apps/web/src/app/admin/useAdmin.js:8-18`.

[قطعی] attention queue و pulse strip شروع خوبی برای command center هستند. شواهد: `apps/web/src/app/admin/AttentionQueue.jsx:43-49`, `apps/web/src/app/admin/PulseStrip.jsx:42-50`.

[قطعی] ticket system نسبت به یک inbox ساده جلوتر است: first response، status، priority، category، notes و notification دارد. شواهد: `apps/server/src/admin/admin-tickets.service.ts:61-77`, `81-97`, `113-129`.

[قطعی] workflow engine برای guardrailهای لانچ وجود دارد و alert feed، manual run، ack/resolve/snooze دارد. شواهد: `apps/server/src/workflow/workflow.service.ts:53-85`, `99-134`.

[قطعی] global `ValidationPipe`، CORS محدود و throttle عمومی در bootstrap/module فعال اند. شواهد: `apps/server/src/main.ts:40-52`, `apps/server/src/app.module.ts:45`, `71`.

## 5. ایرادهای حیاتی امنیت و دسترسی

### P0-1: تک نقش admin برای همه عملیات حساس

[قطعی] `RolesGuard` فقط `admin` را می شناسد و سطح بندی ندارد. شواهد: `apps/server/src/auth/roles.guard.ts:22`.

[قطعی] همین نقش می تواند user بسازد، نقش ادمین بدهد/بردارد، password reset کند، ban کند، force logout کند، export بگیرد و delete کامل انجام دهد. شواهد: `apps/server/src/admin/admin.controller.ts:126-161`.

[قطعی] در فرانت هم role change، reset password، force logout، ban، export و delete در همان user drawer چیده شده اند. شواهد: `apps/web/src/app/admin/tabs/UsersTab.jsx:239-246`.

[احتمالاً] در یک پنل بین المللی، این برای production قابل دفاع نیست. حداقل باید این سطح ها جدا شوند:

- `support_admin`: دیدن ticket و پاسخ دادن، بدون export/delete/password reset.
- `ops_admin`: دیدن health/workflow و ack/resolve، بدون PII کامل.
- `security_admin`: ban/force logout و مشاهده audit/security.
- `super_admin`: role change، full export، hard delete، password reset.

ریسک فعلی: [قطعی] compromise یک حساب admin یعنی compromise کامل داده های کاربر و عملیات.

اقدام قبل از لانچ: [قطعی] حداقل `super_admin` یا `isOwner` برای `DELETE /admin/users/:id`, `PATCH /admin/users/:id/password`, `GET /admin/users/:id/export`, `PATCH /admin/users/:id` با `isAdmin` لازم است.

### P0-2: نبود MFA / re-auth برای عملیات خطرناک

[احتمالاً] در کد بررسی شده نشانه ای از MFA، step-up auth، password re-entry یا WebAuthn برای admin action دیده نشد.

[قطعی] reset password فقط password جدید می گیرد و حداقل 6 کاراکتر را بررسی می کند. شواهد: `apps/server/src/admin/admin-users.service.ts:144-148`.

[قطعی] delete user در فرانت confirmation modal دارد، اما re-auth یا عبارت تأییدی سخت گیرانه دیده نمی شود. شواهد: `apps/web/src/app/admin/tabs/UsersTab.jsx:260-271`.

ریسک: [قطعی] اگر session ادمین روی دستگاهی باز بماند، عملیات برگشت ناپذیر قابل انجام است.

اقدام قبل از لانچ: [احتمالاً] برای `delete`, `export`, `role change`, `password reset`, `ban` یک step-up auth 10 دقیقه ای اضافه شود. اگر زمان کم است، حداقل modal باید reason اجباری + تایپ `DELETE USER` یا نام کاربر + ثبت IP/userAgent داشته باشد.

### P0-3: audit فعلی برای عملیات حساس کافی نیست

[قطعی] `recordAudit` روی `UserEvent` می نویسد و failure را swallow می کند. شواهد: `apps/server/src/admin/admin.service.ts:35-39`.

[قطعی] `UserEvent` به `User` با Cascade وصل است؛ اگر ادمین حذف شود، audit actionهای خودش هم می تواند از بین برود. شواهد مدل `UserEvent` در `apps/server/prisma/schema.prisma` و استفاده از `userId` در `recordAudit`.

[احتمالاً] برای GDPR/امنیت سازمانی، audit باید append-only، مستقل از lifecycle کاربر، دارای actorId, targetId, action, reason, ip, userAgent, before/after diff و نتیجه باشد.

ریسک: [قطعی] در رخداد امنیتی، اثبات «چه کسی چه چیزی را تغییر داد» قابل اتکا نیست.

اقدام قبل از لانچ: [قطعی] برای عملیات حساس audit را fail-closed کنید: اگر audit write نشد، mutation انجام نشود. برای viewهای عادی می تواند fire-and-forget بماند.

### P0-4: export کلی cache ادمین در UI خطرناک است

[قطعی] دکمه export در topbar کل query cache با key `admin` را JSON می کند. شواهد: `apps/web/src/app/admin/page.jsx:122-128`.

[قطعی] این cache می تواند PII واقعی، ticket text، user detail، sessions و analytics را شامل شود؛ چون `AdminUsersService` و `AdminTicketsService` عمداً phone/email واقعی را برمی گردانند. شواهد: `apps/server/src/admin/admin-users.service.ts:50`, `84`, `125` و `apps/server/src/admin/admin-tickets.service.ts:41`, `52`.

[قطعی] این export کلی در بک اند audit نمی شود، چون client-side از cache dump می گیرد.

ریسک: [قطعی] data exfiltration بی صدا و بدون ردپای server-side.

اقدام قبل از لانچ: [قطعی] دکمه export کلی حذف شود یا فقط برای super-admin با endpoint server-side، reason اجباری، audit و redaction فعال شود.

## 6. ایرادهای بک اند و API

### P1-1: DTO و validation ادمین ناقص است

[قطعی] `ValidationPipe` سراسری فعال است، اما controllerهای ادمین body/query را عمدتاً با type inline می گیرند، نه DTO دارای `class-validator`. شواهد: `apps/server/src/admin/admin.controller.ts:59-68`, `126-148`, `164-181`, `227-228`.

[قطعی] `UpdateTicketStatusDto` وجود دارد ولی برای update کامل ticket استفاده نشده است. شواهد: `apps/server/src/admin/dto/update-ticket-status.dto.ts` و `apps/server/src/admin/admin.controller.ts:59-62`.

[احتمالاً] validation دستی در serviceها بخشی از ریسک را کم کرده، اما queryها، lengthها، reasonها، email format، password strength و pagination contract استاندارد نیستند.

اقدام: [قطعی] DTOهای زیر لازم اند:

- `ListAdminUsersDto`
- `CreateAdminUserDto`
- `UpdateAdminUserDto`
- `ResetUserPasswordDto`
- `BanUserDto`
- `ListTicketsDto`
- `UpdateTicketDto`
- `TicketReplyDto`
- `WorkflowAlertActionDto`

### P1-2: workflow endpointها خطا را با body برمی گردانند، نه HTTP status درست

[قطعی] `runNow`, `getRuns`, `ackAlert`, `resolveAlert`, `snoozeAlert` برای unknown workflow/alert `{ error: ... }` برمی گردانند. شواهد: `apps/server/src/workflow/workflow.service.ts:93`, `101`, `112`, `122`, `134`.

[احتمالاً] در UI این می تواند به عنوان success mutation تلقی شود، چون HTTP 200 است.

اقدام: [قطعی] برای unknown resource از `NotFoundException` و برای action نامعتبر از `BadRequestException` استفاده شود.

### P1-3: scheduler workflow در multi-instance race-safe نیست

[قطعی] scheduler ابتدا due workflowها را `findMany` می کند و بعد با `update` ساده `nextRunAt` را جلو می برد. شواهد: `apps/server/src/workflow/workflow-scheduler.service.ts:27-40`.

[احتمالاً] اگر دو instance همزمان due rows را ببینند، هر دو می توانند همان workflow را اجرا کنند؛ update شرطی روی `nextRunAt <= now` یا lock/claim atomic وجود ندارد.

ریسک: [احتمالاً] alert تکراری، بار اضافه روی AI/DB، و نتایج متناقض در run history.

اقدام: [قطعی] claim باید `updateMany({ where: { id, nextRunAt: { lte: now } } })` باشد و فقط وقتی `count === 1` اجرا شود، یا از advisory lock/transaction استفاده شود.

### P1-4: ticket assignee/tags در backend هست، UI کامل نیست

[قطعی] schema و service از `assigneeId` و `tags` پشتیبانی می کنند. شواهد: `apps/server/prisma/schema.prisma:397-398`, `apps/server/src/admin/admin-tickets.service.ts:31-32`, `96-97`.

[قطعی] در `TicketsTab` کنترل visible برای assignee و tags دیده نمی شود؛ UI فقط status/priority/category را در detail کنترل می کند. شواهد: `apps/web/src/app/admin/tabs/TicketsTab.jsx:150-154`.

ریسک: [احتمالاً] وقتی حجم ticket بالا رفت، owner و دسته بندی عملیاتی واقعی ندارید.

اقدام: [قطعی] assignee dropdown، tag editor، فیلتر `unassigned`, `urgent`, `SLA breach`, و ستون owner اضافه شود.

### P1-5: backend recipe moderation دارد، frontend surface ندارد

[قطعی] endpointهای `GET /admin/recipes`, `PATCH /admin/recipes/:id/approve`, `PATCH /admin/recipes/:id/reject` وجود دارند. شواهد: `apps/server/src/admin/admin.controller.ts:71-85`.

[قطعی] در تب های ادمین، استفاده مستقیم از `/admin/recipes` یا approve/reject دیده نشد؛ ContentTab فقط analytics recipes را می خواند. شواهد: `apps/web/src/app/admin/tabs/ContentTab.jsx:12-15`.

ریسک: [احتمالاً] moderation محتوا از پنل فرماندهی قابل انجام نیست، در حالی که backend آماده است.

اقدام: [احتمالاً] اگر user-generated recipe برای لانچ ندارید، این surface را مخفی و endpointها را محدود نگه دارید. اگر دارید، Content tab باید `Moderation Queue` داشته باشد.

### P1-6: observability backend بدون UI عملیاتی کامل

[قطعی] `admin/observability` برای event stream، observations و profile trace وجود دارد. شواهد: `apps/server/src/admin/observability.controller.ts:8-27`.

[قطعی] در فرانت ادمین فقط `ops/ai-observability` مصرف شده و user observability endpoints مستقیم مصرف نشده اند. شواهد: جست وجو فقط `apps/web/src/app/admin/PulseStrip.jsx:44` و `apps/web/src/app/admin/tabs/AiCostTab.jsx:18` را برای observability نشان داد.

ریسک: [احتمالاً] claim «مو از زیر دستم در نرود» برای user-level investigation کامل نیست.

اقدام: [قطعی] در user drawer تب های `Timeline`, `Signals`, `Profile Trace`, `Consent provenance`, `Recent AI calls`, `Recent tickets` لازم است.

## 7. ایرادهای فرانت، UX و طراحی داشبورد

### P1-7: taxonomy تب ها مرکز فرماندهی نیست

[قطعی] تب های فعلی شامل overview, behavior, engagement, retention, content, ai, safety, realtime, users, tickets, automation, revenue هستند. شواهد: `apps/web/src/app/admin/page.jsx:51-64`.

[قطعی] group بندی فعلی `تحلیل / هوش مصنوعی / عملیات` است و safety/realtime/revenue داخل operations قرار گرفته اند. شواهد: `apps/web/src/app/admin/page.jsx:66-70`.

[احتمالاً] برای یک control tower، بهتر است navigation بر اساس job-to-be-done باشد، نه نوع متریک:

1. `Command`: Pulse, Attention Queue, Daily Brief, Active Incidents, SLA breaches.
2. `Users`: roster, user dossier, sessions, GDPR actions.
3. `Support`: tickets, SLA, macros, assignments.
4. `Product`: funnels, retention, engagement, behavior, content gaps.
5. `AI & Cost`: AI observability, model reliability, tokens/cost/budget.
6. `Safety & Compliance`: allergens, privacy, consent, data export/erasure, audit log.
7. `Automation`: workflows, runs, alerts, runbooks.
8. `System`: uptime, API latency, DB/queue/cron/outbox health.

اقدام: [احتمالاً] `realtime` و `safety` را از operations جدا کنید؛ `revenue` اگر payment فعال نیست، برای لانچ حذف یا در `Post Launch` مخفی شود.

### P1-8: overview بیش از حد چند نقش را همزمان بازی می کند

[قطعی] Overview هم pulse، هم daily brief، هم attention queue، هم growth/activity، هم readiness، هم safety، هم DNA/recsys را نشان می دهد. شواهد: `apps/web/src/app/admin/tabs/OverviewTab.jsx:39-160`.

[احتمالاً] این برای founder جذاب است، اما برای عملیات واقعی overload می سازد؛ اپراتور باید اول فقط سه سوال را جواب بگیرد:

- الان چیزی خراب است؟
- اگر بله، severity/owner/ETA چیست؟
- قدم بعدی چیست؟

اقدام: [قطعی] Overview را به `Command` تبدیل کنید: حداکثر 9 کارت critical، active incidents، open support SLA breach، failed workflows، AI outage/cost spike، allergen breach، event ingestion health.

### P1-9: عملیات خطرناک در drawer خیلی نزدیک به هم هستند

[قطعی] actions user drawer پشت سر هم شامل role toggle، reset password، force logout، ban/unban، export و delete است. شواهد: `apps/web/src/app/admin/tabs/UsersTab.jsx:239-246`.

[احتمالاً] از نظر UX امنیتی، این چیدمان احتمال misclick و تصمیم عجولانه را بالا می برد.

اقدام: [قطعی] actionها را به سه بخش جدا تقسیم کنید:

- Safe: view sessions, export limited profile, open tickets.
- Security: force logout, ban/unban.
- Destructive/Super-admin: reset password, role change, GDPR delete, full export.

### P1-10: دکمه refresh کل admin cache ممکن است هزینه/بار غیرضروری بسازد

[قطعی] refresh همه queryهای `admin` را invalidate می کند. شواهد: `apps/web/src/app/admin/page.jsx:121`.

[احتمالاً] با بزرگ شدن پنل، این کار باعث burst همزمان روی endpointهای analytics/ops/users/tickets می شود.

اقدام: [احتمالاً] refresh فقط active tab + pulse/attention باشد؛ refresh کل سیستم جدا و با throttle UI انجام شود.

### P2-1: responsive rail در موبایل فقط icon-only است، اما مسیرهای حساس label ندارند

[قطعی] در narrow mode، rail width به 58 می رسد و labelها مخفی می شوند. شواهد: `apps/web/src/app/admin/page.jsx:132`, `139-166`.

[احتمالاً] برای admin mobile emergency خوب است، اما برای عملیات دقیق مناسب نیست مگر tooltip/active title واضح و route breadcrumb کامل داشته باشد.

اقدام: [احتمالاً] برای viewport کوچک، drawer nav full-screen بهتر از rail icon-only است.

### P2-2: جدول ها و drawerها dense هستند اما keyboard/accessibility کامل نیست

[احتمالاً] rowهای table با `onClick` باز می شوند اما button/link semantics ندارند. نمونه: `apps/web/src/app/admin/tabs/UsersTab.jsx:154`, `apps/web/src/app/admin/tabs/TicketsTab.jsx:108`.

ریسک: [احتمالاً] keyboard navigation و screen reader در پنل حساس ضعیف می شود.

اقدام: [قطعی] rowها باید `button` یا لینک قابل focus باشند، با `aria-label` و key handling.

## 8. داده، privacy و compliance

### P0-5: سیاست PII دوگانه و مبهم است

[قطعی] `AdminService` برای برخی viewها phone/email را mask می کند. شواهد: `apps/server/src/admin/admin.service.ts:10-18`, `140`, `189`, `251`, `447`.

[قطعی] `AdminUsersService` و `AdminTicketsService` phone/email واقعی را برمی گردانند. شواهد: `apps/server/src/admin/admin-users.service.ts:50`, `84`, `125` و `apps/server/src/admin/admin-tickets.service.ts:41`, `52`.

[احتمالاً] این دو سیاست با هم قابل دفاع هستند فقط اگر role، purpose، reason و audit روشن باشد. الان همه adminها به real PII دسترسی دارند.

اقدام: [قطعی] PII policy باید explicit شود:

- Default masked برای listها.
- Reveal PII با کلیک `Reveal` + reason + audit.
- Full PII فقط برای support/security role.
- Export کامل فقط super-admin.

### P1-11: GDPR export/delete در UI هست، اما evidence و reason flow کامل نیست

[قطعی] export و delete کاربر از drawer در دسترس است. شواهد: `apps/web/src/app/admin/tabs/UsersTab.jsx:244-246`.

[قطعی] backend delete به erasure service delegate می کند. شواهد: `apps/server/src/admin/admin-users.service.ts:173-176`.

[نامطمئن] از فایل های بررسی شده مشخص نشد admin هنگام export/delete reason قانونی وارد می کند یا evidence pack قابل مشاهده/دانلود دارد.

اقدام: [قطعی] برای export/delete باید reason، request source، legal basis، ticketId اختیاری و audit result نمایش داده شود.

## 9. Observability و «برج مراقبت»

### P1-12: live realtime از polling استفاده می کند، نه stream

[قطعی] RealtimeTab هر 5 ثانیه `/admin/analytics/stats` و `/admin/analytics/events?limit=40` را poll می کند. شواهد: `apps/web/src/app/admin/tabs/RealtimeTab.jsx:24-25`.

[احتمالاً] برای لانچ کوچک کافی است؛ برای control tower واقعی، SSE/WebSocket یا حداقل cursor-based polling لازم است.

ریسک: [احتمالاً] event loss در UI، duplicate، و active user count تقریبی.

اقدام: [احتمالاً] برای لانچ MVP نگه دارید، اما عنوانش را «near-real-time» یا «آخرین رویدادها» بگذارید، نه realtime قطعی.

### P1-13: active users محاسبه دقیق نیست

[قطعی] active user count از `sessionId || user?.name` ساخته می شود. شواهد: `apps/web/src/app/admin/tabs/RealtimeTab.jsx:31-32`.

[احتمالاً] اگر چند user بی نام داشته باشید یا sessionId نباشد، count دقیق نیست.

اقدام: [قطعی] backend باید userId pseudonymous/hashed یا active user aggregate بدهد، نه اینکه UI از name/session حدس بزند.

### P1-14: alertها runbook، owner و escalation ندارند

[قطعی] `WorkflowAlert` fields شامل severity, title, body, metric, value, threshold, status, acknowledgedBy, snoozedUntil, resolvedAt است. شواهد: `apps/server/prisma/schema.prisma:1180-1196`.

[قطعی] owner, dueAt, runbookUrl, escalationChannel, incidentId, postmortemLink وجود ندارد.

اقدام: [قطعی] برای هر alert حداقل `ownerRole`, `runbook`, `expectedAction`, `dueAt`, `escalationPolicy` اضافه شود.

## 10. تست و کیفیت کد

### P1-15: تست های backend خوب شروع شده اند، اما e2e admin guard کافی دیده نشد

[قطعی] تست های unit برای `AdminUsersService`, `AdminTicketsService`, `AdminService`, `ObservabilityService`, `WorkflowRunnerService`, `workflow.types` وجود دارد. شواهد: خروجی جست وجوی تست ها در فایل های `*.spec.ts`.

[قطعی] smoke test فرانت فقط shell/gate/sidebar/topbar را تست می کند و tabهای واقعی را stub می کند. شواهد: `apps/web/src/app/admin/admin.smoke.test.jsx:30-52`.

[احتمالاً] کمبود تست های مهم:

- e2e: non-admin نتواند `/admin/*` را بخواند.
- e2e: admin بدون super-admin نتواند delete/export/role-change کند.
- e2e: mutation حساس بدون audit fail شود.
- e2e: workflow unknown با 404 برگردد.
- frontend: UsersTab destructive modalها و disabled states.
- frontend: TicketsTab reply/update/note happy/error states.
- visual regression: desktop/mobile admin layout.

### P1-16: استفاده زیاد از `any` در admin/workflow

[قطعی] `any` در admin services و workflow engine زیاد استفاده شده است. شواهد: `apps/server/src/admin/admin-users.service.ts:29`, `132`, `156`; `apps/server/src/admin/admin-tickets.service.ts:20`, `35`, `85`; `apps/server/src/workflow/workflow.service.ts:84`; `apps/server/src/workflow/workflow.types.ts:14-37`.

[احتمالاً] بخشی از آن به خاطر JSON graph قابل قبول است، اما در admin user/ticket paths ریسک نگهداری و contract drift را بالا می برد.

اقدام: [احتمالاً] برای responseها و DTOها typeهای صریح تعریف شود؛ workflow graph با Zod/class-validator runtime schema validate شود.

### P2-3: catchهای خام بعضی failureها را پنهان می کنند

[قطعی] چند catch خام یا silent وجود دارد؛ نمونه ها: `apps/server/src/admin/admin.service.ts:64`, `233`, `250`, `288`, `340`, `471`, `482`, `487` و `apps/web/src/app/admin/page.jsx:129`, `apps/web/src/app/admin/tabs/UsersTab.jsx:107`.

[احتمالاً] برای analytics parsing قابل تحمل است، اما در export و admin UI نباید failure بی صدا بماند.

اقدام: [قطعی] export failure باید toast/error قابل مشاهده و audit داشته باشد. Parsing failures در backend باید counter/metric داشته باشند.

## 11. پیشنهاد بازطراحی ساختار پنل

[احتمالاً] مسیر پیشنهادی برای تبدیل پنل به مرکز فرماندهی:

| صفحه پیشنهادی | شامل چه باشد | انتقال از تب فعلی | معیار موفقیت |
|---|---|---|---|
| Command | pulse, active alerts, SLA breaches, daily brief, failed jobs | Overview, Realtime, Automation | اپراتور در زیر 30 ثانیه بفهمد چه چیزی خراب است |
| Users | roster, user dossier, sessions, profile trace, GDPR | Users, Observability backend | هر user در زیر 60 ثانیه قابل بررسی باشد |
| Support | ticket queue, assignment, SLA, notes, macros | Tickets | هیچ ticket بی پاسخ بیشتر از SLA نماند |
| Product | funnels, retention, behavior, content gaps | Behavior, Engagement, Retention, Content | تصمیم محصول با داده واقعی/awaiting جدا باشد |
| AI & Cost | latency, fallback, token, cost, rate limits, errors | AiCost | هزینه/latency/fallback قبل از damage دیده شود |
| Safety & Privacy | allergens, guard corpus, consent, exports, erasures, audit | Safety + backend governance | رویداد حساس بدون audit نماند |
| Automation | workflows, runs, alerts, runbook | Automation | alert owner/action/ETA داشته باشد |
| System | DB/API/outbox/cron/cache/uploads health | پراکنده/ناقص | خرابی زیرساخت از خرابی محصول جدا شود |

## 12. لیست حذف یا تعویق

[احتمالاً] `Revenue` برای لانچ اگر پرداخت فعال نیست، بهتر است hidden شود. نمایش tab درآمد با PostLaunch برای founder شاید مفید باشد، اما برای پنل حرفه ای launch، نویز ایجاد می کند. شواهد: `apps/web/src/app/admin/page.jsx:63`.

[احتمالاً] export کل JSON admin cache باید حذف شود، نه تعویق. شواهد: `apps/web/src/app/admin/page.jsx:122-128`.

[احتمالاً] recipe approve/reject اگر هنوز محصول user-generated recipe ندارد، از backend admin route عمومی خارج یا پشت feature flag/super-admin برود.

[احتمالاً] تب های `Behavior`, `Engagement`, `Retention`, `Content` می توانند زیر `Product` ادغام شوند تا rail کوتاه تر و تصمیم محورتر شود.

## 13. چک لیست ضروری قبل از لانچ هفته بعد

### P0 - انجام شود

[قطعی] حذف یا محدود کردن `admin cache export` از topbar.

[قطعی] اضافه کردن سطح `super-admin` یا حداقل hardcoded owner check برای delete/export/password-reset/role-change.

[قطعی] اضافه کردن re-auth یا confirmation سخت گیرانه برای delete/export/password-reset/role-change/ban.

[قطعی] audit fail-closed برای عملیات حساس و ذخیره در ledger مستقل از `UserEvent`.

[قطعی] reason اجباری برای ban, delete, export, password reset, role change.

[قطعی] اصلاح workflow unknown/alert unknown به HTTP 404/400.

### P1 - اگر زمان شد، قبل از لانچ؛ اگر نشد، در هفته اول

[قطعی] DTO validation برای endpointهای admin.

[قطعی] assignee/tags/SLA breach در Tickets UI.

[قطعی] user observability در Users drawer.

[قطعی] claim atomic برای workflow scheduler.

[قطعی] test e2e برای admin guard و destructive actions.

[احتمالاً] بازچینی navigation به Command/Product/Ops/Safety.

### P2 - بعد از لانچ

[احتمالاً] SSE/WebSocket برای realtime.

[احتمالاً] visual regression admin desktop/mobile.

[احتمالاً] runbook/escalation/postmortem برای workflow alerts.

[احتمالاً] keyboard accessibility کامل برای table rows/drawers.

## 14. نتیجه عملی

[قطعی] پنل فعلی برای استفاده داخلی founder قابل قبول است، اما برای لانچ بین المللی با داده واقعی کاربر، بدون اصلاح P0ها نباید به عنوان پنل production-grade معرفی شود.

[قطعی] اگر فقط 48 ساعت وقت دارید، ترتیب درست این است: 1) حذف export cache، 2) super-admin/step-up برای عملیات حساس، 3) audit ledger قابل اتکا، 4) DTO validation، 5) ticket SLA/assignment، 6) workflow 404 و scheduler claim.

[احتمالاً] بعد از این اصلاحات، پنل از «داشبورد پر از عدد» به «مرکز فرماندهی قابل اعتماد» نزدیک می شود؛ بدون این اصلاحات، زیبایی و تعداد تب ها مشکل اصلی را پنهان می کند، نه حل.
