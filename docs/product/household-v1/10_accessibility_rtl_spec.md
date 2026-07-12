# Accessibility & RTL specification — Garnish Household OS v1

**هدف انطباق:** WCAG 2.2 AA برای همهٔ flowهای فعال v1
**جهت و زبان اصلی:** `lang="fa" dir="rtl"`
**وضعیت:** specification؛ انطباق فقط با تست خودکار + دستی + assistive technology اثبات می‌شود
**اولویت فاز-نسبی:** P0 برای household، shopping، تصمیم متنی و اعلان درون‌برنامه‌ای؛ attachment عکس و Meal Board هنگام فعال‌شدن P1؛ share/advisor هنگام فعال‌شدن P2/P3. failure دسترس‌پذیری در هر capability فعال، release blocker همان فاز است؛ spec غیرفعال PASS محسوب نمی‌شود.

## 1. معیارهای غیرقابل مذاکره

1. تمام کارها با keyboard و بدون gesture-only قابل انجام باشند.
2. focus همیشه visible، منطقی و پایدار باشد؛ realtime نباید آن را بدزدد.
3. نام، نقش، مقدار و state کنترل‌ها programmatically determinable باشند.
4. status فقط با رنگ منتقل نشود؛ متن/icon/shape لازم است.
5. touch target اصلی حداقل 44×44 CSS px؛ فاصلهٔ کافی برای جلوگیری از لمس اشتباه.
6. contrast متن و controls در همهٔ stateها AA؛ disabled text جای اطلاعات ضروری را نگیرد.
7. zoom 200% و text spacing باعث از دست رفتن content/action یا horizontal page scroll نشود.
8. `prefers-reduced-motion` رعایت؛ motion برای فهم state ضروری نباشد.
9. modal/sheet focus trap، accessible name، Escape policy و focus return داشته باشد.
10. تغییر realtime/offline/conflict به‌صورت کنترل‌شده announce شود، نه spam.
11. در 360/390/430/480 هیچ overflow افقی از layout اصلی؛ content دوجهته ایزوله شود.
12. notification و external share حداقل داده و language/heading درست داشته باشند.

## 2. زبان، جهت و DOM

### Root و language switching

- document فارسی: `<html lang="fa" dir="rtl">`.
- بخش انگلیسی/URL/کد: `lang="en" dir="ltr"` فقط همان span/block.
- user-generated content: `dir="auto"`; مقدار untrusted هرگز `dir` یا markup تزریق نکند.
- اگر UI locale عوض شود، `lang/dir` root، formatter و logical alignment هم‌زمان عوض شوند؛ CSS duplicate RTL branch حداقل شود.
- title و accessible name نیز به زبان UI باشند؛ screen reader نباید متن فارسی را با voice انگلیسی بخواند.

### DOM order

- DOM order همان reading/focus order باشد؛ از CSS `order` برای معکوس‌کردن معنایی استفاده نشود.
- RTL نباید با `row-reverse` عمومی شبیه‌سازی شود. `direction: rtl` + logical properties مبناست.
- در desktop split review، ترتیب DOM: plan landmark سپس review landmark؛ skip link مستقیم به هرکدام.
- table responsive به card نباید header association را از بین ببرد.

## 3. CSS logical properties contract

برای layout جدید استفاده از physical side properties فقط برای geometry ذاتاً فیزیکی مجاز است.

| ممنوع/نیازمند دلیل | جایگزین |
|---|---|
| `margin-left/right` | `margin-inline-start/end` |
| `padding-left/right` | `padding-inline-start/end` |
| `left/right` | `inset-inline-start/end` |
| `border-left/right` | `border-inline-start/end` |
| `text-align: right` برای فارسی | `text-align: start` |
| `float: right` | flex/grid + logical alignment |
| `border-radius` گوشه‌های physical | `border-start-start-radius` و مشابه در صورت معنایی بودن |

نمونهٔ قرارداد:

```css
.household-card {
  padding-block: var(--g-space-3);
  padding-inline: var(--g-space-4);
  border-inline-start: 0.25rem solid var(--status-color);
  text-align: start;
}

.sticky-actions {
  inset-block-end: 0;
  padding-block-end: calc(var(--g-space-3) + env(safe-area-inset-bottom));
}
```

Lint/style review باید physical propertyهای جدید را flag کند.

## 4. Typography، اعداد و محتوای دوجهته

