# ممیزی نهایی پنل ادمین گارنیش قبل از لانچ

تاریخ: 2026-06-30  
دامنه: پنل ادمین فرانت‌اند و بک‌اند، مسیرهای متصل در `apps/server/src`، `apps/web/src/app/admin`، مدل‌های Prisma، workflow/automation، ticket، observability، auth/roles و خروجی `graphify-out`.

## Reality Check

[قطعی] ادعای «همهٔ سند قبلی انجام شده» دقیق نیست. پیشرفت واقعی و قابل‌توجه بوده، مخصوصاً در owner guard، reason-gating، audit قبل از عملیات حساس، حذف خروجی JSON سمت مرورگر، workflow reason و طراحی ناوبری. اما پنل هنوز برای استاندارد «ادمین بین‌المللی/لانچ‌گرید» چند ریسک جدی دارد: privacy روی sessions، RBAC بیش از حد ساده، audit ledger ناقص برای جست‌وجو/اثبات، و چند نقص workflow که می‌تواند پایش را اشتباه یا پرنویز کند.

[احتمالاً] اگر لانچ فقط با یک یا دو ادمین بسیار مورد اعتماد انجام شود، بعد از رفع P0ها قابل لانچ محدود است. اگر قرار است تیم پشتیبانی/عملیات واقعی وارد پنل شود، بدون رفع RBAC، PII gating، audit قابل جست‌وجو و تست فرانت، ریسک بالاست.

امتیاز آمادگی فعلی من برای لانچ محدود: 72/100  
امتیاز برای پنل ادمین جهانی و قابل دفاع: 58/100

## روش بررسی

- [قطعی] گزارش‌های قبلی ادمین و re-audit خوانده شد.
- [قطعی] `git status` بررسی شد؛ تعدادی تغییر و فایل scratch هنوز در worktree وجود دارد.
- [قطعی] `graphify-out/graph.json` بررسی شد: 3871 node و 10214 edge. بیشترین اتصال‌های مرتبط: `admin.controller.ts`، `admin.service.ts`، `admin-users.service.ts`، `admin-tickets.service.ts`، `workflow-*`، `auth/*`.
- [قطعی] کدهای اصلی بررسی‌شده: `apps/server/src/admin/*`، `apps/server/src/workflow/*`، `apps/server/src/auth/*`، `apps/server/prisma/schema.prisma`، `apps/web/src/app/admin/*`.
- [قطعی] تست بک‌اند اجرا شد: `apps/server`: `jest admin workflow --runInBand`، نتیجه 8 suite و 52 test پاس.
- [قطعی] تست smoke فرانت ادمین اجرا شد و شکست خورد: `apps/web/src/app/admin/admin.smoke.test.jsx` هنوز دنبال دکمهٔ حذف‌شدهٔ «خروجی JSON» می‌گردد.

## پیشرفت نسبت به گزارش قبلی

| حوزه | وضعیت فعلی | قضاوت |
|---|---|---|
| Approve recipe | `approve` حالا `status='active'` و `isPublic=true` می‌کند | [قطعی] انجام شده |
| Export/Revealing PII | از GET/query به POST body + `Cache-Control: no-store` منتقل شده | [قطعی] انجام شده |
| OwnerGuard | export/delete/password/reset/admin-role/recipe approve محدود به owner شده | [قطعی] انجام شده، ولی RBAC هنوز ناقص است |
| Reason gating | export/delete/password/role/reveal/workflow run/resolve/snooze دلیل می‌خواهند | [قطعی] بخش زیادی انجام شده |
| Audit قبل از mutation | `recordAuditStrict` برای عملیات حساس اضافه شده | [قطعی] انجام شده، ولی ledger مدل ناقص دارد |
| Create admin | ایجاد admin با owner و reason و audit قبل از create کنترل شده | [قطعی] پیشرفت جدی |
| Workflow automation | DTO، reason، audit fail-closed، alert feed، runbook، atomic scheduler بهتر شده | [قطعی] پیشرفت جدی، ولی چند bug عملیاتی باقی است |
| Users UI | capability-aware actions، modal خطرناک، reveal/export/delete gated، dossier و observability اضافه شده | [قطعی] پیشرفت جدی |
| Tickets UI/Backend | status/priority/category/tags/assignee/SLA/reply/note بهتر شده | [قطعی] پیشرفت جدی، ولی audit و pagination ناقص است |
| Admin layout | ناوبری job-based و topbar/freshness بهتر شده | [قطعی] بهتر شده |
| حذف export مرورگر | دکمهٔ JSON client-cache حذف شده | [قطعی] انجام شده؛ تست فرانت آپدیت نشده |

