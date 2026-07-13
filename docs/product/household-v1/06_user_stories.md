# User stories — Garnish Household OS v1

**وضعیت:** تطبیق‌یافته با Feature Decision Matrix موجود؛ تصمیم‌های باز همچنان gate دارند
**اولویت‌ها:** `P0` بدون آن حلقه یا ایمنی v1 می‌شکند؛ `P1` مهم ولی rollout می‌تواند بعد از P0 باشد؛ `P2` آزمایش/بعداً؛ `OUT` عمداً خارج
**قاعدهٔ پذیرش:** هر سناریوی «آنگاه» باید با پاسخ server-authoritative و تست واقعی اثبات شود؛ optimistic UI به‌تنهایی pass نیست.

## Definition of Ready / Done

یک story فقط Ready است اگر capability، privacy scope، state transition، offline behavior، notification behavior و copy آن مشخص باشد. Done فقط وقتی است که happy path، خطا، unauthorized، stale/conflict، RTL/a11y و telemetry کمینه تست شده باشند.

## Epic H1 — Household foundation

### US-HH-01 — ساخت خانوار (P0)

به‌عنوان کاربر واردشده می‌خواهم یک خانوار خصوصی بسازم تا همکاری را شروع کنم.

- با فرض account معتبر، وقتی نام معتبر را ثبت می‌کنم، آنگاه سرور household و membership نقش Owner را اتمیک می‌سازد و context همان account را فعال می‌کند.
- اگر request تکرار شود، idempotency household دوم نمی‌سازد.
- اگر کاربر مجاز به household دوم نیست، UI قبل از mutation محدودیت را توضیح می‌دهد.
- معیار UX: در 360px نام، توضیح حریم خصوصی و CTA بدون overflow و با keyboard کامل قابل استفاده‌اند.

### US-HH-02 — دعوت عضو (P0)

به‌عنوان عضو دارای `MEMBER_INVITE` می‌خواهم برای account/email مشخص یک لینک دعوت identity-bound و محدود بسازم تا forward یا سرقت لینک، account دیگری را عضو نکند.

- هنگام ساخت، role/capabilities، expiry و نام خانوار نمایش داده می‌شوند.
- token فقط در پاسخ ایجاد قابل کپی است، hash-at-rest ذخیره می‌شود و raw token در analytics/log وارد نمی‌شود.
- دعوت تکراری membership تکراری نمی‌سازد؛ UI نتیجهٔ «دعوت قبلی هنوز فعال است» یا replace را روشن می‌گوید.
- copy هرگز «دعوت شد» نمی‌گوید مگر server ack دریافت شده باشد.

### US-HH-03 — پذیرش/رد دعوت (P0)

به‌عنوان گیرنده می‌خواهم پیش از accept بدانم به کدام خانوار و با چه دسترسی وارد می‌شوم.

- لینک معتبر، نام خانوار، inviter، دسترسی و expiry را نشان می‌دهد.
- accept یک‌بار و اتمیک است؛ reuse/expired/revoked بدون membership به state امن می‌رود.
- decline عضویت نمی‌سازد و inviter فقط status لازم را می‌بیند.
- اگر login لازم باشد، redirect intent به account دیگر نشت نمی‌کند و بعد از login دوباره token validate می‌شود.

### US-HH-04 — مشاهده و مدیریت اعضا (P0)

به‌عنوان owner می‌خواهم نقش و وضعیت اعضا را ببینم تا مسئولیت روشن باشد.

- لیست relationship/roleهای authenticated یعنی `OWNER/ADULT/MEMBER/GUEST_SHOPPER` و capabilityهای مؤثر را نشان می‌دهد؛ managed profile جدا و بدون login است و role مترادف مجوز blanket نیست.
- outsider نمی‌تواند endpoint یا realtime channel اعضا را بخواند.
- تغییر قابلیت audit می‌شود و sessionهای عضو در request بعدی policy تازه را می‌گیرند.

### US-HH-05 — حذف عضو (P0)

به‌عنوان عضو دارای `MEMBER_REMOVE` می‌خواهم عضو غیرمالک را حذف کنم.

