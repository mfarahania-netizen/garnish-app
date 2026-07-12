# UX flow specification — Garnish Household OS v1

**وضعیت:** implementation-ready برای Stage A؛ پیاده‌سازی مشروط به prerequisite gate
**سطح اصلی:** موبایل فارسی RTL در 360/390/430/480 CSS px
**سطوح تکمیلی:** tablet برای external share؛ desktop برای advisor review
**قاعده:** success فقط پس از server acknowledgment؛ optimistic state با «در انتظار» مشخص است.

**مرز rollout:** A–Q مسیرهای P0/H1–H3 را پوشش می‌دهند، با این استثنا که attachment عکس در L، P1 و gated است و گزینهٔ متنیِ بدون عکس باید P0 را کامل نگه دارد. R–V فاز P1/H4 هستند. W–Z برای completeness طراحی شده‌اند اما H5، P2/P3 و gated است؛ advisor review تا اعتبارسنجی تقاضا و هیچ external share تا وجود expiry/revoke/scope/audit ساخته نمی‌شود. managed-profile interaction نیز future-gated است.

## 1. معماری اطلاعات و shell

ناوبری موبایل پیشنهادی:

1. `خانه` — خلاصهٔ تصمیم‌های باز؛
2. `برنامه` — Meal Board؛
3. `خرید` — لیست و Shopping Session؛
4. `اعلان‌ها` — actionable center؛
5. `بیشتر` — اعضا، خانوار، share و تنظیمات.

نام خانوار در top bar دیده می‌شود. household switcher فقط اگر multi-household واقعاً فعال باشد؛ انتخاب جدید باید cache/query/subscription را بر مبنای household عوض کند و pending local command قبلی را پنهان نکند.

### الگوهای مشترک

- صفحهٔ اصلی: app bar، heading یکتا، state banner، محتوای scroll و CTA اصلی.
- موبایل: form/actionهای کوتاه در bottom sheet؛ کار destructive یا تصمیم پیچیده در full-screen sheet.
- tablet/desktop: dialog با `max-inline-size` و focus trap؛ inline split view فقط برای review.
- bottom action bar با `padding-block-end: env(safe-area-inset-bottom)` و بدون پوشاندن آخرین item.
- toast فقط برای acknowledgment کم‌ریسک؛ خطا/conflict/partial sync در banner/card پایدار.
- remote update focus را جابه‌جا نمی‌کند؛ reorder تا پایان interaction کاربر defer یا با badge اعلام می‌شود.
- destructive confirmation فقط برای remove/leave/transfer/archive/revoke و apply diff مخرب؛ toggleهای معمول undo دارند.

## 2. رفتار responsive

| سطح | رفتار اجباری |
|---|---|
| 360 | یک ستون؛ metadata ثانویه زیر عنوان؛ sticky CTA تمام‌عرض؛ هیچ کنترل هم‌ردیفِ کمتر از 44px؛ no horizontal scroll |
| 390 | baseline؛ item row با status و action اصلی؛ secondary actions در menu/sheet |
| 430 | حداکثر دو action کوتاه هم‌ردیف اگر هرکدام ≥44px؛ note preview دو خط |
| 480 | formهای کوچک می‌توانند دو column منطقی داشته باشند؛ جریان و ترتیب DOM عوض نشود |
| tablet ≥768 | external share centered تا حدود 720px؛ table فقط با header واقعی و fallback card |
| desktop ≥1024 | advisor review: plan در pane اصلی و comments/proposal در pane دوم؛ هر pane landmark و keyboard reachable |

Zoom 200% نباید کارکرد را از بین ببرد. breakpoint بر اساس محتواست، نه device name.

## 3. قالب استاندارد state و mutation

Mutation lifecycle:

`idle → optimistic-pending → acknowledged` یا `optimistic-pending → retryable-error|conflict|unauthorized`.