## P0: قبل از لانچ باید حل شود

### P0-1: نشست‌های کاربر هنوز IP و device را بدون gate کافی به پنل می‌دهند

[قطعی] در `apps/server/src/admin/admin-users.service.ts:99-120`، `detail()` نشست‌ها را با `userSession.findMany` کامل برمی‌گرداند. مدل `UserSession` در `apps/server/prisma/schema.prisma:433-441` شامل `device` و `ip` است. UI هم در `apps/web/src/app/admin/tabs/UsersTab.jsx:241-245` همان IP را نشان می‌دهد. مسیر جداگانهٔ `GET /admin/users/:id/sessions` در `apps/server/src/admin/admin.controller.ts:136-138` audit/reason ندارد.

مشکل: IP و device دادهٔ حساس operational/privacy است. الان هر admin که dossier را باز کند IP را می‌بیند؛ این با اصل data minimization و least privilege سازگار نیست.

راه‌حل پیشنهادی:
- `GET /admin/users/:id` فقط `activeSessions`, `lastSeenAt`, `deviceClass` یا IP ماسک‌شده/هش‌شده بدهد.
- مسیر sessions را از read عادی جدا کنید: owner/privacy-support role + reason + durable audit.
- در صورت نیاز عملیاتی، IP را `/24` ماسک کنید یا hash پایدار بدهید؛ raw IP فقط با reveal جداگانه.
- تست اضافه شود که `detail()` فیلد `ip` خام برنمی‌گرداند و باز کردن sessions audit می‌نویسد.

معیار قبولی: هیچ GET معمولی ادمین نباید raw `ip` یا `device` کامل را بدون reason/audit/gate برگرداند.

### P0-2: هر admin می‌تواند ایمیل/نام کاربر را تغییر دهد؛ email-change ریسک account takeover دارد

[قطعی] در `apps/server/src/admin/admin.controller.ts:180-189` فقط role change owner-only و reason-required است. اگر body شامل `email` یا `name` باشد، هر admin می‌تواند آن را با `recordAuditStrict` ولی بدون reason اجباری و بدون owner gate تغییر دهد. سرویس در `apps/server/src/admin/admin-users.service.ts:146-160` ایمیل را واقعاً update می‌کند.

مشکل: تغییر ایمیل کاربر می‌تواند مسیر بازیابی حساب، ارتباطات امنیتی و مالکیت حساب را تحت تأثیر قرار دهد. audit به‌تنهایی کافی نیست.

راه‌حل پیشنهادی:
- تغییر `email` را owner-only یا privacy-admin-only کنید.
- reason برای هر تغییر identity الزامی شود.
- بعد از تغییر email، sessionEpoch bump و اعلان امنیتی/verification flow اجرا شود.
- before/after کامل در audit ذخیره شود.
- اگر MVP نیاز ندارد، تغییر email را از UI حذف کنید و فقط name را editable نگه دارید.

معیار قبولی: admin معمولی نتواند email را تغییر دهد؛ تست controller برای email-change بدون owner باید 403 بدهد.

### P0-3: `canRevealPii` برای همهٔ adminها باز است

[قطعی] در `apps/server/src/auth/admin-capabilities.ts:24-36`، `canRevealPii: isAdmin` است. مسیر reveal در `apps/server/src/admin/admin.controller.ts:159-164` reason و audit دارد، اما owner یا نقش privacy ندارد.

مشکل: reason و audit کنترل بعد از وقوع هستند، نه جلوگیری. برای پنل بین‌المللی، reveal PII باید least-privilege باشد، نه «هر admin».

راه‌حل پیشنهادی:
- نقش‌های واقعی اضافه شود: `owner`, `support`, `privacy`, `content`, `ops`, `finance`, `readonly`.
- reveal فقط برای `privacy` یا `support` با دامنهٔ مشخص و reason باز باشد.
- برای reveal/export/reset/delete، recent-auth یا MFA step-up اضافه شود.
- throttling سخت‌تر برای reveal: مثلاً 10 reveal در 15 دقیقه برای هر admin.

معیار قبولی: `canRevealPii` دیگر از `isAdmin` خام مشتق نشود و تست capability داشته باشد.

### P0-4: Snooze در workflow عملاً قابل دور زدن است