- confirmation نام عضو و اثر فوری را می‌گوید؛ destructive CTA distinct است.
- پس از ack، API/realtime/cache/notification access عضو قطع می‌شود.
- command آفلاینِ عضو حذف‌شده replay نمی‌شود و علت قابل اقدام می‌بیند.
- آخرین owner و owner بدون transfer قابل حذف نیست.

### US-HH-06 — خروج از خانوار (P0)

به‌عنوان عضو می‌خواهم خارج شوم و بدانم چه دسترسی/داده‌ای از دست می‌دهم.

- عضو عادی با re-confirm خارج می‌شود؛ cache context پاک می‌گردد.
- owner تا transfer یا archive اجازه خروج ندارد.
- personal/private data policy جدا از household data در confirmation توضیح داده می‌شود.

### US-HH-07 — انتقال مالکیت (P0)

به‌عنوان owner می‌خواهم مالکیت را به عضو authenticated و غیرمهمان واجد شرایط منتقل کنم.

- target باید membership فعال با role `ADULT` یا `MEMBER` و eligibility لازم داشته باشد؛ `GUEST_SHOPPER` و managed profile هدف معتبر نیستند.
- re-auth و تأیید دو مرحله‌ای لازم است؛ mutation اتمیک و audit‌شده است.
- قطع شبکه با lookup idempotency نتیجهٔ واقعی را بازیابی می‌کند؛ دو owner ناخواسته یا zero-owner ایجاد نمی‌شود.

### US-HH-08 — archive خانوار (P0)

به‌عنوان owner می‌خواهم خانوار را archive کنم تا همکاری متوقف ولی تاریخچه طبق retention حفظ شود.

- همهٔ invite/share فعال revoke و mutationها متوقف می‌شوند.
- اعضا state «بایگانی شده» و next action مجاز را می‌بینند.
- restore/deletion تا تصمیم retention وعده داده نمی‌شود.

### US-HH-09 — managed profile (P2 / بعد از evidence و Legal Gate)

به‌عنوان Owner یا Adult manager می‌خواهم حضور یک فرد تحت مدیریت را بدون حساب مستقل ثبت کنم.

- profile login، email، push token، invite یا social action ندارد.
- هر اقدام acting Owner/Adult manager را ثبت می‌کند؛ managed profile membership یا session مستقیم ندارد.
- دادهٔ حساس default-off است و پیش از Human Decision Gate در share/notification ظاهر نمی‌شود.

## Epic H2 — Shared shopping

### US-SH-01 — مشاهده لیست مشترک و منشأ (P0)

به‌عنوان عضو می‌خواهم هر قلم، مقدار، درخواست‌کننده و منشأ meal/manual را ببینم.

- server list با household scope می‌دهد؛ outsider 403/404 مطابق security policy.
- loading/empty/error/offline/stale states از هم قابل تشخیص‌اند.
- نام، مقدار و status برای screen reader یک accessible name منسجم دارند.

### US-SH-02 — افزودن/ویرایش قلم (P0)

به‌عنوان عضو دارای `SHOPPING_WRITE` می‌خواهم قلم را با quantity/unit/note/substitution rule اضافه کنم.

- add optimistic با label «در انتظار ارسال» است؛ server ack آن را «ثبت شد» می‌کند.
- invalid unit/quantity کنار field توضیح داده می‌شود و null به صفر تبدیل نمی‌شود.
- semantic duplicate prompt ادغام/جدا نگه‌داشتن می‌دهد؛ merge پنهان ممنوع.
- edit با baseVersion؛ stale update به conflict recovery می‌رود.

### US-SH-02A — تعیین مسئول اختیاری قلم (P0)

به‌عنوان عضو می‌خواهم یک نفر را مسئول قلم کنم، بدون اینکه آن را با claim لحظه‌ای خریدار یکی بگیرم.

- هر قلم حداکثر یک assignee اختیاری دارد؛ multi-assignee در v1 نیست.
- assignee مسئول پیگیری است؛ `claim/in-cart` فقط state گذرای Shopping Session است.
- حذف عضو، assignment را به unassigned تبدیل و history را حفظ می‌کند؛ قلم حذف نمی‌شود.
- assignment اعلان جدا فقط با preference و dedupe دارد؛ ابزار امتیازدهی/نظارت بر اعضا نیست.

### US-SH-03 — شروع/پایان Shopping Session (P0)