- pending: icon + متن `در انتظار ارسال`؛ CTA مربوطه disabled فقط برای command مشابه، نه کل صفحه.
- acknowledged: state دامنه به‌روزرسانی و اعلان status کوتاه.
- timeout/unknown: `نتیجه هنوز مشخص نیست` + lookup/retry؛ command تازه با idempotency جدید ساخته نشود.
- conflict: دادهٔ local حفظ و compare UI باز؛ dismiss برابر discard نیست.
- offline: command در queue و count در banner؛ خروج از صفحه queue را پاک نمی‌کند.

## 4. جریان‌های A تا Z

### A. Create household

**ورودی:** onboarding یا `بیشتر ← خانوار جدید`.
**پیش‌شرط:** login، eligibility ساخت.

1. صفحه نام `ساخت خانوار` با توضیح یک‌خطی حریم خصوصی.
2. field اجباری `نام خانوار`؛ trim، length و bidi-safe rendering؛ تنظیمات پیشرفته پنهان.
3. CTA `ساخت خانوار`؛ حین request متن `در حال ساخت…`.
4. پس از ack به empty household home با checklist سه‌مرحله‌ای: دعوت، قلم اول، برنامه هفته.

**خطا:** duplicate/idempotent response همان خانوار را باز می‌کند؛ limit به تنظیم/تماس پشتیبانی هدایت می‌کند.
**دسترس‌پذیری:** focus روی heading؛ error با field مرتبط؛ autofill نام شخصی استفاده نشود.

### B. Invite member

**ورودی:** `اعضا ← دعوت عضو`؛ capability لازم.

1. sheet: account/email هدفِ اجباری + role مجاز `ADULT`، `MEMBER` یا `GUEST_SHOPPER` + خلاصهٔ capability/expiry؛ `OWNER` فقط با flow انتقال و managed profile بدون invite ساخته می‌شود.
2. expiry با گزینه‌های محدود؛ پیش‌فرض موقت 7 روز.
3. preview: «گیرنده چه می‌بیند/چه می‌تواند انجام دهد» و «فقط همین حساب می‌تواند بپذیرد».
4. CTA `ساخت دعوت محدود`.
5. پس از ack: مقصد masked، لینک identity-bound، `کپی دعوت` و `لغو دعوت`؛ share sheet سیستم اختیاری. لینک بدون target یا قابل‌انتقال CTA ندارد و در MVP ساخته نمی‌شود.

**ریسک UX:** raw token در notification/toast طولانی نمایش داده نشود؛ copy result در aria-live کوتاه.
**duplicate:** card دعوت قبلی + `کپی دوباره`/`باطل و دعوت تازه`.

### C. Accept/decline invite

**ورودی:** deep link؛ validate server قبل و بعد login.

1. card با نام خانوار، inviter، role/capabilities و expiry.
2. CTA primary `پیوستن به خانوار`؛ secondary `رد دعوت`.
3. اگر login لازم است: intent محفوظ، بعد login validation تازه؛ account فعلی آشکار.
4. accept ack → household home و short orientation؛ decline ack → neutral exit.

**expired/revoked/used:** state اختصاصی؛ CTA `بازگشت به خانه` و در صورت امن `درخواست دعوت تازه`. وجود member/email افشا نشود.
**conflict:** اگر از قبل عضو است، `این خانوار قبلاً اضافه شده` و open household.

### D. Remove/leave household

**Remove:** `اعضا ← عضو ← حذف از خانوار`.

1. صفحه/sheet نام و اثر: قطع فوری دسترسی، باقی‌ماندن audit طبق retention.
2. destructive CTA `حذف [نام]`؛ confirmation دوم فقط اگر عضو session/decision فعال دارد.
3. ack → member list؛ banner پایدار نتیجه و `مشاهده فعالیت`.

**Leave:** `تنظیمات خانوار ← خروج`؛ اثر cache/share/pending work را نشان دهد. owner با پیام blocking به E هدایت شود.

