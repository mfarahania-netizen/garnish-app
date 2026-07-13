# PRD — Garnish Household OS v1

**وضعیت:** Stage A / طراحی برای بازبینی، نه مجوز پیاده‌سازی
**مالک محصول:** Program Coordinator
**دامنهٔ طراحی Program v1:** Household Foundation + Shared Shopping + Notifications + Meal Board + Secure Sharing
**زبان و جهت اصلی:** فارسی، RTL
**برچسب اطمینان:** `[قطعی]` الزام صریح brief یا اصل ایمنی؛ `[احتمالاً]` تصمیم محصولی با شواهد خوب ولی نیازمند اعتبارسنجی؛ `[حدسی]` فرض طراحی؛ `[نامطمئن]` تصمیم باز
**قاعده تطبیق:** این نسخه با `03_feature_decision_matrix.csv` موجود در زمان نگارش تطبیق داده شده است. هر تغییر بعدی Matrix باید صریحاً در PRD reconcile شود؛ تعارض بی‌صدا مجاز نیست.

## خلاصه اجرایی و مرز v1

**Reality Check:** `[قطعی]` ساخت هم‌زمان همهٔ ایده‌های founder یک MVP نیست. voice، OCR رسید، import شبکه‌های اجتماعی و discovery تعاملی، وابستگی و ریسک حقوقی/حریم خصوصی را بدون اثبات core loop بالا می‌برند.

v1 یک «حلقهٔ تصمیم خانوار برای غذا» است:

`چه کسانی غذا می‌خورند → چه می‌پزیم → چه لازم داریم → چه کسی خرید می‌کند → نبودِ کالا چگونه حل می‌شود → چه چیزی پخته شد`

**P0 / MVP اولیه پس از gateها:**

- فضای خصوصی خانوار، عضویت، دعوت، انتقال مالکیت و خروج/حذف؛
- یک لیست خرید مشترک فعال برای هر خانوار، جلسهٔ خرید صریح، وضعیت و تصمیم جایگزین؛
- اعلان درون‌برنامه‌ایِ server-backed و actionable؛ push فقط پس از اثبات آمادگی زیرساخت و رضایت؛
- تصمیم ناموجودی با گزینهٔ متنی؛ عکس برای تکمیل تصمیم اجباری نیست؛
- realtime/offline صادقانه و conflict recovery.

**P1 / فاز بعد، فقط پس از PASS سطح P0 و gate همان capability:**

- عکس جایگزین فقط پس از تأیید protected attachment pipeline؛
- Meal Board هفتگی با پیشنهاد، واکنش ساده، حضور، تعداد پرس و تأیید نسخه؛
- diff صریح برنامه به خرید؛ بدون تغییر پنهانی لیست؛
- add-to-Meal-Board از recipe موجود، به‌اندازهٔ لازم برای بستن حلقهٔ برنامه.

طراحی H5 در Program v1 کامل می‌شود، اما rollout لینک بیرونی P2 و advisor review فقط `VALIDATE_BEFORE_BUILD` است. هیچ لینک بیرونی بدون expiry/revoke/scope/audit ساخته نمی‌شود. managed profile، Serving Transform عمومی و ویژگی‌های H6 نیز خارج از تعهد MVP هستند. موارد ثبت‌شده برای بازبینی: Verified Cook Feedback، voice guidance، receipt scan، URL/social/video import، discovery، nutrition، visual cook steps، public aggregate ratings و هر marketplace.

---

## 1. Product vision

`[احتمالاً]` Garnish باید هزینهٔ هماهنگی غذا در خانوار را کم کند، نه اینکه یک چت یا تقویم دیگر بسازد. خروجی ارزشمند، یک تصمیم مشترک و قابل پیگیری است: برنامهٔ تأییدشده، لیست قابل خرید و حل سریع نبودِ کالا.

موفقیت ادراکی: عضو تازه در کمتر از ۳۰ ثانیه بفهمد «این هفته چه می‌خوریم و چه باید بخریم» و در کمتر از ۲ دقیقه نخستین اقدام مشترک مفید را انجام دهد.

## 2. Product positioning

`[احتمالاً]` جایگاه: «سیستم هماهنگی غذای خانوار» میان برنامه‌ریز غذا و لیست خرید مشترک. تمایز قابل دفاع فقط زمانی شکل می‌گیرد که منشأ هر قلم، تغییر تعداد افراد، خرید زنده، تصمیم جایگزین و نسخهٔ برنامه به هم متصل باشند.

گزارهٔ جایگاه‌یابی:

> برای خانواده‌ها، زوج‌ها و هم‌خانه‌هایی که برنامه‌ریزی و خرید غذا میان چند نفر پخش است، Garnish برنامه، موجودی، خرید و تصمیم‌های هنگام فروشگاه را در یک جریان خصوصی و توضیح‌پذیر به هم وصل می‌کند.

## 3. Non-goals

`[قطعی]` v1 موارد زیر نیست و نباید به‌صورت ضمنی ساخته شود:

- پیام‌رسان عمومی، feed اجتماعی یا پروفایل عمومی خانوار؛
- مکان‌یابی دائمی یا نمایش مسیر shopper؛
- خرید، پرداخت یا سفارش خودکار؛
- حساب اجتماعی مستقل کودک؛
- ابزار پزشکی، تشخیص یا توصیهٔ درمانی/رژیمی؛
- marketplace، جامعهٔ عمومی recipe یا nutritionist marketplace؛
- الگوریتم رأی‌گیری رتبه‌ای یا امتیاز اجتماعی اعضا؛
- چند لیست هم‌زمان برای یک خانوار در v1؛
- standalone timer جدید؛
- email/SMS notification؛
- ویرایش مستقیم برنامهٔ canonical توسط advisor؛
- انتشار عمومی recipe import؛
- ادعای «AI» برای قواعد deterministic.

## 4. Target users

1. **هماهنگ‌کنندهٔ خانوار:** برنامه و لیست را می‌سازد؛ از دوباره‌کاری و پیگیری دستی خسته است.
2. **خریدار در فروشگاه:** یک‌دستی و با شبکهٔ ناپایدار کار می‌کند؛ به تغییر تازه و تصمیم فوری نیاز دارد.
3. **عضو مشارکت‌کننده:** غذا پیشنهاد می‌دهد، حضور را مشخص می‌کند و اقلام را اضافه می‌کند؛ مدیریت کامل نمی‌خواهد.
4. **مالک/بزرگسال مسئول:** دعوت، حذف، انتقال مالکیت، حریم خصوصی و تنظیمات را بر اساس capability کنترل می‌کند.
5. **managed profile آینده:** فرد تحت مدیریت، از جمله کودک؛ ورودی حضور/ترجیحات با واسطهٔ بزرگسال، بدون login مستقل. `[احتمالاً]` پس از مشاهدهٔ نیاز و Human Decision Gate، نه MVP.
6. **advisor بیرونی:** فقط محدودهٔ صریح برنامه را می‌بیند، نظر یا پیشنهاد تغییر می‌دهد و عضو خانوار نیست.

فرض‌ها:

- `[احتمالاً]` launch برای ۲ تا ۱۲ عضو دعوت‌شدهٔ دارای حساب فردی طراحی می‌شود؛ managed profile بعداً. abuse/performance limit باید server-enforced باشد.
- `[احتمالاً]` موبایل سطح اصلی مصرف و خرید است؛ review بیرونی روی tablet/desktop نیز مهم است.
- `[نامطمئن]` بازار نخست هلند و زبان نخست UI فارسی است؛ locale، واحد و currency باید در Open Decisions تأیید شود.

## 5. Primary Jobs-to-be-Done

- وقتی هفته را برنامه‌ریزی می‌کنیم، می‌خواهم حضور و نظر اعضا را جمع کنم تا بدون پیام‌های پراکنده برنامه را ببندیم.
- وقتی برنامه تغییر می‌کند، می‌خواهم اثر دقیق آن بر خرید را ببینم تا چیزی بی‌اجازه حذف یا اضافه نشود.
- وقتی خرید شروع می‌شود، می‌خواهم اعضا بتوانند قلم جدید را به خریدار برسانند تا قلم فراموش نشود.
- وقتی کالا موجود نیست، می‌خواهم گزینه‌های محدود و قابل تصمیم بفرستم تا خرید معطل نماند.
- وقتی عضو یا advisor دسترسی می‌گیرد، می‌خواهم دقیقاً بدانم چه می‌بیند و بتوانم دسترسی را قطع کنم.
- وقتی اتصال قطع است، می‌خواهم بدانم چه چیزی فقط روی دستگاه ذخیره شده تا موفقیت کاذب نبینم.

جزئیات در `05_jobs_to_be_done.md`؛ داستان‌های اجرایی در `06_user_stories.md`.

## 6. User stories

`[قطعی]` داستان‌های P0 / H1–H3:

- به‌عنوان owner، خانوار می‌سازم و عضو را با لینک یک‌بارمصرفِ identity-bound برای account/email مشخص دعوت می‌کنم.
- به‌عنوان عضو، دعوت را با نمایش نام خانوار و سطح دسترسی می‌پذیرم یا رد می‌کنم.
- به‌عنوان عضو مجاز، قلم را اضافه/ویرایش/خریداری می‌کنم و تغییر را روی دستگاه دوم می‌بینم.
- به‌عنوان shopper، جلسهٔ خرید را آگاهانه شروع و پایان می‌دهم؛ هیچ tracking دائمی فعال نمی‌شود.
- به‌عنوان shopper، نبودِ کالا را به تصمیم متنی تبدیل می‌کنم و نتیجه را می‌بینم؛ عکس شرط P0 نیست.
- به‌عنوان کاربر آفلاین، وضعیت pending را می‌بینم و بعد از reconnect نتیجهٔ server را دریافت می‌کنم.
- به‌عنوان عضو، اعلان actionable درون‌برنامه‌ای را مطابق preference سرور می‌بینم.

`[قطعی]` داستان‌های P1، فقط وقتی فاز مربوط فعال و gate آن پاس شده است:

- به‌عنوان shopper، عکس خصوصی جایگزین را از protected attachment pipeline می‌فرستم.
- به‌عنوان عضو، Meal Board را پیشنهاد/واکنش/حضور می‌دهم و Owner/Adult مجاز نسخه را تأیید می‌کند.
- به‌عنوان confirmer، پیش از اعمال تغییر برنامه، diff خرید را تأیید می‌کنم.

`[قطعی]` داستان‌های P2/P3 و H5-gated:

- به‌عنوان owner/adult، لینک share محدود می‌سازم و revoke می‌کنم؛ advisor review فقط پس از validation gate.