به‌عنوان shopper می‌خواهم جلسه را صریح شروع کنم تا تغییرات مهم برجسته شوند.

- شروع فقط presence محدود و startedAt را ثبت می‌کند؛ مکان‌یابی فعال نمی‌شود.
- اعضا shopper و زمان شروع را می‌بینند؛ چند shopper policy آشکار است.
- پایان session، pending decisionها را خلاصه می‌کند و status قلم‌ها را تغییر خودکار نمی‌دهد.
- session stale با policy سرور expire می‌شود و UI «هنوز در فروشگاه» ادعا نمی‌کند.

### US-SH-04 — افزودن قلم هنگام خرید (P0)

به‌عنوان عضو خانه می‌خواهم قلم تازه به shopper فعال برسانم.

- قلم در realtime با badge «تازه» ظاهر می‌شود و origin مشخص است.
- notification فقط یک‌بار، group/dedupe شده و actor آن را دریافت نمی‌کند.
- اگر shopper آفلاین است، sender فقط server persistence را می‌بیند و UI delivery-to-device را ادعا نمی‌کند.

### US-SH-05 — claim/in-cart/bought (P0)

به‌عنوان shopper می‌خواهم با کنترل بزرگ و یک‌دستی وضعیت قلم را تغییر دهم.

- toggle bought حداقل 44×44، text alternative و undo دارد.
- event تکراری/دو tab خرید دوباره ایجاد نمی‌کند.
- bought/unavailable race با state machine حل و outcome/history نمایش داده می‌شود.
- موفقیت تنها پس از ack؛ در حالت pending icon+text مجزا دارد.

### US-SH-06 — تغییر quantity (P0)

به‌عنوان عضو می‌خواهم مقدار را تغییر دهم بدون اینکه edit هم‌زمان گم شود.

- quantity operation، base version و unit معتبر دارد.
- conflict مقدار local و server را کنار هم می‌گذارد؛ جمع خودکار فقط اگر operation delta صریح و policy تصویب‌شده باشد.
- تغییر روی item in-cart/bought هشدار اثر می‌دهد و silent overwrite نمی‌کند.

### US-SH-07 — اعلام ناموجودی (P0)

به‌عنوان shopper می‌خواهم کالا را ناموجود کنم و next action را انتخاب کنم.

- action sheet گزینه‌های جایگزین/پرسش/رد را بر اساس rule و capability می‌دهد.
- status و history فوراً context را نشان می‌دهند؛ notification مبهم ساخته نمی‌شود.
- offline unavailable به‌عنوان pending ذخیره و نتیجهٔ server بعداً reconcile می‌شود.

### US-SH-08 — ارسال گزینه و عکس (P1، attachment مشروط به Security Gate)

به‌عنوان shopper می‌خواهم حداکثر چند گزینهٔ مشخص با عکس/قیمت بفرستم.

- عکس private household attachment است و type/size validation، protected access، URL غیرعمومی، upload progress، retry/replace، metadata و retention/deletion policy دارد.
- option بدون عکس نیز کامل قابل استفاده است.
- preview محلی «ارسال شد» تلقی نمی‌شود؛ اگر upload fail شود متن و گزینه‌ها باقی می‌مانند.

### US-SH-09 — تصمیم جایگزین (P0)

به‌عنوان principal دارای `SHOPPING_DECISION_RESOLVE` می‌خواهم approve/reject کنم.

- deep link exact request را باز می‌کند و expiry/outcome را نشان می‌دهد.
- Owner/Adult/Member مجازند؛ Guest Shopper فقط با delegation صریح و policy. نخستین پاسخ معتبر با CAS تصمیم را resolve می‌کند؛ duplicate/late action no-op و idempotent است.
- timeout رضایت یا خرید خودکار نیست.
- shopper outcome را in-app/realtime می‌بیند؛ notification privacy-safe است.

### US-SH-10 — undo و activity (P0)

به‌عنوان عضو می‌خواهم اشتباه اخیر را برگردانم و بدانم چه کسی چه کرد.

- undo command جدید با permission و current state validate می‌شود.
- اگر downstream مانع است، دلیل و recovery داده می‌شود؛ UI local rewind جعلی ندارد.
- history actor، action و زمان لازم را دارد ولی raw sensitive payload/token ندارد.