**offline:** این اعمال queue نمی‌شوند؛ اتصال لازم است.
**focus:** پس از حذف focus به heading لیست و status announcement، نه row حذف‌شده.

### E. Transfer ownership

1. از `تنظیمات خانوار ← انتقال مالکیت`، فقط members eligible نمایش داده شوند.
2. انتخاب target → summary قابلیت‌های تازه و قابلیت‌های owner فعلی.
3. re-auth؛ سپس تایپ نام خانوار یا checkbox acknowledgment (نه هر دو).
4. CTA `انتقال مالکیت`; timeout با result lookup.
5. ack → role summary تازه؛ back navigation نباید UI owner قدیمی cached نشان دهد.

**race:** target removed/inactive → error پایدار + reload list.
**offline:** ممنوع و با دلیل.

### F. Shared shopping normal mode

**صفحه:** heading `خرید`، progress `x از y گرفته شد`، session status، add field/button، گروه‌بندی aisle/category.

- row: checkbox/status action بزرگ، نام، quantity/unit، origin/requester، assignee اختیاری و sync state؛ secondary menu برای assign/edit/unavailable/delete/history. assignee با claim/in-cart session یکی نیست.
- item تازه remote با badge `تازه`، بدون پرش focus؛ group reorder پس از interaction.
- empty: `هنوز چیزی برای خرید نیست` + `افزودن قلم` و secondary `ساخت از برنامه`.
- filters ساده: `همه/مانده/گرفته‌شده`؛ search P1.
- bought section collapsed اما count و undo discoverable.

**یک‌دستی:** action اصلی نزدیک لبهٔ پایین/راست منطقی؛ swipe gesture هرگز تنها مسیر نیست.
**realtime:** remote actor و زمان نسبی در detail، نه toast برای هر تغییر.

### G. Start Shopping Session

1. CTA prominent `شروع خرید` در F؛ sheet کوتاه توضیح می‌دهد location tracking وجود ندارد.
2. optionهای اختیاری store/name و end reminder؛ هیچ GPS permission.
3. ack → mode خرید: header `خرید در حال انجام`، elapsed approximate، shopperها، `پایان خرید`.
4. پایان: summary bought/unavailable/decision pending؛ CTA `پایان جلسه` و link بازگشت برای unresolved.

**هم‌زمان:** session فعال دیگری → join یا start policy؛ پیش‌فرض `پیوستن به جلسه` و نمایش shopper.
**stale:** server expiry با copy `این جلسه پایان یافته`، نه presence جعلی.

### H. Add item while another member is shopping

1. member normal add را انجام می‌دهد؛ UI نشان می‌دهد `[نام] در حال خرید است`.
2. checkbox `به خریدار اطلاع بده` پیش‌فرض روشن فقط برای session فعال و event preference مجاز.
3. ack server → item persisted؛ delivery state جدا: `به لیست اضافه شد`، نه «خریدار دید».
4. shopper item را realtime با badge `تازه` می‌بیند؛ push/in-app dedupe می‌شود.

**shopper offline:** sender copy `با وصل‌شدن دستگاه خریدار نمایش داده می‌شود` فقط اگر delivery semantics اثبات شود؛ در غیر این‌صورت `در لیست ثبت شد`.

### I. Mark item bought

1. tap کنترل 44px یا action `گرفته شد`.
2. row pending visual، اما status text `در حال ثبت`.
3. ack → moved/collapsed به bought؛ undo snackbar با button دارای نام کامل.
4. fail → row به prior state و inline error + retry.

**race:** اگر server `UNAVAILABLE/DECISION_PENDING` است، conflict card با options `دیدن تصمیم` یا در صورت capability `ثبت به‌عنوان گرفته‌شده`.
**screen reader:** یک announcement جمع‌شده؛ remote bulk updates spam نشوند.

### J. Mark unavailable