[قطعی] در `apps/server/src/workflow/workflow-nodes.service.ts:165-183` dedupe فقط alert با `status: 'open'` را پیدا می‌کند. اگر اپراتور alert را snooze کند، run بعدی همان metric یک alert جدید open می‌سازد.

مشکل: snooze باید «تا زمان مشخص دوباره مزاحم نشو» باشد. الان می‌تواند با هر اجرای scheduled دوباره هشدار open بسازد. این برای برج مراقبت یعنی نویز و بی‌اعتمادی به alert feed.

راه‌حل پیشنهادی:
- `alertNode` قبل از create، alertهای `open` و `snoozed` با `snoozedUntil > now` را بررسی کند.
- اگر snoozed است، outcome را `suppressed: true` ثبت کند و alert جدید نسازد.
- برای race condition، unique/dedupe منطقی روی `(workflowKey, metric, active status)` یا transaction اضافه شود.

معیار قبولی: تست workflow نشان دهد run جدید در دورهٔ snooze alert جدید نمی‌سازد.

### P0-5: threshold workflow مقدار `null` را به `0` تبدیل می‌کند و ممکن است وضعیت خطرناک را سالم نشان دهد

[قطعی] در `apps/server/src/workflow/workflow-nodes.service.ts:114-130` مقدار raw با `Number(raw)` تبدیل می‌شود. `Number(null)` برابر 0 است. اگر metric منبع `null` بدهد، threshold آن را 0 واقعی حساب می‌کند.

مشکل: برای پایش، «داده نداریم» نباید با «عدد صفر سالم است» یکی شود. این مخصوصاً در safety/cost/health/observability خطرناک است.

راه‌حل پیشنهادی:
- اگر `raw == null`، خروجی `value:null`, `status:'unknown'` بدهید.
- برای gateهای critical، unknown باید failed یا alert مخصوص `metric_missing` تولید کند.
- تست اضافه شود: `null` نباید breached false سالم تولید کند مگر source صراحتاً 0 بدهد.

معیار قبولی: threshold برای `null/undefined/NaN` رفتار جداگانه و قابل مشاهده داشته باشد.

### P0-6: smoke test فرانت ادمین با UI جدید sync نیست

[قطعی] اجرای `vitest run src/app/admin/admin.smoke.test.jsx` شکست خورد چون تست هنوز دنبال دکمهٔ «خروجی JSON» است. این دکمه طبق تصمیم امنیتی حذف شده و خود تست باید اصلاح شود.

مشکل: قبل از لانچ نباید suite ادمین قرمز باشد؛ حتی اگر علت تست قدیمی باشد، CI اعتمادپذیر نیست.

راه‌حل پیشنهادی:
- assertion دکمهٔ «خروجی JSON» حذف شود.
- assertion جدید اضافه شود: دکمهٔ `به‌روزرسانی` هست، export cache نیست، تب‌های اصلی render می‌شوند.
- یک تست capability برای مخفی شدن export/delete/reveal برای non-owner اضافه شود.

معیار قبولی: smoke test فرانت ادمین سبز شود و حذف JSON export را پوشش دهد.

## P1: برای لانچ حرفه‌ای باید در همین دور رفع شود

### P1-1: RBAC هنوز binary است

[قطعی] Guard اصلی همچنان `@Roles('admin')` و owner allowlist است. این برای تیم کوچک کار می‌کند، ولی برای پنل جهانی کافی نیست.

راه‌حل: نقش DB-level اضافه شود یا حداقل capability matrix server-side با field روی User پیاده شود. owner env فقط emergency/superuser باشد. UI فقط مخفی کند، backend باید enforcement اصلی بماند.

### P1-2: Audit ledger قابل جست‌وجو و قابل اثبات کافی نیست

[قطعی] مدل `UserAuditLog` در `apps/server/prisma/schema.prisma:518-529` فقط `userId`, `action`, `details String`, `ip`, `userAgent`, `createdAt` دارد. کامنت `recordAuditStrict` می‌گوید details «queryable JSON» است، اما schema آن `String?` است.

مشکل: targetId، entityType، reason، before/after و actorId داخل JSON string دفن شده‌اند. برای incident review، compliance report یا «چه کسی روی این کاربر چه کرد» query تمیز ندارید.

راه‌حل:
- ستون‌های `actorId`, `targetId`, `targetType`, `action`, `reason`, `riskLevel`, `requestId` اضافه شود.
- `details` اگر PostgreSQL است JSONB شود.
- index روی `(targetId, createdAt)`, `(action, createdAt)`, `(actorId, createdAt)` اضافه شود.