معیارهای کامل و سناریوهای منفی در `06_user_stories.md`.

## 7. Household lifecycle

حالت‌های UX: `ACTIVE → ARCHIVED → DELETION_PENDING`. نگاشت persistence برابر `ACTIVE|ARCHIVED|DELETING` است؛ `DELETION_PENDING` در UI همان `DELETING` دامنه است. `DELETED` live state نیست: پس از پایان cooling-off/retention، rowها غایب‌اند یا فقط tombstone امنیتی جداگانه و غیرقابل دسترس باقی می‌ماند؛ API می‌تواند outcome «حذف شده» بدهد بدون اینکه household قابل دسترسی باشد.

- ایجاد: سازنده owner می‌شود؛ یک default shopping list و Meal Board جاری به‌صورت lazy ایجاد می‌شوند.
- active: اعضای مجاز بر مبنای capability کار می‌کنند.
- archived: فقط خواندن/خروجی گرفتن برای owner؛ mutationهای همکاری متوقف؛ invite/shareهای فعال revoke می‌شوند.
- restore: `[نامطمئن]` فقط در retention window و با تصمیم مالک؛ تا تعیین سیاست retention، قابلیت تعهدشده نیست.
- deletion pending / `DELETING`: Human Decision Gate، re-auth، نمایش اثر، grace period و امکان cancel طبق policy؛ زمان دقیق باز است.
- آخرین owner نمی‌تواند بدون transfer خارج شود یا حذف گردد.
- عضو حذف‌شده باید همان لحظه دسترسی API، subscription و notification را از دست بدهد؛ cache خصوصی پاک شود.

## 8. Invitation flow

1. عضو دارای `MEMBER_INVITE`، حساب/ایمیل هدف، نقش پایه/قابلیت مجاز و expiry را انتخاب می‌کند. دعوت MVP باید به هویت هدف bind شود؛ لینک انتقال‌پذیرِ بدون target در MVP ساخته نمی‌شود.
2. سرور token تصادفی را فقط یک‌بار برمی‌گرداند؛ hash و target digest در DB ذخیره می‌شود. چون ارسال email/SMS در محدوده نیست، inviter می‌تواند همین لینکِ identity-bound را از کانال دلخواه به گیرنده برساند؛ دزدیدن لینک برای account دیگر نباید عضویت بسازد.
3. گیرنده پیش از پذیرش، نام خانوار، دعوت‌کننده، نقش، expiry و داده‌های قابل مشاهده را می‌بیند.
4. login لازم است؛ پس از login همان invitation intent حفظ می‌شود، بدون نشت بین accountها.
5. accept اتمیک و idempotent است؛ token به `ACCEPTED` می‌رود. decline به `DECLINED`.
6. expired/revoked/used token هیچ عضویتی ایجاد نمی‌کند و copy عمومی از افشای وجود خانوار پرهیز می‌کند.
7. duplicate invite برای target account/email/household یا resend می‌شود یا invite قبلی را replace می‌کند؛ دو membership نمی‌سازد. unbound/transferable invite فقط پس از threat review و evidence اصطکاک قابل بازنگری است.

## 9. Role and capability matrix

`[قطعی]` دسته‌های authenticated membership canonical عبارت‌اند از رابطهٔ `OWNER` و roleهای `ADULT`، `MEMBER` و `GUEST_SHOPPER`. `MANAGED_PROFILE` یک principal تحت مدیریت خانوار و بدون login است، نه HouseholdMembership. `PLAN_VIEWER` و `PLAN_REVIEWER` principalهای scope‌شدهٔ share هستند، نه عضو یا role خانوار؛ «advisor» نام UX برای `PLAN_REVIEWER` است. authorization باید capability-based و server-side باشد.

| Capability نمونه | Owner | Adult | Member | Guest shopper | Managed-profile principal | Share principal |
|---|---:|---:|---:|---:|---:|---:|
| HOUSEHOLD_MANAGE | ✓ | — | — | — | — | — |
| MEMBER_INVITE | ✓ | ✓ | — | — | — | — |
| MEMBER_REMOVE | ✓ | — | — | — | — | — |
| SHOPPING_READ/WRITE | ✓ | ✓ | ✓ | مشروط به list/session واگذارشده | — | — |
| SHOPPING_SESSION_START | ✓ | ✓ | ✓ | — | — | — |
| SHOPPING_SESSION_PARTICIPATE | ✓ | ✓ | ✓ | مشروط به session واگذارشده | — | — |
| PLAN_READ | ✓ | ✓ | ✓ | — | — | scope-only و مشروط |
| PLAN_PROPOSE | ✓ | ✓ | ✓ | — | — | فقط Plan reviewer و typed patch |
| PLAN_REACT/ATTEND_SELF | ✓ | ✓ | ✓ | — | — | — |
| PLAN_CONFIRM / PLAN_SHOPPING_APPLY | ✓ | ✓ | — | — | — | — |
| SHARE_CREATE | ✓ | ✓ | — | — | — | — |
| SHARE_REVOKE | ✓ | فقط share ساختهٔ خود | — | — | — | — |
| MANAGED_PROFILE_CREATE/ATTEND | ✓ | فقط manager در موارد مشروط | — | — | اقدام مستقیم ندارد | — |
| OWNER_TRANSFER | ✓ | — | — | — | — | — |