1. secondary action `ناموجود است`.
2. action sheet نتیجه‌محور: `جایگزین انتخاب می‌کنم`، `از خانواده می‌پرسم`، `این قلم را نمی‌خرم` بر اساس rule.
3. انتخاب ask به K؛ choose به L؛ skip نیازمند confirmation فقط اگر item به confirmed meal لینک است.
4. server ack status `منتظر تصمیم`/`خرید نمی‌شود`.

**offline:** اجازه queue برای status + draft options؛ اعلان تا server ack ساخته نمی‌شود.
**no substitution:** option shopper choose حذف و دلیل rule نمایش داده شود.

### K. Ask household

1. full-screen sheet با item context و requester؛ recipients policy به زبان ساده.
2. field کوتاه اختیاری `چه چیزی مهم است؟`; deadline محدود؛ generic chat thread ساخته نشود.
3. optionها در L یا choice `بدون عکس بپرس`.
4. preview notification privacy-safe.
5. CTA `ارسال درخواست تصمیم`; ack → decision card با time/status و `لغو درخواست` اگر unresolved و مجاز.

**notification denied:** request همچنان in-app ثبت می‌شود؛ «اعلان push ارسال شد» ادعا نشود.

### L. Send alternative photo/options

**اولویت:** option متنی P0؛ camera/upload subflow فقط P1 پس از approval protected attachment pipeline.

1. option card: نام اجباری، quantity/size و price اختیاری، camera/gallery اختیاری؛ عکس با label «خصوصی برای این خانوار» و protected access.
2. حداکثر options طبق server config؛ `افزودن گزینه` تا limit.
3. upload: preview محلی با `در انتظار بارگذاری`، progress، `تعویض/حذف`.
4. submit تنها وقتی متن minimum معتبر و uploads required ack شده؛ در offline draft queue نمایش داده می‌شود.

**permission camera denied:** راهنمای کوتاه + انتخاب فایل/بدون عکس؛ loop prompt ممنوع. URL عمومی/دائمی برای attachment ساخته نمی‌شود.
**upload failure:** fieldها حفظ؛ retry فقط فایل.

### M. Approve/reject substitution

1. deep link exact decision؛ header item، requester/shopper، deadline، option cards.
2. هر option CTA `این را بخر`؛ CTA ثانویه `هیچ‌کدام` یا `نخر` طبق policy.
3. confirmation اضافی فقط برای تفاوت قیمت بالاتر از max یا no-substitution override.
4. ack → outcome locked، responder/time و shopper delivery state.

**already decided/expired/revoked permission:** read-only result و next action؛ action تکرار نشود.
**privacy:** lock-screen generic؛ detail بعد auth.

### N. Change quantity

1. tap quantity یا menu `ویرایش مقدار`؛ sheet با amount + unit و context current.
2. unit picker locale-aware؛ raw free-text فقط fallback با review flag.
3. submit optimistic pending؛ baseVersion ارسال.
4. ack → row؛ linked meal impact در detail.

**conflict:** Q با local/server values.
**in cart/bought:** warning inline و explicit apply؛ بدون modal اگر تغییر افزایشی کم‌ریسک و policy اجازه دهد.

### O. Undo action

- پس از bought/delete/merge/apply کم‌ریسک، snackbar 8–10 ثانیه‌ای با action `برگردان`؛ زمان دقیق configurable و تست‌پذیر.
- history نیز action `برگرداندن` دارد تا وقتی server `undoEligible` true است.
- undo mutation pending/ack/error را دارد؛ snackbar local rewind نمی‌کند.
- اگر دیگر ممکن نیست، `این تغییر بعداً توسط [عضو] به‌روزرسانی شده` + view history.

### P. Offline edit

1. banner sticky زیر app bar: `آفلاین هستید — n تغییر روی این دستگاه مانده`.
2. edit مجاز انجام می‌شود؛ هر row `روی دستگاه` badge.
3. `دیدن تغییرهای در انتظار` queue sheet با entity/action/time و امکان discard امن.
4. reconnect state `در حال همگام‌سازی n تغییر`؛ focus حفظ.
5. نتیجه: ackها حذف؛ conflict/rejectedها در recovery section باقی.