### P1-3: read audit durable ولی non-blocking است و خطا را قورت می‌دهد

[قطعی] `recordAuditDurable` در `apps/server/src/admin/admin.service.ts:61-64` catch خالی دارد و ip/userAgent را به ستون‌های اصلی نمی‌نویسد.

تحلیل: برای readهای کم‌ریسک قابل قبول است. برای باز کردن dossier حساس، session/IP، observability یا PII-like health counts بهتر است audit قابل اتکاتر باشد.

راه‌حل: readهای حساس مثل user dossier/sessions/profile-trace را یا fail-closed کنید یا حداقل queue معتبر با retry و dead-letter داشته باشید.

### P1-4: force logout دلیل اختیاری دارد

[قطعی] در `apps/server/src/admin/admin.controller.ts:208-212` reason برای force logout اختیاری است و UI هم prompt را «اختیاری» معرفی می‌کند.

مشکل: force logout عملیات security-affecting است. باید reason اجباری باشد.

راه‌حل: `requireReason` برای force logout و تست controller اضافه شود.

### P1-5: Ticket triage audit-grade نیست

[قطعی] ticket update/reply/note در controller با `recordAudit` fire-and-forget/UserEvent لاگ می‌شود، نه `UserAuditLog` fail-closed. در `apps/server/src/admin/admin-tickets.service.ts:88-105` status/priority/category/assignee/tags تغییر می‌کنند ولی before/after durable audit ندارند.

مشکل: تغییر status، priority، close/reopen و assignee برای support compliance مهم است.

راه‌حل:
- برای ticket update/reply/note از `UserAuditLog` یا `AdminAuditLog` durable استفاده شود.
- before/after status/priority/assignee ذخیره شود.
- بستن ticket یا تغییر priority به critical reason بخواهد.

### P1-6: assignee ticket در backend اعتبارسنجی نمی‌شود

[قطعی] در `apps/server/src/admin/admin-tickets.service.ts:102` هر `assigneeId` پذیرفته می‌شود.

راه‌حل: اگر `assigneeId` هست، وجود user و `isAdmin=true` بررسی شود. اگر user حذف/غیرفعال است reject شود.

### P1-7: respond/update ticket transaction ندارد

[احتمالاً] reply create و ticket update در یک transaction نیستند. اگر reply ایجاد شود و update شکست بخورد، firstResponse/status ممکن است ناسازگار شود.

راه‌حل: respond را در `prisma.$transaction` ببرید و notification را بعد از commit fire-and-forget کنید.

### P1-8: manual workflow run برای همهٔ adminها باز است

[قطعی] `canRunWorkflows: isAdmin` است و route workflow فقط admin role می‌خواهد.

مشکل: workflow می‌تواند DB-heavy، AI-cost یا incident-affecting باشد. هر admin نباید آن را اجرا/resolve کند.

راه‌حل: `ops` یا `owner` capability برای run/resolve/snooze؛ read-only برای view. برای manual run idempotency و cooldown اضافه شود.

### P1-9: workflow runner dangling edge را واقعاً detect نمی‌کند

[قطعی] در `apps/server/src/workflow/workflow-runner.service.ts:29-45` کامنت می‌گوید dangling edge throw می‌شود، ولی خط 33 و 40 edgeهای ناشناس را ignore می‌کند. اگر node به ID ناموجود اشاره کند، order length همچنان برابر nodes length می‌ماند و throw نمی‌شود.

راه‌حل: هنگام scan کردن `next`، اگر `!indeg.has(nx)`، همان‌جا throw کنید. تست «dangling edge» واقعی اضافه شود.

### P1-10: WorkflowAlert مدل incident کامل ندارد

[قطعی] `WorkflowAlert` در schema فقط status/severity/title/body/metric/value/threshold/acknowledgedBy/snoozedUntil/resolvedAt دارد. owner role، assignedTo، dueAt، escalatedAt، resolutionReason، lastChangedBy ندارد.

راه‌حل: اگر قرار است واقعاً مرکز عملیات باشد، alert باید lifecycle داشته باشد: assigned owner، SLA، escalation، resolution note، history.

### P1-11: recsys/system health endpoint بک‌اند در UI ادمین surface نشده

[قطعی] backend endpoint `GET /admin/observability/recsys-health` وجود دارد (`apps/server/src/admin/observability.controller.ts`)، اما در `apps/web/src/app/admin` مصرف مستقیم آن پیدا نشد. UI فقط per-user observability و overview recsys خلاصه دارد.