هر حالت `CONDITIONAL` باید با شرط capability صریح و server-side اجرا شود؛ UI hiding مجوز نیست. `PLAN_VIEWER` و `PLAN_REVIEWER` عضو household محسوب نمی‌شوند.

## 10. Shopping lifecycle

حالت داخلی قلم:

`NEEDED → CLAIMED → IN_CART → BOUGHT`
`NEEDED|CLAIMED|IN_CART → UNAVAILABLE → DECISION_PENDING → SUBSTITUTION_APPROVED|SKIP_APPROVED → BOUGHT|SKIPPED`

`ShoppingDecisionRequest.status` جداگانه `OPEN|RESOLVED|EXPIRED|CANCELLED` و outcome انتخابی را نگه می‌دارد؛ UI نباید item status و decision resolution را یک مفهوم مبهم نشان دهد. این enumها باید با domain model canonical بمانند و تغییر معماری نیازمند اصلاح هم‌زمان PRD/UX است.

قواعد:

- UI حالت‌های سادهٔ «لازم»، «در حال خرید»، «گرفته شد»، «ناموجود/منتظر تصمیم» نشان می‌دهد.
- هر mutation دارای idempotency key و base version است؛ server حقیقت نهایی است.
- `assignee` مسئول اختیاری قلم است؛ `claim/in-cart` حضور گذرای shopper در session. این دو در UI و مدل یکی نیستند و multi-assignee در v1 وجود ندارد.
- item باید requestedBy، source/meal، quantity/unit، notes و substitution rule را در صورت وجود توضیح دهد.
- semantic duplicate به کاربر پیشنهاد merge می‌دهد؛ merge پنهانی در conflict ممنوع.
- undo تا زمانی که اثر downstream قطعی نشده و capability برقرار است، compensation command می‌فرستد؛ rollback محلی حقیقت نهایی نیست.
- جلسهٔ خرید صریح شروع/پایان می‌یابد؛ presence تقریبی است و برای نظارت استفاده نمی‌شود.

## 11. Out-of-stock decision flow

1. shopper «ناموجود است» را می‌زند.
2. از او پرسیده می‌شود: `جایگزین انتخاب می‌کنم`، `از خانواده می‌پرسم` یا `این قلم را رد کن` (اگر مجاز).
3. در ask flow، shopper حداکثر چند option، عکس اختیاری، قیمت/اندازه و deadline تصمیم را ثبت می‌کند.
4. سرور یک `DecisionRequest` فعال می‌سازد و اعلان را فقط به اعضای واجد تصمیم می‌فرستد.
5. اولین پاسخ معتبر بر اساس policy تصمیم را resolve می‌کند؛ پاسخ دیرهنگام نتیجه را می‌بیند، دوباره اجرا نمی‌شود.
6. timeout به‌صورت پیش‌فرض خرید خودکار/جایگزین خودکار نمی‌کند؛ fallback item rule یا `بدون خرید` است.

`[قطعی]` resolver باید `SHOPPING_DECISION_RESOLVE` داشته باشد؛ Owner/Adult/Member مجازند و Guest Shopper فقط با delegation صریح و policy. `[نامطمئن]` policy انتخاب گیرنده باز است؛ پیش‌فرض موقت first-valid response میان گیرندگان مجاز با CAS سرور است.

## 12. Substitution flow

- item rule یکی از `NO_SUBSTITUTION`، `SHOPPER_MAY_CHOOSE`، `ASK_IF_UNAVAILABLE` است.
- option شامل نام، مقدار/واحد، قیمت اختیاری، عکس اختیاری و توضیح کوتاه است.
- approve/reject باید idempotent باشد و outcome به item/event وصل شود.
- عکس جایگزین دادهٔ خصوصی خانوار است؛ protected attachment handling، authorization هم‌سطح item/decision، URL غیرعمومی، metadata stripping، retention/deletion، type/size و malware validation لازم است.
- shopper همیشه visual outcome می‌بیند؛ اعلان lock screen نام حساس item را به‌صورت پیش‌فرض نشان نمی‌دهد.
- عدم پاسخ، رضایت تلقی نمی‌شود.

## 13. Notification model

کانال v1:

- **in-app center:** P0 و server-backed؛ unread/read و deep link؛
- **realtime toast/banner:** فقط context جاری و قابل action؛
- **push:** مشروط به readiness، رضایت صریح و enforcement واقعی backend؛
- email/SMS: خارج از محدوده.

رویدادهای actionable: invite، item added during active session، unavailable، substitution request/result، meal proposal/review، plan confirmed، advisor comment/proposal، share revoked.

قواعد: عدم ارسال به actor مگر مفید، dedupe key، collapse، rate-limit، quiet hours، expiry، action idempotency، generic lock-screen copy پیش‌فرض و silent sync برای low-value changes. «لیست تغییر کرد» اعلان معتبر نیست.

اعلان تصمیم اضطراری پزشکی نیست. اگر push denied است، app همچنان in-app کار می‌کند و فقط یک بار راهنمای تنظیمات نشان می‌دهد.

## 14. Meal Board lifecycle

`DRAFT → SUGGESTIONS → REVIEW → CONFIRMED → SHOPPING_GENERATED → COOKING → COMPLETED|ARCHIVED`