**ممنوع آفلاین:** invite، transfer، leave/remove، share create/revoke، confirm نهایی حساس. CTA disabled با دلیل؛ نه ناپدید.

### Q. Conflict recovery

1. banner/page `این مورد هم‌زمان تغییر کرده`؛ local draft هرگز گم نشود.
2. compare cards: `نسخهٔ شما` و `نسخهٔ فعلی خانوار` با actor/time در صورت مجاز.
3. actions entity-specific:
   - note: `نسخهٔ فعلی/نسخهٔ من/ترکیب دستی`؛
   - quantity: انتخاب یکی یا edit fresh؛
   - duplicate: `جدا بماند/ادغام`؛
   - plan: `بارگذاری نسخه تازه/ذخیره به‌عنوان پیشنهاد`؛
   - decided request: فقط مشاهده outcome.
4. submit با latest version؛ conflict دوباره قابل تکرار است و data حفظ می‌شود.

**بد:** button مبهم `همگام‌سازی`. **لازم:** نام اثر دقیق هر انتخاب.

### R. Meal proposal

1. `برنامه ← روز/وعده ← پیشنهاد غذا`.
2. search recipe یا `غذای دستی`؛ reason اختیاری؛ pantry/time/repeat indicators فقط explainable.
3. attendance/servings اولیه از known state preview می‌شود، نه auto-final.
4. CTA `ثبت پیشنهاد`; ack → proposal card، proposer و reaction actions.

**slot occupied:** proposal جایگزین ثبت می‌شود، canonical overwrite نه.
**offline:** draft/queue مجاز؛ confirm نیست.

### S. Meal reaction

1. سه segmented/button action با متن: `می‌خواهم`، `بد نیست`، `این هفته نه`.
2. tap دوباره reaction را remove یا picker state را change می‌کند؛ رفتار واضح.
3. count ساده و list اختیاری names طبق privacy؛ هیچ winner/ranking خودکار.
4. pending/ack؛ duplicate tap idempotent.

**a11y:** toggle buttons با `aria-pressed`; emoji/color تنها label نیست.

### T. Member attendance

1. slot detail section `چه کسانی هستند؟`؛ row هر member با `می‌خورد/نیست/نامشخص`.
2. member خودش را تغییر می‌دهد؛ اگر managed profile آینده فعال شد، Owner یا Adult manager مجاز آن را از endpoint delegated «از طرف» تنظیم می‌کند.
3. guest stepper بزرگ با label؛ integer ≥0.
4. summary `پیشنهاد: n پرس` و explanation.
5. بعد confirm، تغییر به V می‌رود و list silently update نمی‌شود.

**bulk:** `همه هستند` فقط در household کوچک و با undo؛ unknownها بی‌صدا eating نشوند.

### U. Confirm plan

1. CTA sticky `مرور و تأیید هفته` فقط برای capability.
2. review page: missing slots، unknown attendance، servings، pantry coverage و shopping impact.
3. issues critical vs warning؛ warning قابل ادامه با copy صریح.
4. CTA `تأیید این نسخه`; baseVersion + idempotency.
5. ack → version label، confirmer/time، next CTA `ساخت/مرور لیست خرید`.

**stale:** confirm رد و Q compare؛ optimistic «تأیید شد» ممنوع.
**دو confirm:** فقط server winner؛ loser refresh.

### V. Shopping-list diff after plan edit

1. پس از edit confirmed plan، full-screen diff با tabs/sections `اضافه`، `حذف`، `تغییر مقدار`، `نیازمند بررسی`.
2. هر row origin/meal، old→new، pantry basis و reason.
3. manual/bought/in-cart item badge محافظت و `نیازمند بررسی`.
4. چهار CTA: primary `برنامه و خرید`؛ secondary `فقط برنامه`؛ `ذخیره پیشنهاد`؛ `انصراف`.
5. apply progress و result summary؛ partial sync جزئیات هر fail + retry failures only.