مشکل: برای پنل فرماندهی، سلامت personalization/recsys باید یک cabin عملیاتی مستقل داشته باشد: outbox lag، signal coverage، consent coverage، registry drift، prior freshness.

راه‌حل: در تب AI یا Safety/System یک section مشخص برای `recsys-health` اضافه شود و fail/unknown را واضح نشان دهد.

### P1-12: Shopping analytics می‌تواند free-text حساس را aggregate کند

[قطعی] در `apps/server/src/admin/admin.service.ts:420-432` نام آیتم‌های shopping list خام groupBy و در `topItems` برگشت داده می‌شود.

مشکل: shopping item ممکن است متن آزاد، دارو، بیماری، نام شخص یا دادهٔ حساس باشد. aggregation هم همیشه privacy-safe نیست.

راه‌حل: فقط taxonomy/normalized ingredient code را aggregate کنید؛ free-text raw را mask یا exclude کنید.

### P1-13: Rate limit عملیات حساس با کل API یکی است

[قطعی] `ThrottlerModule` در `apps/server/src/app.module.ts:45` global limit `200/min` دارد. reveal/export/password/delete/force-logout throttling خاص ندارند.

راه‌حل: برای PII reveal/export/reset/delete/workflow-run rate limit جداگانه و alerting اضافه شود.

### P1-14: تب revenue در `TABS` هست ولی در navigation نیست

[قطعی] `revenue` در `apps/web/src/app/admin/page.jsx:60-72` تعریف شده، ولی در `GROUPS` ناوبری نیست. با query param مستقیم قابل render است.

تصمیم پیشنهادی: یا کاملاً حذف شود تا لانچ surface پنهان/نیمه‌کاره نداشته باشد، یا در گروه «بعد از لانچ» آشکار و readonly معرفی شود. حالت فعلی نیمه‌پنهان است.

### P1-15: TicketsTab pagination ندارد

[قطعی] UI تیکت‌ها `limit=50` می‌فرستد و دکمه/کنترل صفحه بعد ندارد (`apps/web/src/app/admin/tabs/TicketsTab.jsx:77-80`).

مشکل: با رشد support، operator 50 تیکت اول را می‌بیند و بقیه گم می‌شوند.

راه‌حل: pagination/cursor، total count، saved filters و sort واضح اضافه شود.

### P1-16: فایل‌های scratch/debug نباید قبل لانچ باقی بمانند

[قطعی] در worktree فعلی فایل‌هایی مثل `apps/server/_adminbattery.cjs`, `_battery.cjs`, `_diag.cjs`, `_mem.cjs`, `_rt.cjs` و چند فایل مشابه untracked هستند.

مشکل: اگر تصادفی commit یا deploy شوند، نویز، ریسک secrets/logging و بی‌نظمی release ایجاد می‌کنند.

راه‌حل: اگر ابزار موقت‌اند، حذف شوند یا خارج از app root منتقل شوند. اگر لازم‌اند، در `scripts/diagnostics` با README و بدون secret hardcode سامان‌دهی شوند.

### P1-17: DTOها هنوز validation قوی ندارند

[قطعی] DTOها اضافه شده‌اند، اما برای email/password/reason/status بعضی جاها `IsString` عمومی است و business validation در service/controller پخش شده.

راه‌حل: `IsEmail`, `MinLength`, enum validation، length cap برای reason/note/message و DTO جدا برای identity update اضافه شود.

## P2: بهبودهای مهم ولی قابل زمان‌بندی بعد از P0/P1

- [احتمالاً] route-level error boundary برای هر tab اضافه شود تا خطای یک تب کل پنل را نخواباند.
- [احتمالاً] promptهای `window.prompt` در Automation و force logout به modal استاندارد تبدیل شوند؛ برای عملیات حساس UI باید تاریخچه/دلیل/اثر را واضح نشان دهد.
- [احتمالاً] Owner allowlist باید در پنل health/config دیده شود؛ اگر `ADMIN_OWNER_IDS` خالی یا اشتباه است، UI باید هشدار بدهد.
- [احتمالاً] طراحی کلی بهتر شده، ولی هنوز بعضی radiusها و cardها consumer-ish هستند. برای ابزار عملیاتی، table density، sticky action bar، compact filters و keyboard-friendly flow ارزش بیشتری از cardهای زیاد دارد.
- [احتمالاً] admin analytics endpoints برای date/range/limit به DTO و clamp کامل نیاز دارند. بعضی endpointها page/limit ندارند یا queryهای سنگین دارند.
- [احتمالاً] workflow run timeout/cancel ندارد. یک query کند می‌تواند run را طولانی و scheduler را مبهم کند.
- [احتمالاً] ticket note/reply باید attachment policy، redact و internal visibility تست داشته باشد.
- [احتمالاً] audit viewer در خود پنل لازم است: timeline قابل فیلتر بر اساس actor/target/action/risk.
- [احتمالاً] برای launch باید seed/fixture ادمین و سناریوی disaster recovery مستند شود: اگر owner lockout شد چه می‌کنید؟