- واحد v1 یک هفته با timezone خانوار است.
- هر slot: تاریخ، meal type، recipe/manual meal، proposer، attendees، guest count، servings و version.
- proposal canonical را تغییر نمی‌دهد؛ accepter مجاز آن را apply می‌کند.
- reaction فقط `می‌خواهم`، `بد نیست`، `این هفته نه` است؛ جمع ساده، بدون ranking پیچیده.
- confirm، snapshot نسخه می‌سازد و lock می‌کند.
- تغییر پس از confirm یک نسخه/پیشنهاد تازه و shopping diff می‌سازد.
- MealSlot uniqueness باید DB-enforced و conflict-safe باشد.

## 15. Attendance and serving logic

- هر عضو: `EATING`، `ABSENT`، `UNKNOWN`; managed profile توسط مدیر تنظیم می‌شود.
- guest count عدد صحیح غیرمنفی است و نام/دادهٔ شخصی مهمان لازم نیست.
- servings پیشنهادی = شمار `EATING` + guest count؛ confirmer می‌تواند override کند و دلیل اختیاری ثبت می‌شود.
- `UNKNOWN` در serving حساب نمی‌شود و پیش از confirm هشدار می‌گیرد؛ مانع مطلق confirm نیست مگر policy انتخاب شود.
- تغییر حضور بعد از confirm اثر serving را نشان می‌دهد؛ در MVP مقدار shopping به‌صورت عمومی auto-scale نمی‌شود و تا آماده‌شدن Serving Transform به `نیازمند بررسی` می‌رود.
- unit policy و تبدیل ingredient/nutrition/step/shopping یک capability واحد H6/P2 است؛ fractions نامفهوم مجاز نیست.

## 16. Plan lock/versioning

- confirm، immutable `PlanVersion` و `version` فعلی می‌سازد.
- client mutation دارای `baseVersion` است؛ mismatch به conflict UI می‌رود.
- lock به معنی جلوگیری از پیشنهاد نیست؛ تغییر canonical به capability و diff نیاز دارد.
- دو confirm هم‌زمان: فقط یکی commit؛ دیگری نسخهٔ تازه را می‌بیند و refresh/compare می‌کند.
- rollback یک نسخهٔ جدید از snapshot قبلی می‌سازد؛ تاریخچه پاک نمی‌شود.
- archive داده را از UI فعال خارج می‌کند، نه اینکه audit را نابود کند.

## 17. Plan-to-shopping synchronization

`[قطعی]` sync باید diff-first باشد:

1. نسخهٔ plan و pantry snapshot مبنا ثبت می‌شود.
2. موتور deterministic اقلام `ADD/REMOVE/CHANGE/UNCHANGED/REVIEW` می‌سازد؛ تغییر servings که transform قابل اتکا ندارد `REVIEW` است.
3. UI منشأ، meal، مقدار قبلی/جدید و pantry coverage را نشان می‌دهد.
4. کاربر یکی را انتخاب می‌کند: `برنامه و خرید را به‌روزرسانی کن`، `فقط برنامه`، `به‌صورت پیشنهاد ذخیره کن`، `انصراف`.
5. manual items هرگز به‌دلیل plan diff حذف نمی‌شوند.
6. item خریداری‌شده یا در session فعال، خودکار حذف/کاهش نمی‌یابد؛ به `REVIEW` می‌رود.
7. apply اتمیک و idempotent است؛ partial failure باید نتیجهٔ هر قلم را آشکار و retry-safe کند.

## 18. External share model

دو mode طراحی‌شده، هر دو H5-gated و خارج از MVP اولیه:

- **VIEW_ONLY:** ابتدا یک هفته، scopeهای انتخابی، expiry، revoke و noindex؛ بدون account فقط در صورت تصویب security. نمایش ماهانه بعد از استفادهٔ تکراری از share هفتگی و پذیرش privacy exposure بررسی می‌شود.
- **REVIEW:** `VALIDATE_BEFORE_BUILD`؛ مشاهده + comment/proposal contextual؛ canonical write ممنوع؛ هویت advisor می‌تواند verified account یا label محدود باشد.

share token پرآنتروپی، hashed-at-rest، expiring و revocable است. scopeهای حساس مانند notes، preferences، allergy و nutrition default-off و مستقل‌اند. تغییر scope باید share قبلی را rotate یا invalidate کند؛ cache بیرونی نباید دادهٔ revoke‌شده را نگه دارد.

## 19. Advisor review model

- advisor فقط snapshot/version و scope مجاز را می‌بیند.
- comment به slot/proposal وصل است، نه چت آزاد.
- proposal شامل before/after، دلیل و optional comment است.
- Owner/Adult مجاز `accept` یا `reject` می‌کند؛ accept هم canonical را مستقیماً overwrite نمی‌کند و به plan diff می‌رود.
- label «advisor» ادعای مدرک حرفه‌ای نیست؛ هیچ توصیه‌ای medical تلقی نمی‌شود.
- revoke/expiry در صفحهٔ باز باید در درخواست بعدی و realtime/session check اعمال شود.
- build gate موقت مطابق Decision Matrix: حداقل ۵ خانوار pilot، review دستی را دو بار استفاده کنند و نشانهٔ پرداخت یا retention بدهند؛ سپس legal/privacy review پاس شود. این threshold فرض validation است، نه benchmark بازار.

## 20. Child/managed-profile model

`[قطعی]` managed profile در MVP فعال نیست. اگر پس از evidence و Human Decision Gate وارد Program v1 شود، حساب مستقل، email، password، push token یا social identity ندارد.