- فونت فارسی خوانا با glyph کامل، line-height حداقل 1.5 برای body و عدم clipping اعراب.
- حداقل اندازهٔ body پیشنهادی 16 CSS px؛ metadata حداقل 12–14 فقط با contrast کافی و نه برای action حیاتی.
- font weightهای unavailable باعث synthetic/ناخوانا نشوند.
- اعداد/تاریخ/quantity/currency با `Intl` و locale/household policy؛ string concatenation ممنوع.
- ID، version، URL، email و کد با `<bdi dir="ltr">` یا isolation معادل.
- user name/meal/item با `<bdi dir="auto">`; control characters خطرناک normalize/escape شوند.
- truncate فقط metadata؛ نام قلم/meal حیاتی حداقل دو خط یا expandable. tooltip تنها راه دسترسی به متن کامل نیست.
- placeholder جای label را نمی‌گیرد.

## 5. Iconography و mirroring

**mirror می‌شوند اگر جهت‌دار:** back/forward، chevron navigation، reply/undo جهت‌دار، previous/next step.
**mirror نمی‌شوند:** check، plus/minus، camera، microphone، play/pause، clock، location-off، brand mark، food/ingredient imagery.

- icon-only control حتماً accessible name object-specific دارد.
- decorative icon `aria-hidden="true"` و focusable=false.
- status icon کنار متن؛ color/icon تنها نشانه نباشد.
- icon rotation برای RTL باید test snapshot داشته باشد؛ دو بار mirror نشود.

## 6. Keyboard model

### Global

- `Tab/Shift+Tab`: ترتیب DOM؛ هیچ focus trap خارج modal.
- `Enter/Space`: button/toggle؛ native elements ترجیح دارد.
- `Escape`: sheet/dialog غیر destructive را می‌بندد؛ اگر draft unsaved است confirmation با اثر روشن؛ destructive request در حال ارسال را cancel جعلی نکند.
- skip links: `رفتن به محتوای اصلی` و در desktop review `رفتن به نظرها`.
- browser shortcuts override نشوند.

### Composite widgets

- tabs فقط اگر محتوای tab واقعی است: arrow keys مطابق ARIA؛ در RTL semantic previous/next مستند و تست شود.
- reaction group بهتر است toggle buttons یا radio group native؛ `aria-pressed`/checked دقیق.
- list item actionها tab stops محدود؛ menu با arrow/Escape و focus return.
- quantity stepper buttonهای مستقل `افزایش/کاهش تعداد مهمان‌ها` و input عددی قابل تایپ.
- drag/reorder اگر بعداً اضافه شد، alternative keyboard commands و live instructions لازم؛ در v1 وابستگی به drag ممنوع.

## 7. Focus management

| رویداد | focus بعدی |
|---|---|
| route change | heading اصلی با `tabindex=-1`، مگر browser back که focus/history معنادار حفظ شود |
| sheet/dialog open | heading یا اولین field؛ title programmatically linked |
| sheet/dialog close | trigger قبلی؛ اگر حذف شده، نزدیک‌ترین heading/کنترل پایدار |
| item added | add field یا item جدید بر اساس intent؛ announcement کافی، scroll اجباری نه |
| item removed | heading/list container؛ focus روی row بعدی اگر action متوالی لازم |
| remote update | focus بدون تغییر؛ badge/live summary |
| validation fail | error summary، سپس link به field؛ یا اولین field با error در form کوتاه |
| conflict open | conflict heading؛ local draft حفظ |
| unauthorized/member removed | heading صفحهٔ امن بعد cache purge |
| notification deep link | heading entity و سپس action context؛ focus مستقیم روی destructive action نه |

Visible focus با contrast مناسب، حداقل perimeter قابل دید و زیر sticky layers نباشد. `outline: none` بدون replacement ممنوع.

## 8. Modal، bottom sheet و destructive actions

- native `<dialog>` یا accessible dialog pattern؛ `role="dialog"`, `aria-modal="true"`, labelled title، described effect.
- mobile full-screen sheet نیز dialog semantics دارد؛ background inert.
- focus loop در داخل؛ Escape و close button 44×44. اگر action irreversible در حال commit است، وضعیت و عدم امکان cancel روشن.
- focus پس از close به trigger؛ اگر trigger remote حذف شد به heading context.
- confirmation برای remove/leave/transfer/archive/revoke و destructive plan diff؛ toggle bought با undo، نه confirm.
- CTAها `بله/خیر` نیستند: `حذف سارا` / `انصراف`.

## 9. Forms و validation