## مواردی که واقعاً خوب شده‌اند و نباید خراب شوند

- [قطعی] `recordAuditStrict` قبل از mutation و fail-closed است؛ این تصمیم درست است.
- [قطعی] `approveRecipe` حالا publish واقعی می‌کند، نه status مرده.
- [قطعی] export/reveal دیگر GET/query نیستند؛ این اصلاح امنیتی مهم بود.
- [قطعی] UI دیگر JSON cache export ندارد؛ همین باعث شکست تست قدیمی شده، اما خود حذف درست است.
- [قطعی] admin capability endpoint وجود دارد و UI بسیاری از اکشن‌های owner-only را hide می‌کند.
- [قطعی] workflow controller برای run/resolve/snooze reason و audit دارد.
- [قطعی] scheduler claim از duplicate run بین instanceها بهتر محافظت می‌کند.
- [قطعی] UsersTab نسبت به قبل خیلی عملیاتی‌تر شده: dossier، action grouping، observability cabin، dangerous modal.
- [قطعی] TicketsTab از حالت ساده خارج شده و triage/SLA/assignee/tags دارد.
- [قطعی] navigation شغلی بهتر از دسته‌بندی خام metricهاست.

## چک‌لیست پیشنهادی برای Claude Code

اولویت اجرای پیشنهادی:

1. P0-1: حذف raw IP/device از user detail و gate/audit برای sessions.
2. P0-2: owner/reason/verification برای تغییر email؛ یا حذف email edit از MVP.
3. P0-3: جدا کردن `canRevealPii` از `isAdmin` و اضافه کردن role/capability privacy/support.
4. P0-4 و P0-5: اصلاح snooze و null threshold در workflow.
5. P0-6: اصلاح smoke test فرانت و اضافه کردن assertions امنیتی جدید.
6. P1-2: ارتقای audit schema یا حداقل ستون‌های target/action/reason/index.
7. P1-5 تا P1-7: durable audit و validation/transaction برای ticket.
8. P1-8 تا P1-10: workflow ops permission، idempotency/cooldown، alert lifecycle.
9. P1-11: surface کردن recsys-health در UI ادمین.
10. P1-16: پاک‌سازی/سامان‌دهی فایل‌های scratch قبل از release.

## تست‌ها و وضعیت اعتماد

| تست | نتیجه | تفسیر |
|---|---:|---|
| `apps/server`، jest admin/workflow | 52/52 pass | [قطعی] اصلاحات بک‌اند موجود تست پایه دارند |
| `apps/web`، admin smoke | 2 pass / 1 fail | [قطعی] تست با حذف JSON export sync نشده |
| تست e2e admin security | پیدا نشد | [احتمالاً] باید اضافه شود |
| تست PII/session masking | ناقص | [قطعی] چون IP خام هنوز در UI می‌آید |
| تست RBAC چندنقشی | ناقص | [قطعی] نقش واقعی هنوز وجود ندارد |

## تصمیم لانچ

[قطعی] من لانچ عمومی با پنل فعلی را بدون P0ها توصیه نمی‌کنم.  
[احتمالاً] لانچ محدود با ownerهای محدود و بدون تیم support گسترده، بعد از P0ها قابل دفاع است.  
[قطعی] برای ادعای «سطح جهانی»، باید P1های audit/RBAC/workflow/ticket هم وارد همین دور شوند.

## نتیجهٔ عملی

کار بعدی باید اصلاح P0ها باشد، نه اضافه کردن feature جدید. اگر Claude Code قرار است این گزارش را اجرا کند، اول session privacy، email-change، PII reveal RBAC، workflow snooze/null و smoke test را ببندد؛ بعد سراغ audit schema، ticket durability و recsys-health UI برود. بدون این‌ها پنل زیباتر شده، اما هنوز برج مراقبت قابل اعتماد کامل نیست.