### US-SH-11 — کار آفلاین و reconnect (P0)

به‌عنوان shopper با شبکهٔ ضعیف می‌خواهم قلم‌ها را ببینم و editهای مجاز را صف کنم.

- cached context account+household scoped و بعد logout/switch غیرقابل دسترس است.
- هر command status `روی دستگاه/در حال ارسال/تأیید سرور/نیازمند بررسی` دارد.
- replay ordered، idempotent و backoffدار است؛ duplicate event state دوم نمی‌سازد.
- revoked permission/expired decision/stale version به recovery item تبدیل می‌شود، نه حذف خاموش.

## Epic H3 — Notifications

### US-NT-01 — مرکز اعلان actionable (P0)

به‌عنوان عضو می‌خواهم فقط اعلان‌های دارای context و action را ببینم.

- هر notification title، reason، time، read state، expiry و deep link معتبر دارد.
- generic low-value changes silent sync می‌شوند.
- actor از action خودش اعلان نمی‌گیرد مگر نتیجهٔ asynchronous لازم باشد.

### US-NT-02 — preference server-backed (P0)

به‌عنوان عضو می‌خواهم نوع رویداد/کانال/quiet hours را تنظیم کنم.

- read/write از server است و روی دستگاه دوم یکسان دیده می‌شود.
- scheduler/delivery preference را enforce می‌کند؛ frontend toggle تنها منبع حقیقت نیست.
- consent-sensitive channelها default-off و تغییرشان audit-safe است.

### US-NT-03 — push permission (P1، readiness-gated)

به‌عنوان کاربر می‌خواهم قبل از browser prompt دلیل درخواست push را بدانم.

- pre-prompt فقط در context ارزشمند و یک‌بار نمایش داده می‌شود.
- deny مسیر اصلی را نمی‌شکند؛ in-app ادامه دارد و prompt loop رخ نمی‌دهد.
- lock screen پیش‌فرض generic است؛ detailed preview opt-in جدا دارد.

### US-NT-04 — notification action (P0)

به‌عنوان گیرنده می‌خواهم از اعلان، تصمیم را باز/انجام دهم.

- action پس از auth و capability دوباره validate می‌شود.
- expired/revoked/already-decided state نتیجهٔ دقیق می‌دهد.
- tap/action تکراری mutation دوم ایجاد نمی‌کند.

### US-NT-05 — ضد spam و quiet hours (P0)

به‌عنوان عضو می‌خواهم اعلان‌های نزدیک group و هنگام سکوت defer شوند.

- dedupe/collapse/rate limit در backend اثبات می‌شود.
- urgent فقط decision-required و با policy است؛ quiet-hours bypass پیش‌فرض ندارد.
- user mute/opt-out و spam complaint metric بدون payload حساس ثبت می‌شود.

## Epic H4 — Meal Board

### US-MB-01 — مشاهده هفته و state (P1)

به‌عنوان عضو می‌خواهم هفته، stage، slotها و نسخهٔ تأییدشده را ببینم.

- current week بر اساس household timezone و first-day policy است.
- empty state به پیشنهاد غذا هدایت می‌کند؛ calendar صرف نیست.
- stale/offline banner و last-synced time truthfully نمایش داده می‌شوند.

### US-MB-02 — پیشنهاد meal (P1)

به‌عنوان عضو می‌خواهم recipe یا meal دستی را با دلیل پیشنهاد دهم.

- proposal شامل slot target، proposer و context است و canonical را overwrite نمی‌کند.
- concurrent proposals هر دو حفظ می‌شوند مگر exact idempotent duplicate.
- member removed proposal history را خراب نمی‌کند ولی action تازه نمی‌تواند بزند.

### US-MB-03 — واکنش ساده (P1)

به‌عنوان عضو می‌خواهم `می‌خواهم/بد نیست/این هفته نه` را ثبت و ویرایش کنم.

- یک active reaction per member/proposal؛ update idempotent.
- aggregate count بدون ranking یا pressure score؛ user می‌تواند reaction را پاک کند.
- managed profile آینده فقط از طریق acting Owner/Adult manager و endpoint delegated.

### US-MB-04 — حضور و مهمان (P1)