- label visible و مرتبط با `for/id`; required با text و semantics، نه فقط ستاره.
- help، error و counter با `aria-describedby`; error summary با links به fields.
- validation ترجیحاً blur/submit؛ در هر keystroke announcement نشود.
- server error form values را حفظ می‌کند.
- autocomplete مناسب؛ household name و sensitive note با autocomplete نامربوط پر نشوند.
- input purpose، keyboard type و decimal separator با locale/unit هماهنگ؛ مقدار free-text قابل paste.
- camera/file input جایگزین بدون permission دارد.
- time/date picker باید keyboard و screen reader accessible باشد؛ native یا proven component.

## 10. Touch و one-handed shopping

- خرید primary actionها 44×44 حداقل؛ bought/unavailable فاصله‌ای داشته باشند که لمس اشتباه کم شود.
- item row خودبه‌خود click target ambiguous نباشد؛ controlها label مستقل.
- swipe فقط shortcut؛ menu/button همیشه موجود.
- sticky action bar content را نمی‌پوشاند و safe-area را رعایت می‌کند.
- control مهم در بالای viewport دور از thumb تنها نباشد؛ `افزودن قلم` و session action در دسترس پایین/میان.
- remote insertion زیر انگشت active target را جابه‌جا نکند؛ layout update تا pointerup defer شود.
- haptic feedback تنها enhancement؛ state visual/auditory مستقل.

## 11. Color، contrast و themes

- متن عادی حداقل contrast AA؛ متن بزرگ مطابق تعریف استاندارد؛ design tokens با automated contrast test.
- focus indicator، border control، placeholder، disabled و status در light/dark/high-contrast تست شوند.
- status mapping مثال:
  - pending: icon ساعت + `در انتظار ارسال`؛
  - acknowledged: check + `ثبت شد`؛
  - conflict: دو فلش/علامت + `تغییر هم‌زمان`؛
  - unavailable: icon + `ناموجود`؛
  - destructive: text صریح، نه قرمز تنها.
- forced-colors mode: `currentColor`، border واقعی و system colors؛ background image تنها indicator نباشد.
- color blindness simulation مکمل است، نه جای contrast calculation.

## 12. Motion و animation

- `prefers-reduced-motion: reduce`: transitionهای غیرضروری حذف/کوتاه؛ auto-scroll smooth و parallax ممنوع.
- realtime item pulse حداکثر یک بار و همراه badge؛ در reduced motion بدون pulse.
- skeleton shimmer در reduced motion static.
- هیچ flashing بیش از threshold ایمنی؛ success confetti/celebration در core tasks استفاده نشود.
- progress upload/sync با text percentage/status؛ spinner تنها نباشد.

## 13. Live regions و realtime collaboration

دو region کافی:

- `role="status" aria-live="polite" aria-atomic="true"` برای ack، reconnect و summary؛
- `role="alert"` فقط خطای فوری که ادامه را متوقف می‌کند.

قواعد:

- updateهای remote طی 1–2 ثانیه batch: `{count} تغییر تازه از اعضای خانوار دریافت شد.`
- هر item event جدا announce نشود.
- actor/action فقط اگر privacy و usefulness دارد.
- toast dismiss نباید تنها محل پیام باشد؛ conflict/partial/offline persistent.
- `aria-busy` روی region محدود، نه کل document؛ loading پایان آن announce کوتاه.
- reorder DOM نباید virtual cursor و focus را بی‌دلیل reset کند.

## 14. Offline، sync و conflict accessibility

- banner offline landmark/status با متن و queue count؛ color-only نه.
- pending badge در accessible name row باشد اما تکرار آزاردهنده نکند.
- queue sheet heading و list semantics؛ status هر command.
- reconnect progress announce یک بار شروع و یک بار نتیجه؛ درصدهای سریع spam نشوند.
- conflict compare دو section با heading `نسخهٔ شما/نسخهٔ فعلی خانوار`؛ تفاوت textually مشخص، نه highlight تنها.
- diff مقدار old/new با accessible sentence: `مقدار از ۲ بسته به ۳ بسته تغییر می‌کند.`
- dismiss conflict local draft را discard نکند؛ action discard صریح و destructive.
- partial sync summary و link به هر failed row.

## 15. Component semantics

### Household member row

- list semantics؛ نام heading/text، role/status text؛ action menu button `کارهای مربوط به {memberName}`.
- removed member name در history طبق privacy `عضو پیشین`.

### Shopping item row

- list item؛ primary status native checkbox فقط اگر binary bought semantics دارد. richer state از button + status text استفاده کند.
- accessible name: `{itemName}، {quantity}، {state}`.
- note/origin details با description؛ action menu مستقل.
- changing checkbox pending: `aria-disabled` فقط اگر duplicate command unsafe؛ focus حفظ.