- Owner یا Adult manager واجد capability، profile را ایجاد و attendance/preferences غیرحساس لازم را مدیریت می‌کند؛ Owner بودن به‌تنهایی حق خواندن دادهٔ حساس profile نمی‌دهد.
- نمایش allergy/health-adjacent به household یا share نیازمند consent و scope صریح مدیر قانونی است؛ طراحی حقوقی نهایی Human Decision Gate می‌خواهد.
- managed profile نمی‌تواند invite، share، purchase، comment عمومی یا session شروع کند.
- audit نشان می‌دهد کدام Owner/Adult manager از طرف profile اقدام کرده است.
- age، parental authority، deletion/retention و lawful basis در Open Decisions باز است؛ تا بسته‌شدن، دادهٔ حداقلی ذخیره شود.

## 21. Offline model

- read cache فقط برای account + household فعال partition می‌شود؛ logout/account switch آن را پاک/غیرقابل دسترس می‌کند.
- mutationهای مجاز با `clientMutationId`، entity، baseVersion، payload، createdAt و account/household scope در queue رمزگذاری/محافظت‌شدهٔ محلی قرار می‌گیرند.
- UI سه حالت را تفکیک می‌کند: `ذخیره‌شده روی دستگاه`، `در حال ارسال`، `تأییدشده توسط سرور`.
- queue پس از reconnect به ترتیب dependency ارسال می‌شود؛ retry با backoff و idempotency.
- command پس از حذف عضویت، expiry تصمیم یا switch household discard نمی‌شود بی‌خبر؛ با علت و اقدام recovery نمایش داده می‌شود.
- attachment upload آفلاین تا reconnect pending است؛ preview محلی نباید «ارسال شد» بگوید.

## 22. Conflict model

سیاست پایه: server-authoritative optimistic concurrency.

| Conflict | سیاست موقت v1 | UX |
|---|---|---|
| متن note هم‌زمان | آخرین نسخه خودکار overwrite نمی‌کند | دو نسخه + انتخاب/ترکیب دستی |
| quantity | merge حسابی ممنوع مگر operation semantics روشن | مقدار شما/مقدار سرور + انتخاب |
| bought vs unavailable | state machine و precedence سرور | نتیجهٔ سرور + history + undo مجاز |
| duplicate semantic item | پیشنهاد merge، نه حذف پنهانی | نگه‌داشتن جدا/ادغام |
| plan slot/version | reject stale write | compare version و ایجاد proposal |
| تصمیم حل‌شده | پاسخ دیرهنگام no-op | «تصمیم قبلاً گرفته شد» |
| revoked permission | command رد | توضیح دسترسی و export متن محلی در صورت امن |

هیچ conflictی نباید با toast مبهم پنهان شود.

## 23. Error and retry states

- loading: skeleton با structure ثابت؛ نه spinner بی‌زمینه.
- empty: توضیح value + یک primary action.
- transient network: دادهٔ موجود حفظ، banner اتصال و retry.
- validation: کنار field + summary قابل screen reader.
- timeout: وضعیت unknown را موفقیت/شکست قطعی نمی‌نامیم؛ lookup با idempotency key.
- partial sync: تعداد موفق/ناموفق و retry فقط موارد ناموفق.
- unauthorized/deleted member: خروج از context، پاک‌سازی cache و مسیر امن.
- expired invite/revoked share/archived household: صفحهٔ اختصاصی بدون loop login.
- rate limit: زمان تقریبی retry فقط اگر server می‌دهد.
- media error: حذف preview، retry/replace؛ متن و optionهای دیگر حفظ شوند.

## 24. Privacy model

- کمینه‌سازی، purpose limitation و default-off برای دادهٔ حساس و analytics اختیاری.
- household membership مجوز blanket برای allergy، health preferences، notes خصوصی یا nutrition history نیست.
- هر query با household scope و هر mutation با capability guard؛ IDOR tests اجباری.
- notification lock screen generic؛ متن دقیق opt-in جداگانه.
- invite/share token hash-at-rest؛ URL از logs/referrer/analytics پاک شود.
- photo metadata در upload strip شود مگر نیاز اثبات‌شده؛ retention محدود.
- audit log از payload حساس و raw token پرهیز کند.
- export/delete/retention و محل پردازش داده Human Decision Gate دارند.
- analytics فقط پس از consent معتبر؛ household metric نباید اعضا را برای surveillance رتبه‌بندی کند.

## 25. Accessibility

هدف: WCAG 2.2 AA برای مسیرهای v1. الزامات پایه: keyboard کامل، focus visible، focus trap و return، touch target حداقل 44×44 CSS px هرجا عملی، نام/وضعیت screen-reader، status غیررنگی، reduced motion، heading/landmark درست، error association و اعلان realtime کنترل‌شده. جزئیات تست‌پذیر در `10_accessibility_rtl_spec.md`.

## 26. RTL

- root فارسی `dir="rtl" lang="fa"`؛ محتوای خارجی/URL/کد `dir="ltr"` یا `dir="auto"`.
- logical properties و icon mirroring معنایی؛ check، camera، play و برند mirror نمی‌شوند.
- اعداد/واحد/currency با isolation دوطرفه؛ ترتیب quantity + unit در locale formatter.
- در عرض 360 هیچ overflow افقی؛ actionهای اصلی در thumb zone و متن فارسی truncate مخرب نمی‌شود.
- copy و layout دقیق در `09_content_copy_spec_fa.md` و `10_accessibility_rtl_spec.md`.