به‌عنوان عضو/مدیر می‌خواهم eating/absent و guest count را تنظیم کنم.

- unknown صریح است و صفر تلقی نمی‌شود.
- guest count عدد صحیح غیرمنفی؛ نیاز به نام مهمان ندارد.
- تغییر attendance بعد confirm، serving/shopping impact را به diff می‌برد.

### US-MB-05 — servings (P1)

به‌عنوان confirmer می‌خواهم serving پیشنهادی را ببینم و override کنم.

- محاسبه بر مبنای eating + guests توضیح داده می‌شود.
- H4 serving count را ثبت و اثر shopping را preview می‌کند؛ تغییر مقدار فقط با transform موجود و اثبات‌شده قابل پیشنهاد است.
- واحد غیرقابل تبدیل `نیازمند بررسی` است، نه fraction بی‌معنا؛ transform عمومی ingredient/nutrition/step/shopping به H6/P2 موکول است.

### US-MB-06 — تأیید و version lock (P1)

به‌عنوان دارای `PLAN_CONFIRM` می‌خواهم نسخه را پس از review قفل کنم.

- confirm summary شامل unknown attendance و shopping impact است.
- دو confirm هم‌زمان فقط یک version فعلی می‌سازد؛ client stale compare/refresh می‌گیرد.
- lock پیشنهاد را ممنوع نمی‌کند؛ direct overwrite را ممنوع می‌کند.

### US-MB-07 — تغییر برنامه و shopping diff (P1)

به‌عنوان confirmer می‌خواهم پیش از apply، اقلام add/remove/change/review را ببینم.

- manual، bought و active-session item خودکار حذف/کاهش نمی‌شوند.
- user چهار انتخاب دارد: plan+shopping، plan only، proposal، cancel.
- apply اتمیک/idempotent است؛ partial نتیجهٔ هر item و retry-safe flow دارد.

### US-MB-08 — rollback نسخه (P1)

به‌عنوان Owner/Adult دارای `PLAN_CONFIRM` می‌خواهم نسخهٔ قبلی را مبنا کنم.

- rollback نسخهٔ جدید و diff می‌سازد؛ history حذف نمی‌شود.
- shopping اثر جداگانه review می‌شود.

## Epic H5 — Secure sharing/advisor

### US-SR-01 — ساخت view share (P2 / H5-gated)

به‌عنوان دارای `SHARE_CREATE` می‌خواهم بازه، scope و expiry را انتخاب کنم.

- sensitive scopes خاموش و توضیح‌دارند؛ select-all حساس وجود ندارد.
- raw URL یک‌بار نشان داده و token hash-at-rest است.
- preview دقیقاً دادهٔ گیرنده را پیش از create نشان می‌دهد.

### US-SR-02 — مشاهده share بیرونی (P2 / H5-gated)

به‌عنوان viewer می‌خواهم فقط scope و بازهٔ مجاز را ببینم.

- expired/revoked/deleted-plan state دادهٔ قبلی را render نمی‌کند.
- noindex/referrer/cache policy اعمال و private fields در payload غایب‌اند، نه فقط hidden.
- tablet و desktop خوانا و keyboard accessible؛ mobile نیز functional است.

### US-SR-03 — review comment/proposal (P3 / validate before build)

به‌عنوان advisor می‌خواهم comment contextual یا change proposal بدهم.

- comment به slot/proposal وصل؛ generic chat وجود ندارد.
- proposal before/after و reason دارد و canonical write endpoint برای advisor رد می‌شود.
- identity policy و medical disclaimer بدون ادعای صلاحیت نمایش داده می‌شود.

### US-SR-04 — accept/reject advisor proposal (P3 / validate before build)

به‌عنوان Owner/Adult دارای `PLAN_CONFIRM` می‌خواهم پیشنهاد را مقایسه و تصمیم بگیرم.

- accept به plan version/diff می‌رود؛ overwrite مستقیم نیست.
- reject reason اختیاری و history immutable است.
- stale proposal با نسخهٔ فعلی compare و نیاز به rebase دارد.

### US-SR-05 — revoke/scope reduction (P2؛ prerequisite هر لینک بیرونی)

به‌عنوان creator/owner می‌خواهم share را فوراً revoke یا محدود کنم.