### Decision option

- radio group یا action cards؛ عکس alt توصیفی از user اختیاری. auto-generated alt از filename ممنوع.
- price/size text؛ selected state programmatic.
- expired/result به read-only status، controls حذف یا disabled با دلیل visible.

### Meal proposal/reactions

- proposal article/listitem با heading meal؛ proposer/time metadata.
- reactions toggle buttons با text؛ aggregate count accessible.
- attendance radio group per member؛ guest stepper labelled.

### Plan diff

- sections با heading؛ desktop table header scope؛ mobile cards با explicit old/new labels.
- protected/manual/bought icon همراه text.
- apply buttons اثر کامل را در accessible name/description می‌گویند.

### Notification

- notification list item/article؛ unread status در text/semantics، نه dot تنها.
- title link descriptive؛ action button object-specific.
- timestamp machine-readable در `<time datetime>` و متن locale.

## 16. Attachments، photos و media

- capture/upload کنترل visible label و camera permission rationale.
- preview user-provided alt: برای alternative photo می‌تواند `عکس گزینهٔ {optionName}` باشد؛ object recognition جعلی نکنیم.
- progress text، cancel/retry/replace keyboard accessible.
- crop editor اگر اضافه شد keyboard alternative یا skip crop؛ در v1 crop اجباری نباشد.
- upload error متن option را حفظ کند.
- image orientation/zoom؛ essential text داخل عکس تنها منبع نباشد.

## 17. Notification permission UX

- browser prompt فقط بعد از pre-prompt context و user action؛ focus/label مناسب.
- denial را alert بحرانی نکنیم؛ in-app path و `ادامه بدون اعلان`.
- link `بازکردن تنظیمات دستگاه` فقط با tap صریح؛ ادعای تغییر خودکار setting نه.
- lock-screen copy generic پیش‌فرض؛ detailed content preference نام و توضیح privacy دارد.
- quiet hours inputs keyboard/screen-reader و timezone household آشکار.

## 18. External share و advisor review

### Tablet share

- main landmark واحد، heading plan، scope/expiry notice در ابتدا.
- no horizontal table؛ meal cards یا accessible table با responsive reflow.
- revoked/expired state payload خصوصی را render نکند و heading واضح داشته باشد.
- print/PDF اگر فعال، reading order و tags نیازمند QA جدا؛ وجود browser print معادل accessible PDF نیست.

### Desktop advisor review

- دو landmark labelled: `برنامه` و `نظرها و پیشنهادها`.
- انتخاب meal focus را خودکار به pane نظرها نمی‌برد؛ status و shortcut/link داده شود.
- comment anchored با heading context؛ generic chat log role استفاده نشود مگر واقعاً chat باشد (در v1 نیست).
- proposal before/after textually؛ accept به household-authenticated compare flow می‌رود.
- advisor disclaimer readable و non-modal.

## 19. Managed profile آینده و زبان محترمانه

- label `نمایهٔ تحت مدیریت`؛ رابطهٔ والد/کودک فرض نشود.
- قابلیت در MVP فعال نیست؛ اگر پس از evidence و Human Decision Gate اضافه شد، acting Owner/Adult manager visible است: `از طرف {profileName}` و audit semantics. managed profile membership/login مستقیم ندارد.
- profile کنترل login/notification/share مستقل ندارد.
- privacy explanation ساده و بدون health inference.
- avatar یا رنگ تنها شناسه member نیست؛ نام/text لازم.

## 20. Viewport-specific acceptance

### 360px

- یک ستون؛ actionهای row touch-safe؛ no viewport horizontal overflow در 400% text zoom/reflow حد استاندارد تست شود.
- bottom sheet full-width؛ keyboard virtual نباید field/CTA را غیرقابل دسترس کند.
- نام قلم 40 نویسه و quantity LTR mixed بدون overlap.

### 390px

- baseline screenshots برای F–Q، U/V و state catalogue.
- sticky header/action با safe area و 200% text.

### 430px

- دو action هم‌ردیف فقط اگر هرکدام 44px و متن کامل؛ در غیر این‌صورت stack.
- option photo card بدون cropping متن.

### 480px

- form دو column فقط اگر reading order ثابت؛ labels/fields logical.
- landscape و software keyboard تست.

### Tablet/desktop

- 768/1024/1280 برای W–Z؛ split view در zoom 200% به single column reflow.
- keyboard traversal و landmarks؛ no nested scroll trap.