**undo:** rollback یک version/diff تازه؛ نه حذف history.
**360:** sections card؛ table ممنوع اگر horizontal scroll لازم شود.

### W. Share weekly/monthly plan

1. `برنامه ← اشتراک`؛ mode `فقط مشاهده` یا `درخواست بازبینی`.
2. انتخاب بازه؛ weekly نخستین H5/P2، monthly فقط پس از evidence استفادهٔ تکراری و به‌شکل view aggregation، نه editor ماهانه.
3. scope checklist دسته‌بندی‌شده؛ sensitive scopes جدا، خاموش و با warning.
4. preview دقیق در viewport گیرنده؛ expiry و optional advisor identity.
5. CTA `ساخت لینک`; ack → copy/share + `مدیریت دسترسی`.

**offline:** create ممنوع.
**security:** URL در analytics/referrer نه؛ preview از payload scope‌شدهٔ server استفاده کند.

### X. Advisor comment

**tablet:** single column plan + anchored comment drawer.
**desktop:** plan pane و comment pane؛ انتخاب slot heading را در pane دوم به‌روزرسانی می‌کند.

1. advisor روی meal/proposal `نظر` را می‌زند.
2. textarea کوتاه + label context؛ generic room/chat نیست.
3. برای proposal تغییر: before/after + reason required.
4. submit ack → comment timeline؛ household actionable notification dedupe.

**expired/revoked mid-edit:** draft محلی قابل copy، submit رد و دادهٔ plan پاک.
**medical:** UI صلاحیت حرفه‌ای ادعا نمی‌کند؛ متن سلامت خارج scope warning می‌گیرد، تشخیص تولید نمی‌شود.

### Y. Accept/reject advisor proposal

1. deep link household-authenticated به compare page.
2. نسخهٔ مبنا و current version؛ stale proposal نیازمند rebase/تبدیل به proposal تازه.
3. `پذیرفتن و مرور اثر` به V می‌رود؛ canonical مستقیم تغییر نمی‌کند.
4. `رد پیشنهاد` با reason اختیاری؛ ack و advisor visibility طبق scope.

**permission:** `MEMBER` ممکن است proposal داخلی را ببیند ولی بدون `PLAN_CONFIRM` نمی‌پذیرد؛ `PLAN_REVIEWER` بیرونی فقط در share scope پیشنهاد می‌دهد و canonical decision نمی‌گیرد.
**notification action:** دوباره auth/capability validate.

### Z. Revoke share

1. `بیشتر ← لینک‌های اشتراک`؛ card شامل mode/scope/expiry/last access در صورت policy.
2. `قطع دسترسی` destructive؛ confirmation اثر فوری را می‌گوید.
3. online-only mutation؛ ack → status `قطع شده` و copy link disabled.
4. viewer در next request/read به revoked state می‌رود؛ household UI stale active badge ندارد.

**scope reduction:** `ویرایش دسترسی` باید token rotate/invalidate طبق ADR و لینک تازه را واضح کند.
**undo:** revoke امنیتی undo فوری ندارد؛ share تازه ساخته شود.

## 5. Required state catalogue