- request بعدی و session فعال دسترسی را قطع می‌کند؛ cached response policy مانع reuse است.
- reduction token را rotate/invalidate می‌کند طبق ADR.
- viewer صفحهٔ محترمانهٔ «دسترسی پایان یافته» می‌بیند، بدون افشای household.

## Epic H6 — Competitive cooking (ثبت‌شده، نه تعهد v1)

### US-CP-01 — Verified Cook Feedback (P2 / validate before build)

فقط پس از cook completion، یک feedback قابل ویرایش per user/recipe؛ aggregate تا sample حداقل نمایش داده نشود. generic star rating مستقل رد می‌شود.

### US-CP-02 — Voice guidance (P2 / privacy + Persian capability gate)

next/previous/repeat/pause/continue و ingredient amount با visual equivalent؛ microphone rationale، حداقل دسترسی و graceful fallback. standalone timer اضافه نمی‌شود.

### US-CP-03 — Receipt scan (P2 / architecture + privacy gate)

photo → extraction → review → shopping match → confirm quantity → optional pantry update. هیچ pantry auto-update بدون review و هیچ OCR dependency بدون بررسی.

### US-CP-04 — Recipe import (P2 / legal + source capability gate)

URL/social/video/manual به `PRIVATE_DRAFT` با attribution و review می‌رود؛ scraping bypass و auto-publication ممنوع.

### US-CP-05 — What should we cook? (P2 / validate)

پیشنهاد explainable با pantry، attendance، time و repeat؛ actions محدود yes/maybe/not-this-week/propose. swipe اعتیادآور بدون decision value رد می‌شود.

## Cross-cutting adversarial stories

### US-X-01 — account switch isolation (P0)

با فرض Account A، وقتی logout و Account B login می‌کند، هیچ cache، offline queue، notification، share intent یا realtime subscription متعلق به A در B دیده/ارسال نمی‌شود.

### US-X-02 — outsider/IDOR (P0)

Account C با identifier حدس‌زده نمی‌تواند household/item/plan/member/share-admin را read/write کند؛ UI hiding معیار نیست.

### US-X-03 — removed member mid-session (P0)

وقتی عضو حین session حذف می‌شود، subscription قطع، mutation بعدی رد، offline queue quarantine و private cache پاک می‌شود؛ اعضای دیگر state صحیح می‌بینند.

### US-X-04 — duplicate/replay (P0)

retry شبکه، دو tab، duplicate event و notification action تکراری یک اثر دامنه‌ای می‌سازند و acknowledgment قابل بازیابی است.

### US-X-05 — accessible realtime (P0)

تغییر remote نباید focus را جابه‌جا کند؛ summary کنترل‌شده به live region می‌رود و خرید سریع با touch/keyboard/screen reader ممکن است.

### US-X-06 — Persian RTL integrity (P0)

نام فارسی، عدد/واحد لاتین، URL و currency در 360px ترتیب درست و بدون overflow دارند؛ direction spoof یا متن دوجهته به UI/notification آسیب نمی‌زند.

## Traceability map

| فاز | Storyها | Flowهای UX | گیت اصلی |
|---|---|---|---|
| H1 | US-HH-01..09 | A–E | P0 foundation؛ managed profile جداگانه P2/future-gated |
| H2 | US-SH-01..11 | F–Q | P0 shopping؛ attachment عکس در US-SH-08 فقط P1/gated |
| H3 | US-NT-01..05 | H، K–M و notification states | P0 in-app/server enforcement؛ push در US-NT-03 فقط P1/readiness-gated |
| H4 | US-MB-01..08 | R–V | P1؛ slot uniqueness, version/diff, serving correctness |
| H5 | US-SR-01..05 | W–Z | P2/P3 gated؛ scope, expiry/revoke, no canonical advisor write |
| H6 | US-CP-01..05 | خارج از A–Z v1 | Decision Matrix + feature-specific gate |

## نتیجهٔ عملی

`[قطعی]` اول US-HH-01..07 و US-X-01..04 را به API/permission tests تبدیل کنید؛ تا عبور آن‌ها، H2 به بعد Ready نیست. سپس هر story H2 را با state machine و conflict policy همان entity پیاده کنید، نه با مجموعه‌ای از toggleهای UI.