## 27. Metrics

همهٔ metrics نیازمند consent/policy سازگارند؛ thresholdها فرضیه‌اند، نه benchmark صنعت.

North-star candidate: خانوارهایی که در یک هفته هم plan/shared item و هم completion خرید مشترک دارند.

Activation funnel: `household_created → invite_sent → invite_accepted → second_member_first_action → first_shared_item → first_shopping_session → first_shared_plan`.

کیفیت:

- second-member activation؛ `[حدسی]` آزمایش هدف 60% و warning زیر 25%؛
- median time تا first shared action؛ هدف آزمایشی <۲ دقیقه بعد از accept؛
- forgotten/duplicate purchase self-report؛ unresolved unavailable items؛
- decision resolution time و expiry rate؛
- plan-to-shop conversion و shopping completion؛
- notification action/mute/opt-out/duplicate suppression/spam complaint؛
- conflict rate، offline retry success، queue age و duplicate mutation suppression؛
- Household W1/W4 و repeated cycles.

رویدادها نباید raw note، item حساس، token یا member identity غیرضروری حمل کنند.

## 28. Monetization hypotheses

`[نامطمئن]` هیچ مدل قیمت‌گذاری هنوز اثبات نشده است.

| فرضیه | ارزش قابل فروش | تست کم‌هزینه | معیار pass موقت | ریسک |
|---|---|---|---|---|
| household plan | همکاری چندنفره + history | fake-door شفاف یا interview + checkout intent | پرداخت واقعی، نه فقط survey | paywall پیش از network effect |
| premium planning | نسخه‌ها، advanced diff، بیشتر از یک بازه share | willingness-to-pay test | conversion cohort | پیچیدگی محصول |
| advisor review | review share و proposal | concierge pilot | استفاده تکراری و پرداخت | ادعای حرفه‌ای/پزشکی |

Free-trial/annual pricing فقط benchmark تجاری است، feature نیست. هیچ capability ایمنی، export، revoke یا حریم خصوصی پشت paywall نمی‌رود.

## 29. Rollout plan

1. **Design gate:** PRD/ADR/threat model/permission matrix و feature decisions reconcile شوند.
2. **Prerequisite gate:** P0-A، account isolation، consent default-off، cache isolation، build/tests و dev DB separation پاس شوند.
3. **H1 internal:** household foundation؛ 2-account/IDOR/removed-member gate.
4. **H2 dogfood:** shopping + offline/realtime؛ دو browser و store-network simulation.
5. **H3 limited:** in-app notification؛ push خاموش تا backend preference enforcement و privacy pass.
6. **H4 invited beta:** Meal Board + deterministic diff؛ بدون monthly complexity.
7. **H5 gated pilot:** view share فقط پس از ساخت همهٔ کنترل‌های expiry/revoke/scope/audit؛ advisor review فقط پس از معیار validation در Decision Matrix.
8. **H6 experiments:** هر feature رقابتی جداگانه فقط با Decision Matrix و evidence.

Rollout به cohort کوچک، با rollback و migration expand-compatible است؛ master/production خارج از Stage A.

## 30. Kill switches

server-side و audit‌شده:

- `household_creation_enabled`
- `household_invites_enabled`
- `shopping_realtime_enabled` (fallback read-refresh، نه polling storm)
- `shopping_sessions_enabled`
- `decision_notifications_enabled`
- `push_delivery_enabled` (default off)
- `meal_board_write_enabled`
- `plan_shopping_apply_enabled`
- `external_share_create_enabled`
- `external_share_review_enabled`
- `sensitive_share_scopes_enabled` (default off)
- `attachment_upload_enabled`
- `offline_mutation_replay_enabled`

Kill switch باید رفتار degraded و copy مشخص داشته باشد؛ خاموش‌کردن نباید data loss یا authorization bypass بسازد.

## 31. Acceptance criteria

Acceptance فاز-نسبی است؛ feature غیرفعال با spec موجود PASS تلقی نمی‌شود.

**P0 / H1–H3:**

1. هر resource household-scoped و هر mutation capability-guarded است؛ outsider و removed member دسترسی ندارند.
2. invite یک‌بارمصرف، expiring، revocable و hash-at-rest است؛ reuse عضویت دوم نمی‌سازد.
3. آخرین owner بدون transfer خارج نمی‌شود؛ transfer و archive audit دارند.
4. دو client قلم را add/edit/bought می‌کنند و پس از reconnect به state سرور همگرا می‌شوند؛ lost update و duplicate semantic item پنهان نداریم.
5. offline mutation status صادقانه است؛ replay idempotent و account/household scoped است.
6. unavailable/substitution بدون عکس نیز یک decision lifecycle کامل با expiry و action idempotent دارد؛ عدم پاسخ خرید خودکار نیست.
7. backend preference، quiet hours، dedupe و rate limit اعلان درون‌برنامه‌ای را enforce می‌کند؛ actor spam و lock-screen leak نداریم. Push فقط در صورت enable شدن gate خودش سنجیده می‌شود.

**P1 / فقط اگر capability فعال است:**

8. attachment جایگزین فقط با protected access، URL غیرعمومی، metadata/retention/deletion policy و security approval فعال می‌شود؛ نبود عکس flow تصمیم را نمی‌شکند.
9. MealSlot duplicate در race ناممکن؛ confirm versioned و stale write رد می‌شود.
10. attendance/guest count به serving count و اثر shopping قابل توضیح وصل است؛ مقدارهای غیرقابل تبدیل `REVIEW` هستند، نه auto-scale جعلی.
11. تغییر plan، manual/bought/session items را بی‌صدا تغییر نمی‌دهد؛ diff deterministic و قابل undo/version است.