| State | نمایش | action اصلی | ممنوع |
|---|---|---|---|
| loading | skeleton هم‌شکل محتوا + heading | cancel navigation طبیعی | spinner تمام‌صفحه بی‌نام، نمایش empty زودرس |
| empty | دلیل + ارزش + یک CTA | ساخت/افزودن مرتبط | چند CTA هم‌وزن، illustration بدون توضیح |
| error | چه چیزی انجام نشد + دادهٔ حفظ‌شده | retry همان operation | پاک‌کردن form، «خطایی رخ داد» تنها |
| offline | banner + last sync + queue count | دیدن pending / ادامهٔ مجاز | success server، queue برای اعمال ممنوع |
| reconnecting | progress غیرمسدودکننده | دیدن queue | disable کل app، reorder focus |
| conflict | local/server compare | انتخاب entity-specific | last-write-wins پنهان، dismiss=discard |
| unauthorized | دسترسی کافی نیست | بازگشت context امن | retry loop، افشای resource |
| expired invite | دعوت دیگر معتبر نیست | home/request fresh if safe | نمایش member data یا accept |
| revoked share | دسترسی پایان یافته | close/home | render cache خصوصی، login loop |
| deleted member | عضویت پایان یافته + cache purge | انتخاب household/home | نمایش stale household، replay queue |
| archived household | read-only label + اثر | export/leave/restore if allowed | mutation controls active |
| notification denied | in-app still works | continue / open OS settings on explicit tap | repeated browser prompt |
| partial sync | x success/y failed + item results | retry failures only | «همه ذخیره شد»، retry موفق‌ها |
| stale data | last updated + server version available | refresh/compare | silent overwrite، stale confirm |

### اولویت هم‌زمانی stateها

`deleted/unauthorized/revoked > conflict > partial sync > offline/reconnecting > stale > normal`. Loading اولیه نباید unauthorized cache را flash کند.

## 6. Notification/deep-link UX

- deep link بعد auth به exact household/entity/version می‌رود؛ household switch فقط با user-visible transition.
- action نامعتبر fallback به notification detail با outcome، نه generic home.
- lock screen پیش‌فرض: `یک تصمیم در گارنیش منتظر شماست`؛ item/meal/member فقط opt-in.
- grouping: چند item تازه در session → یک اعلان summary؛ هر unavailable decision جدا فقط اگر action فوری دارد.
- quiet hours: badge/in-app فوراً، push defer؛ urgent bypass در v1 پیش‌فرض خاموش.
- notification center tabs متعدد نمی‌خواهد؛ filters `نیازمند اقدام/همه` کافی است.

## 7. Offline/conflict usability gates

Release H2/H4 رد می‌شود اگر:

- کاربر تفاوت pending و acknowledged را در usability test نتواند بگوید؛
- logout/account switch queue/cache قبلی را نشان دهد؛
- conflict local draft را از بین ببرد؛
- duplicate/retry اثر دامنه‌ای دوم بسازد؛
- remote reorder باعث activation اشتباه control زیر انگشت شود؛
- تصمیم منقضی پس از reconnect اجرا شود؛
- partial apply به‌صورت success کامل نمایش داده شود.

## 8. UX analytics کمینه

با consent معتبر و بدون raw content/token:

- flow_started/completed/abandoned با flow ID؛
- time_to_first_shared_action؛
- decision_opened/resolved/expired؛
- offline_queue_created/recovered/conflicted؛
- plan_diff_viewed/action_selected؛
- notification_open/action/mute؛
- accessibility preference فقط از media query برای رفتار session، نه profile‌سازی.

## 9. معیار تست دستی flow

برای هر A–Z حداقل:

1. 360px touch و keyboard؛
2. 390 و 430 RTL visual؛
3. 480 zoom/reflow؛
4. loading/empty/error مرتبط؛
5. timeout و retry idempotent؛
6. Account A/B same household و C outsider؛
7. member removed mid-flow؛
8. offline/reconnect اگر mutation مجاز؛
9. stale/conflict اگر versioned؛
10. screen reader name/status/focus؛
11. reduced motion؛
12. no sensitive notification/cache leak.

W–Z علاوه بر این روی tablet/desktop، expiry/revoke و payload scope inspection تست شوند.

## نتیجهٔ عملی

`[قطعی]` ابتدا یک prototype واقعی برای F–Q روی 360px و دو browser بسازید و با شبکهٔ قطع/وصل usability test کنید. اگر کاربر pending، ack و conflict را اشتباه می‌گیرد، قبل از افزودن Meal Board، state language و row design باید اصلاح شود.