## 21. Assistive technology test matrix

`[احتمالاً]` ترکیب نهایی باید با browser support policy پروژه بسته شود. حداقل پیشنهادی:

| Platform | Browser/AT | Flowهای smoke |
|---|---|---|
| Windows | Chrome + NVDA | A–C، F–Q، U/V، W–Z |
| Windows | Edge + Narrator | navigation، forms، dialogs، notification |
| iOS | Safari + VoiceOver | F–Q one-handed، camera permission، offline banner |
| Android | Chrome + TalkBack | F–Q، notification deep link، reactions/attendance |
| Keyboard only | Chrome/Firefox/Edge | تمام A–Z |
| Zoom/contrast | browser zoom + forced colors | F، Q، V، X و همهٔ stateها |

در صورتی که فارسی AT کیفیت تلفظ متفاوت دارد، label/DOM correctness باید جدا از voice quality ثبت شود؛ مشکل platform پنهان نشود.

## 22. Automation و manual QA gates

### Automated

- axe یا معادل روی routes/stateهای اصلی؛ zero serious/critical violations.
- eslint accessibility rules و semantic component tests.
- focus trap/return، keyboard activation، accessible name و `aria-pressed/checked` tests.
- contrast token tests؛ RTL/LTR screenshot diffs در 360/390/430/480.
- DOM overflow assertion و no unexpected horizontal scroll.
- bidi fuzz: Persian + English + digit + punctuation + Unicode controls sanitized.
- reduced-motion test؛ live-region batching unit/integration.

### Manual — الزامی

- screen reader task completion، نه فقط element inspection.
- keyboard تمام A–Z؛ no trap/hidden focus.
- touch target با device/emulation واقعی.
- 200% zoom و text spacing؛ long Persian strings.
- forced colors/high contrast.
- remote update دو browser با focus active.
- offline/reconnect/conflict با AT.
- camera/push denied.
- revoked share و removed member cache purge.

Automation به‌تنهایی PASS نیست.

## 23. Accessibility acceptance criteria

Release scope رد می‌شود اگر هرکدام برقرار باشد:

1. task اصلی فقط با pointer/swipe انجام شود.
2. focus گم، مخفی یا با remote update جابه‌جا شود.
3. destructive action نام/اثر مبهم داشته باشد.
4. sync status فقط رنگ یا animation باشد.
5. 360px overflow یا control overlap داشته باشد.
6. dialog focus trap/return یا accessible title نداشته باشد.
7. screen reader نام item/quantity/status/action را نتواند تشخیص دهد.
8. live region notification storm بسازد.
9. RTL icon/number/unit معنای اشتباه بدهد.
10. contrast یا forced-colors مسیر اصلی را غیرقابل استفاده کند.
11. zoom/reflow CTA یا error را پنهان کند.
12. expired/revoked/unauthorized state private content را flash کند.
13. push/camera denial مسیر اصلی را مسدود کند.
14. advisor split view keyboard/nested-scroll trap داشته باشد.
15. PDF/print به‌عنوان accessible ادعا شود بدون tag/reading-order verification.

## 24. Traceability به flowها

| حوزه | Flowها | تست ویژه |
|---|---|---|
| عضویت حساس | A–E | form errors، dialog، re-auth، focus after removal |
| shopping سریع | F–O | 44px، one-handed، remote focus stability، state labels |
| offline/conflict | P–Q | live batching، compare headings، draft preservation |
| Meal Board | R–V | toggles/radio، serving text، diff old/new، stale confirm |
| external review | W–Z | landmarks، split reflow، scope labels، revoked no-flash |

## 25. مسئولیت و evidence

- UX/Frontend: semantic implementation، responsive/RTL و component states.
- Backend/Realtime: status قابل اتکا برای pending/ack/conflict/permission؛ بدون آن accessible copy جعلی می‌شود.
- QA: artifact شامل browser/AT/version، viewport، steps، result و screenshot/video در صورت مناسب.
- Product: تصمیم درباره role، managed profile، sensitive scope و copy بدون medical claim.
- Security/Privacy: token/cache/notification payload؛ accessibility نباید با پنهان‌کردن اطلاعات امنیت را تضعیف کند.

## نتیجهٔ عملی

`[قطعی]` قبل از ساخت componentهای household، یک harness مشترک برای focus، live region، dialog، offline banner و bidi formatting آماده و روی Flow F/I/P/Q تست کنید. اگر این foundation دیر ساخته شود، اصلاح accessibility و RTL در 26 جریان چند برابر پرهزینه می‌شود.