**P2/P3 / فقط اگر H5 فعال است:**

12. share expiry/revoke/scope reduction فوری است؛ advisor canonical write ندارد؛ حساس‌ها default-off هستند.

**Future-gated:**

13. اگر managed profile فعال شد، حساب مستقل یا notification token ندارد و acting Owner/Adult manager در audit ثبت است.

**Cross-cutting برای هر scope فعال:**

14. flowهای A–Q برای P0، R–V برای P1 و W–Z برای H5 طراحی شده‌اند؛ هر گروه فقط هنگام enable شدن همان فاز پیاده و E2E می‌شود.
15. viewportهای 360/390/430/480 برای scope فعال و tablet/desktop برای H5 overflow ندارند و معیارهای `10_accessibility_rtl_spec.md` پاس می‌شوند.
16. copy موفقیت فقط پس از server ack؛ partial/conflict/unauthorized متن و recovery مشخص دارند.
17. unit/service/API/Prisma/realtime/two-browser/offline/permission/IDOR/notification/a11y/RTL/performance/migration/adversarial tests برای scope فعال پاس می‌شوند.
18. performance p50/p95 و payload/query/reconnect اندازه‌گیری می‌شود؛ SLA جهانی بدون baseline ادعا نمی‌شود.
19. هیچ production write/migration، autonomous purchase، fake AI یا medical claim وجود ندارد.

Release PASS فقط با evidence واقعی و report ممکن است؛ وجود spec معادل PASS نیست.

## 32. Open decisions

| ID | تصمیم باز | پیشنهاد موقت | مالک تصمیم | زمان بستن / اثر عدم تصمیم |
|---|---|---|---|---|
| OD-01 | شرط‌های نهایی capabilityهای canonical | `02_permission_matrix.csv` مرجع؛ Owner/Adult confirm دارند، Member ندارد و Guest Shopper session-scoped است | Product + Security | پیش از H1 API؛ خطر privilege creep |
| OD-02 | چند خانوار برای هر user | schema پشتیبانی کند، UI selector فقط با evidence | Product + Architecture | پیش از H1 UX |
| OD-03 | سقف عضو/دعوت | limit server-configured | Product + Abuse | پیش از invite rollout |
| OD-04 | انتخاب گیرندگان تصمیم substitution | first-valid response میان principalهای دارای `SHOPPING_DECISION_RESOLVE`؛ Guest فقط با delegation | Product | پیش از H2 state machine |
| OD-05 | timeout decision | بدون خرید مگر rule صریح | Product + UX | پیش از H2 |
| OD-06 | یک یا چند shopping list | یک active list در v1 | Product | reconcile با Decision Matrix |
| OD-07 | semantics merge duplicate | پیشنهاد merge؛ manual confirmation | Architecture + UX | پیش از H2 |
| OD-08 | transport realtime | مطابق ADR؛ بدون CRDT | Architecture | پیش از H2 |
| OD-09 | push readiness | default off؛ in-app P0 | Engineering + Privacy | پیش از H3 |
| OD-10 | timezone/first day/locale/currency | household timezone؛ locale formatter | Product | پیش از H4 |
| OD-11 | unknown attendance blocking confirm | هشدار، نه blocker | Product Research | beta validation |
| OD-12 | nutrition/allergy share | خاموش تا legal/privacy gate | Human Decision Gate | پیش از H5 |
| OD-13 | anonymous share vs account-required review | view بدون حساب؛ review ترجیحاً account | Security + Growth | پیش از H5 |
| OD-14 | share expiry defaults/max | 7 روز review، 30 روز view؛ قابل کاهش | Security + Product | پیش از H5 |
| OD-15 | child lawful basis/age/guardian proof | دادهٔ حداقلی، بدون login | Legal Human Gate | پیش از managed profile release |
| OD-16 | deletion/retention/restore window | archive + deletion pending؛ اعداد باز | Privacy + Legal | پیش از public launch |
| OD-17 | photo storage/metadata/retention | strip metadata، signed access، retention کوتاه | Security | پیش از attachment |
| OD-18 | نخستین H6 feature | هیچ‌کدام؛ Serving Transform فقط پس از unit/rounding evidence | Product + Founder | بعد از core-loop beta |
| OD-19 | monetization/paywall | validation با پرداخت واقعی | Founder + Growth | پس از activation evidence |
| OD-20 | Persian as primary vs multilingual parity | فارسی primary؛ parity rules تعیین شود | Product | پیش از GA |
| OD-21 | advisor identity verification و naming | label غیرحرفه‌ای مگر verify | Legal + Product | پیش از pilot |
| OD-22 | restore/rollback and data export | export/revoke safety رایگان | Privacy + Engineering | پیش از GA |

## نتیجهٔ عملی

`[قطعی]` این سند فقط تعریف Stage A است. قدم بعدی: OD-01، OD-04، OD-09، OD-12 و OD-15 را در Human/Product Decision Gate ببندید، سپس PRD را با Feature Decision Matrix و ADRها reconcile کنید؛ قبل از عبور prerequisite gate هیچ کد household v1 پیاده نشود.
