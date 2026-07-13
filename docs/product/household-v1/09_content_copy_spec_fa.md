# Persian content & copy specification — Household OS v1

**Locale:** `fa-IR` به‌صورت موقت؛ locale/واحد/currency تصمیم باز
**جهت:** RTL؛ placeholderها با `{name}` و در runtime escaped
**هدف لحن:** مستقیم، آرام، محترمانه و صادق دربارهٔ sync/permission؛ نه کودکانه، تهدیدآمیز یا پزشکی
**قاعدهٔ قطعی:** «ثبت شد/ارسال شد/تأیید شد» فقط پس از acknowledgment سرور.

**مرز فعال‌سازی:** وجود copy معادل enable شدن feature نیست. Household/shopping/in-app notification متن P0؛ attachment عکس و Meal Board متن P1؛ share/advisor متن P2/P3 و gated است.

## 1. واژه‌نامهٔ محصول

| مفهوم | عبارت اصلی | استفاده نکن |
|---|---|---|
| Household | خانوار | تیم، گروه چت، خانه (وقتی entity منظور است) |
| Household member | عضو خانوار | کاربر فرعی |
| Owner | مالک خانوار | ادمین کل |
| Adult membership role | بزرگسال | والد، مگر رابطه ثابت شده باشد |
| Member membership role | عضو | عضو فرعی |
| Guest shopper membership role | خریدار مهمان | خریدار دائمی |
| Managed-profile principal | نمایهٔ تحت مدیریت | عضو/حساب کودک |
| Plan viewer share principal | مشاهده‌گر برنامه | عضو خانوار |
| Plan reviewer share principal | بازبین برنامه | متخصص/پزشک مگر verify شده |
| Managed profile | نمایهٔ تحت مدیریت | حساب کودک |
| Meal Board | برنامهٔ غذای هفته | تقویم غذا وقتی decision board منظور است |
| Meal proposal | پیشنهاد غذا | رأی‌گیری |
| Attendance | حضور در وعده | شرکت‌کننده |
| Serving | پرس | نفر، اگر guest/portion متفاوت است |
| Shopping list | لیست خرید | سبد سفارش |
| Shopping Session | جلسهٔ خرید | ردیابی خرید |
| Shopper | خریدار | مأمور خرید |
| Out of stock | ناموجود | شکست خورد |
| Substitute | جایگزین | مشابه قطعی |
| Decision request | درخواست تصمیم | پیام |
| External share | لینک اشتراک | لینک عمومی |
| Advisor UX label | بازبین برنامه | membership role یا متخصص/پزشک، مگر verify شده |
| Sync pending | در انتظار ارسال | ذخیره شد |
| Server acknowledged | ثبت شد | احتمالاً ثبت شد |
| Conflict | تغییر هم‌زمان | خطای همگام‌سازی مبهم |
| Archive | بایگانی | حذف |
| Revoke | قطع دسترسی | پاک‌کردن لینک |

## 2. قواعد نگارشی و dynamic content

- عنوان‌ها کوتاه و sentence case فارسی؛ نقطه در button و heading نیاید.
- CTA با فعل روشن: `ساخت لینک`، `مرور تغییرها`، `قطع دسترسی`؛ از `باشه` و `تأیید` بدون object پرهیز.
- ارقام برای متن UI با formatter locale؛ raw ID/version می‌تواند لاتین و LTR-isolated باشد.
- نام شخص/غذا/قلم با `dir="auto"` و Unicode isolation render شود؛ هیچ HTML از placeholder پذیرفته نشود.
- تاریخ نسبی فقط همراه tooltip/accessible full date؛ `همین الان` برای event تأییدشده.
- جمع با formatter: `{count} قلم`؛ string concatenation دستی ممنوع.
- quantity نامعلوم: `مقدار مشخص نشده`؛ null هرگز `۰` نیست.
- هویت نامعلوم/حذف‌شده: `عضو پیشین`، نه email خام.
- copy حساس در lock screen نام meal، item، allergy، member یا advisor را پیش‌فرض نمی‌آورد.

## 3. Shell و navigation

| Key | متن |
|---|---|
| `nav.home` | خانه |
| `nav.plan` | برنامه |
| `nav.shopping` | خرید |
| `nav.notifications` | اعلان‌ها |
| `nav.more` | بیشتر |
| `nav.members` | اعضای خانوار |
| `nav.shares` | لینک‌های اشتراک |
| `household.switch.label` | انتخاب خانوار |
| `household.context.current` | خانوار فعال: {householdName} |
| `action.back` | بازگشت |
| `action.close` | بستن |
| `action.cancel` | انصراف |
| `action.retry` | تلاش دوباره |
| `action.save` | ذخیره |
| `action.review` | مرور |
| `action.undo` | برگردان |
| `action.continue` | ادامه |

## 4. Household flows A–E

### A — Create

| Key | متن |
|---|---|
| `household.create.title` | ساخت خانوار |
| `household.create.body` | برنامه و خرید شما فقط در اختیار اعضایی است که دعوت می‌کنید. |
| `household.create.name.label` | نام خانوار |
| `household.create.name.placeholder` | مثلاً خانهٔ ما |
| `household.create.submit` | ساخت خانوار |
| `household.create.pending` | در حال ساخت… |
| `household.create.success` | خانوار ساخته شد |
| `household.create.limit` | در حال حاضر نمی‌توانید خانوار دیگری بسازید. |
| `household.create.next.title` | اولین کار مشترک را شروع کنید |
| `household.create.next.invite` | دعوت یک عضو |
| `household.create.next.item` | افزودن اولین قلم |
| `household.create.next.plan` | برنامه‌ریزی هفته |

Validation:

- خالی: `نام خانوار را وارد کنید.`
- بیش از limit: `نام خانوار باید حداکثر {max} نویسه باشد.`
- فقط فاصله/کنترل: `یک نام قابل نمایش وارد کنید.`

### B/C — Invite and accept

| Key | متن |
|---|---|
| `invite.create.title` | دعوت عضو |
| `invite.role.label` | دسترسی عضو |
| `invite.expiry.label` | اعتبار لینک |
| `invite.preview.title` | گیرنده چه دسترسی‌ای دارد؟ |
| `invite.create.submit` | ساخت دعوت محدود |
| `invite.create.pending` | در حال ساخت لینک… |
| `invite.copy` | کپی دعوت |
| `invite.copy.done` | لینک کپی شد |
| `invite.revoke` | باطل‌کردن دعوت |
| `invite.existing.title` | یک دعوت فعال وجود دارد |
| `invite.existing.body` | می‌توانید همان لینک را دوباره بفرستید یا آن را باطل و لینک تازه‌ای بسازید. |
| `invite.accept.title` | دعوت به {householdName} |
| `invite.accept.by` | دعوت از طرف {inviterName} |
| `invite.accept.scope` | با پیوستن، این دسترسی‌ها را خواهید داشت: |
| `invite.accept.account` | با حساب {accountLabel} وارد می‌شوید. |
| `invite.accept.submit` | پیوستن به خانوار |
| `invite.decline` | رد دعوت |
| `invite.accept.pending` | در حال پیوستن… |
| `invite.accept.success` | به {householdName} پیوستید |
| `invite.decline.success` | دعوت رد شد |
| `invite.expired.title` | این دعوت دیگر معتبر نیست |
| `invite.expired.body` | اعتبار لینک تمام شده یا دعوت باطل شده است. |
| `invite.used.title` | این دعوت قبلاً استفاده شده است |
| `invite.alreadyMember` | این خانوار قبلاً به حساب شما اضافه شده است. |
| `invite.requestFresh` | درخواست لینک تازه |

### D/E — Remove, leave, transfer

| Key | متن |
|---|---|
| `member.remove.title` | حذف {memberName} از خانوار؟ |
| `member.remove.body` | دسترسی این عضو به برنامه، خرید و به‌روزرسانی‌های خانوار فوراً قطع می‌شود. |
| `member.remove.activeSession` | این عضو در یک جلسهٔ خرید فعال است. با حذف او، تغییرهای ارسال‌نشده‌اش پذیرفته نمی‌شود. |
| `member.remove.submit` | حذف {memberName} |
| `member.remove.success` | دسترسی {memberName} قطع شد |
| `member.leave.title` | خروج از {householdName}؟ |
| `member.leave.body` | دیگر به برنامه و خرید این خانوار دسترسی نخواهید داشت. تغییرهای ارسال‌نشدهٔ این خانوار هم ارسال نمی‌شود. |
| `member.leave.submit` | خروج از خانوار |
| `member.leave.ownerBlocked` | پیش از خروج، مالکیت را به یک عضو واجد شرایط منتقل کنید. |
| `owner.transfer.title` | انتقال مالکیت |
| `owner.transfer.target` | مالک جدید |
| `owner.transfer.body` | پس از انتقال، {memberName} مدیریت اعضا و تنظیمات اصلی خانوار را در اختیار دارد. |
| `owner.transfer.reauth` | برای ادامه دوباره هویت خود را تأیید کنید. |
| `owner.transfer.submit` | انتقال مالکیت به {memberName} |
| `owner.transfer.pending` | در حال بررسی نتیجه… |
| `owner.transfer.success` | مالکیت به {memberName} منتقل شد |
| `owner.transfer.targetInvalid` | این عضو دیگر برای دریافت مالکیت در دسترس نیست. فهرست اعضا را تازه کنید. |

## 5. Shopping flows F–Q

### List/session

| Key | متن |
|---|---|
| `shopping.title` | خرید |
| `shopping.progress` | {done} از {total} قلم گرفته شد |
| `shopping.empty.title` | هنوز چیزی برای خرید نیست |
| `shopping.empty.body` | یک قلم اضافه کنید یا لیست را از برنامهٔ هفته بسازید. |
| `shopping.add` | افزودن قلم |
| `shopping.fromPlan` | ساخت از برنامه |
| `shopping.filter.all` | همه |
| `shopping.filter.remaining` | مانده |
| `shopping.filter.bought` | گرفته‌شده |
| `shopping.item.new` | تازه |
| `shopping.item.source.meal` | لازم برای {mealName} |
| `shopping.item.source.manual` | افزوده‌شده توسط {memberName} |
| `shopping.item.assignee` | مسئول: {memberName} |
| `shopping.item.assign` | تعیین مسئول |
| `shopping.item.unassign` | برداشتن مسئول |
| `shopping.item.assignmentNotice` | مسئول این قلم با خریدار فعلی یکسان نیست. |
| `shopping.item.quantityUnknown` | مقدار مشخص نشده |
| `shopping.item.added.success` | {itemName} به لیست اضافه شد |
| `shopping.item.pending.local` | روی این دستگاه ذخیره شده |
| `shopping.item.pending.sending` | در حال ارسال |
| `shopping.item.acked` | ثبت شد |
| `shopping.session.start` | شروع خرید |
| `shopping.session.start.title` | جلسهٔ خرید را شروع کنید؟ |
| `shopping.session.start.body` | اعضا می‌بینند خرید در حال انجام است. موقعیت مکانی شما ثبت نمی‌شود. |
| `shopping.session.join` | پیوستن به جلسهٔ خرید |
| `shopping.session.active` | خرید در حال انجام است |
| `shopping.session.by` | {shopperName} از {startTime} در حال خرید است |
| `shopping.session.end` | پایان خرید |
| `shopping.session.ended` | این جلسهٔ خرید پایان یافته است |
| `shopping.session.summary` | {bought} قلم گرفته شد؛ {unresolved} تصمیم هنوز باز است. |

### Bought/unavailable/substitution

| Key | متن |
|---|---|
| `shopping.item.markBought` | گرفته شد |
| `shopping.item.bought` | گرفته‌شده |
| `shopping.item.bought.pending` | در حال ثبت خرید… |
| `shopping.item.bought.success` | {itemName} گرفته شد |
| `shopping.item.unavailable` | ناموجود است |
| `shopping.unavailable.title` | برای {itemName} چه کار کنیم؟ |
| `shopping.unavailable.choose` | جایگزین انتخاب می‌کنم |
| `shopping.unavailable.ask` | از خانواده می‌پرسم |
| `shopping.unavailable.skip` | این قلم را نمی‌خرم |
| `shopping.unavailable.linkedWarning` | این قلم برای {mealName} لازم است. حذف آن ممکن است برنامه را تغییر دهد. |
| `shopping.substitution.noSubstitution` | برای این قلم، جایگزین مجاز نیست. |
| `shopping.substitution.shopperMayChoose` | خریدار می‌تواند جایگزین مناسب انتخاب کند. |
| `shopping.decision.title` | درخواست تصمیم |
| `shopping.decision.context.label` | چه چیزی مهم است؟ |
| `shopping.decision.context.placeholder` | مثلاً بدون شکر یا حداکثر {price} |
| `shopping.decision.submit` | ارسال درخواست تصمیم |
| `shopping.decision.pending` | منتظر پاسخ خانوار |
| `shopping.decision.sent` | درخواست تصمیم ثبت شد |
| `shopping.decision.cancel` | لغو درخواست |
| `shopping.option.add` | افزودن گزینه |
| `shopping.option.name` | نام جایگزین |
| `shopping.option.price` | قیمت، اختیاری |
| `shopping.option.photo` | افزودن عکس، اختیاری |
| `shopping.option.upload.local` | عکس هنوز ارسال نشده است |
| `shopping.option.upload.progress` | در حال بارگذاری عکس… |
| `shopping.option.upload.failed` | عکس بارگذاری نشد. متن گزینه حفظ شده است. |
| `shopping.option.replacePhoto` | تعویض عکس |
| `shopping.option.removePhoto` | حذف عکس |
| `shopping.decision.approve` | همین را بخر |
| `shopping.decision.rejectAll` | هیچ‌کدام را نخر |
| `shopping.decision.approved` | {optionName} انتخاب شد |
| `shopping.decision.skipped` | تصمیم گرفته شد این قلم خریداری نشود |
| `shopping.decision.alreadyResolved` | این تصمیم قبلاً گرفته شده است |
| `shopping.decision.expired` | زمان این تصمیم گذشته است |
| `shopping.decision.lateAction` | پاسخ شما اعمال نشد؛ نتیجهٔ فعلی را ببینید. |

### Quantity, undo, offline, conflict

| Key | متن |
|---|---|
| `shopping.quantity.edit` | ویرایش مقدار |
| `shopping.quantity.amount` | مقدار |
| `shopping.quantity.unit` | واحد |
| `shopping.quantity.inCartWarning` | این قلم در حال خرید است. خریدار مقدار تازه را می‌بیند. |
| `shopping.quantity.boughtWarning` | این قلم قبلاً گرفته شده است. تغییر مقدار را با خریدار بررسی کنید. |
| `shopping.undo.available` | تغییر ثبت شد |
| `shopping.undo.submit` | برگردان |
| `shopping.undo.unavailable` | این تغییر دیگر قابل برگرداندن نیست؛ مورد بعداً تغییر کرده است. |
| `sync.offline.banner` | آفلاین هستید — {count} تغییر روی این دستگاه مانده است |
| `sync.offline.none` | آفلاین هستید — آخرین دادهٔ ذخیره‌شده نمایش داده می‌شود |
| `sync.queue.view` | دیدن تغییرهای در انتظار |
| `sync.reconnecting` | اتصال برگشت؛ در حال همگام‌سازی {count} تغییر… |
| `sync.partial.title` | بعضی تغییرها ثبت نشد |
| `sync.partial.body` | {success} تغییر ثبت شد و {failed} تغییر نیاز به بررسی دارد. |
| `sync.partial.retry` | تلاش دوباره برای موارد ناموفق |
| `sync.resultUnknown.title` | نتیجه هنوز مشخص نیست |
| `sync.resultUnknown.body` | پیش از ارسال دوباره، نتیجه را از سرور بررسی می‌کنیم. |
| `conflict.title` | این مورد هم‌زمان تغییر کرده است |
| `conflict.body` | نسخهٔ شما حفظ شده است. یکی از گزینه‌های زیر را انتخاب کنید. |
| `conflict.local` | نسخهٔ شما |
| `conflict.server` | نسخهٔ فعلی خانوار |
| `conflict.useLocal` | ثبت نسخهٔ من |
| `conflict.useServer` | نگه‌داشتن نسخهٔ خانوار |
| `conflict.combine` | ترکیب دستی |
| `conflict.keepSeparate` | جدا بمانند |
| `conflict.merge` | ادغام قلم‌ها |
| `conflict.saveProposal` | ذخیره به‌عنوان پیشنهاد |

## 6. Meal Board flows R–V

| Key | متن |
|---|---|
| `mealBoard.title` | برنامهٔ غذای هفته |
| `mealBoard.stage.draft` | پیش‌نویس |
| `mealBoard.stage.suggestions` | در حال جمع‌کردن پیشنهادها |
| `mealBoard.stage.review` | آمادهٔ مرور |
| `mealBoard.stage.confirmed` | تأییدشده |
| `mealBoard.stage.shoppingGenerated` | لیست خرید آماده شده |
| `mealBoard.stage.cooking` | در حال اجرا |
| `mealBoard.stage.completed` | پایان‌یافته |
| `mealBoard.empty.title` | برای این هفته هنوز غذایی پیشنهاد نشده است |
| `mealBoard.empty.action` | پیشنهاد غذا |
| `meal.proposal.title` | پیشنهاد غذا |
| `meal.proposal.reason.label` | دلیل یا توضیح، اختیاری |
| `meal.proposal.submit` | ثبت پیشنهاد |
| `meal.proposal.success` | پیشنهاد ثبت شد |
| `meal.proposal.slotOccupied` | این وعده یک انتخاب فعلی دارد؛ پیشنهاد شما جایگزین مستقیم آن نمی‌شود. |
| `meal.reaction.want` | می‌خواهم |
| `meal.reaction.okay` | بد نیست |
| `meal.reaction.notThisWeek` | این هفته نه |
| `meal.attendance.title` | چه کسانی این وعده هستند؟ |
| `meal.attendance.eating` | می‌خورد |
| `meal.attendance.absent` | نیست |
| `meal.attendance.unknown` | نامشخص |
| `meal.attendance.actingFor` | از طرف {profileName} |
| `meal.guests.label` | تعداد مهمان‌ها |
| `meal.servings.suggested` | پیشنهاد: {count} پرس |
| `meal.servings.explanation` | بر اساس {eating} عضو و {guests} مهمان |
| `meal.servings.reviewUnit` | این مقدار خودکار تبدیل نشد و نیاز به بررسی دارد. |
| `plan.confirm.review` | مرور و تأیید هفته |
| `plan.confirm.unknownAttendance` | حضور {count} نفر هنوز مشخص نیست. |
| `plan.confirm.submit` | تأیید این نسخه |
| `plan.confirm.pending` | در حال تأیید نسخه… |
| `plan.confirm.success` | برنامهٔ این هفته تأیید شد |
| `plan.confirm.stale` | برنامه از زمان بازکردن این صفحه تغییر کرده است. نسخهٔ تازه را مرور کنید. |
| `plan.version.label` | نسخهٔ {version} |
| `plan.diff.title` | اثر تغییر برنامه بر خرید |
| `plan.diff.added` | افزوده می‌شود |
| `plan.diff.removed` | حذف می‌شود |
| `plan.diff.changed` | مقدار تغییر می‌کند |
| `plan.diff.review` | نیازمند بررسی |
| `plan.diff.protected.manual` | این قلم دستی است و خودکار حذف نمی‌شود. |
| `plan.diff.protected.bought` | این قلم قبلاً گرفته شده و خودکار تغییر نمی‌کند. |
| `plan.diff.protected.session` | این قلم در جلسهٔ خرید فعال است و نیاز به بررسی دارد. |
| `plan.diff.applyBoth` | به‌روزرسانی برنامه و خرید |
| `plan.diff.planOnly` | فقط به‌روزرسانی برنامه |
| `plan.diff.saveProposal` | ذخیره به‌عنوان پیشنهاد |
| `plan.diff.applyPending` | در حال اعمال تغییرها… |
| `plan.diff.partial` | برنامه ثبت شد، اما {count} تغییر خرید نیاز به تلاش دوباره دارد. |

## 7. Sharing/advisor flows W–Z

| Key | متن |
|---|---|
| `share.title` | اشتراک برنامه |
| `share.mode.label` | نوع دسترسی |
| `share.mode.view` | فقط مشاهده |
| `share.mode.review` | مشاهده و پیشنهاد تغییر |
| `share.range.label` | بازهٔ برنامه |
| `share.scope.label` | چه چیزهایی دیده شود؟ |
| `share.scope.sensitive.title` | اطلاعات حساس |
| `share.scope.sensitive.body` | این موارد به‌صورت پیش‌فرض پنهان‌اند. فقط در صورت نیاز روشنشان کنید. |
| `share.scope.allergy` | اطلاعات حساسیت غذایی |
| `share.scope.preferences` | ترجیحات شخصی |
| `share.scope.notes` | یادداشت‌ها |
| `share.preview` | پیش‌نمایش برای گیرنده |
| `share.expiry.label` | پایان اعتبار لینک |
| `share.create` | ساخت لینک |
| `share.create.pending` | در حال ساخت لینک… |
| `share.create.success` | لینک ساخته شد |
| `share.manage` | مدیریت دسترسی |
| `share.view.notice` | این نسخه فقط برای مشاهده به اشتراک گذاشته شده است. |
| `share.review.notice` | می‌توانید روی بخش‌های برنامه نظر یا پیشنهاد تغییر ثبت کنید. |
| `share.expired.title` | اعتبار این لینک تمام شده است |
| `share.revoked.title` | دسترسی به این برنامه پایان یافته است |
| `share.unavailable.body` | برای حفظ حریم خصوصی، جزئیات بیشتری نمایش داده نمی‌شود. |
| `advisor.label` | بازبین |
| `advisor.disclaimer` | «بازبین» در گارنیش به معنی تأیید صلاحیت پزشکی یا حرفه‌ای نیست. |
| `advisor.comment.add` | افزودن نظر |
| `advisor.comment.label` | نظر دربارهٔ {contextName} |
| `advisor.comment.submit` | ثبت نظر |
| `advisor.comment.success` | نظر ثبت شد |
| `advisor.proposal.add` | پیشنهاد تغییر |
| `advisor.proposal.reason` | دلیل پیشنهاد |
| `advisor.proposal.submit` | ارسال پیشنهاد |
| `advisor.proposal.accept` | پذیرفتن و مرور اثر |
| `advisor.proposal.reject` | رد پیشنهاد |
| `advisor.proposal.stale` | این پیشنهاد بر اساس نسخهٔ قدیمی است. پیش از پذیرش، تفاوت‌ها را مرور کنید. |
| `share.revoke.title` | دسترسی این لینک قطع شود؟ |
| `share.revoke.body` | گیرنده دیگر نمی‌تواند برنامه را با این لینک باز کند. این کار قابل برگرداندن نیست. |
| `share.revoke.submit` | قطع دسترسی |
| `share.revoke.success` | دسترسی لینک قطع شد |
| `share.scopeChange.rotate` | با تغییر دسترسی، لینک قبلی از کار می‌افتد و لینک تازه ساخته می‌شود. |

## 8. Required states

| Key | عنوان | بدنه | CTA |
|---|---|---|---|
| `state.loading` | در حال دریافت اطلاعات | — | — |
| `state.empty` | هنوز چیزی اینجا نیست | اولین مورد را اضافه کنید. | افزودن |
| `state.error` | این بخش بارگیری نشد | اطلاعات واردشدهٔ شما حفظ شده است. | تلاش دوباره |
| `state.offline` | آفلاین هستید | آخرین اطلاعات ذخیره‌شده نمایش داده می‌شود. | دیدن تغییرهای در انتظار |
| `state.reconnecting` | اتصال برگشت | در حال بررسی تغییرهای در انتظار… | — |
| `state.conflict` | تغییر هم‌زمان پیدا شد | نسخهٔ شما حفظ شده است؛ تفاوت‌ها را مرور کنید. | مرور تفاوت‌ها |
| `state.unauthorized` | به این بخش دسترسی ندارید | ممکن است دسترسی شما تغییر کرده باشد. | بازگشت |
| `state.expiredInvite` | این دعوت دیگر معتبر نیست | اعتبار لینک تمام شده یا دعوت باطل شده است. | بازگشت به خانه |
| `state.revokedShare` | دسترسی به این برنامه پایان یافته است | برای حفظ حریم خصوصی، جزئیات بیشتری نمایش داده نمی‌شود. | بستن |
| `state.deletedMember` | عضویت شما پایان یافته است | داده‌های این خانوار دیگر روی این حساب نمایش داده نمی‌شود. | بازگشت به خانه |
| `state.archivedHousehold` | این خانوار بایگانی شده است | برنامه و خرید فقط برای مشاهده در دسترس‌اند. | بازگشت |
| `state.notificationDenied` | اعلان دستگاه خاموش است | تصمیم‌ها همچنان داخل گارنیش نمایش داده می‌شوند. | ادامه بدون اعلان |
| `state.partialSync` | بعضی تغییرها ثبت نشد | موارد ناموفق را جداگانه بررسی کنید. | مرور موارد |
| `state.stale` | نسخهٔ تازه‌تری وجود دارد | پیش از ادامه، تغییرهای جدید را مرور کنید. | دریافت نسخهٔ تازه |

## 9. Notification copy

### Lock screen — پیش‌فرض خصوصی

| Event | عنوان | بدنه | Action |
|---|---|---|---|
| invite | دعوت تازه در گارنیش | برای دیدن جزئیات، گارنیش را باز کنید. | دیدن دعوت |
| item during session | لیست خرید به‌روزرسانی شد | یک مورد نیاز به توجه شما دارد. | دیدن خرید |
| unavailable | یک تصمیم خرید منتظر شماست | برای دیدن گزینه‌ها، گارنیش را باز کنید. | دیدن گزینه‌ها |
| plan review | برنامهٔ هفته آمادهٔ مرور است | جزئیات پس از بازکردن گارنیش نمایش داده می‌شود. | مرور برنامه |
| advisor | یک نظر روی برنامه ثبت شد | برای دیدن جزئیات، گارنیش را باز کنید. | دیدن نظر |
| share revoked | دسترسی یک لینک پایان یافت | جزئیات در گارنیش در دسترس است. | مدیریت لینک‌ها |

### In-app — context مجاز

| Key | متن |
|---|---|
| `notification.itemAdded` | {memberName}، {itemName} را هنگام خرید به لیست اضافه کرد. |
| `notification.unavailable` | {itemName} ناموجود است. از میان {count} گزینه انتخاب کنید. |
| `notification.decisionResolved` | برای {itemName} تصمیم گرفته شد: {outcome}. |
| `notification.mealProposed` | {memberName}، {mealName} را برای {slotLabel} پیشنهاد داد. |
| `notification.planReview` | برنامهٔ {rangeLabel} آمادهٔ مرور است. |
| `notification.planConfirmed` | {memberName} برنامهٔ {rangeLabel} را تأیید کرد. |
| `notification.advisorComment` | یک نظر روی {mealName} ثبت شد. |
| `notification.groupedItems` | {count} قلم هنگام خرید به لیست اضافه شد. |
| `notification.expiredAction` | زمان این اقدام گذشته است؛ نتیجهٔ فعلی را ببینید. |

Bad copy — ممنوع:

- `لیست تغییر کرد.` — action/context ندارد.
- `فوری! همین الان جواب بده!` — urgency ساختگی.
- `انتخاب سالم‌تر` — ادعای health بدون evidence.
- `هوش مصنوعی این را برای خانواده‌ات انتخاب کرد` — fake AI/قطعیت.
- `همه می‌خواهند این غذا را` — اگر aggregate/attendance اثبات نشده.

## 10. Permission, privacy and security copy

| Key | متن |
|---|---|
| `permission.camera.rationale` | برای فرستادن عکس جایگزین، اجازهٔ دوربین لازم است. می‌توانید بدون عکس ادامه دهید. |
| `permission.camera.denied` | دسترسی دوربین خاموش است. از فایل‌ها انتخاب کنید یا بدون عکس ادامه دهید. |
| `permission.push.rationale` | اگر کالایی ناموجود باشد، می‌توانیم درخواست تصمیم را روی این دستگاه نشان دهیم. |
| `permission.push.denied` | اعلان دستگاه خاموش ماند. درخواست‌ها همچنان داخل گارنیش دیده می‌شوند. |
| `privacy.location.none` | گارنیش موقعیت مکانی شما را در جلسهٔ خرید ثبت نمی‌کند. |
| `privacy.share.sensitive` | این اطلاعات ممکن است شخصی یا مرتبط با سلامت باشد. فقط با فرد مورد اعتماد به اشتراک بگذارید. |
| `privacy.managedProfile` | این نمایه عضو یا حساب مستقل نیست. تغییرها از طرف مالک یا بزرگسال مدیر نمایه ثبت می‌شود. |
| `security.reauth` | برای این تغییر حساس، دوباره هویت خود را تأیید کنید. |
| `security.sessionChanged` | برای حفظ امنیت، این صفحه باید دوباره بارگیری شود. نوشتهٔ شما روی این دستگاه حفظ شده است. |

## 11. Error taxonomy and copy contract

UI نباید raw server message را نمایش دهد. API error code به copy key نگاشت شود:

| Code family | عنوان | بدنه/action |
|---|---|---|
| `NETWORK_UNAVAILABLE` | اتصال برقرار نیست | تغییرهای مجاز روی دستگاه می‌ماند؛ `تلاش دوباره` |
| `REQUEST_TIMEOUT` | نتیجه هنوز مشخص نیست | `بررسی نتیجه`؛ هرگز submit تازه |
| `VALIDATION_*` | اطلاعات را بررسی کنید | پیام دقیق کنار field |
| `CAPABILITY_DENIED` | اجازهٔ این کار را ندارید | `بازگشت`؛ resource detail اضافی نه |
| `MEMBERSHIP_ENDED` | عضویت شما پایان یافته است | cache purge + `بازگشت به خانه` |
| `VERSION_CONFLICT` | این مورد هم‌زمان تغییر کرده است | `مرور تفاوت‌ها` |
| `DECISION_RESOLVED` | این تصمیم قبلاً گرفته شده است | `دیدن نتیجه` |
| `TOKEN_EXPIRED_OR_REVOKED` | این لینک دیگر معتبر نیست | safe exit؛ دلیل جزئی افشاگر نه |
| `RATE_LIMITED` | درخواست‌های زیادی فرستاده شد | اگر server زمان داد: `پس از {time} دوباره تلاش کنید.` |
| `UPLOAD_REJECTED` | این فایل پذیرفته نشد | نوع/اندازهٔ مجاز + `انتخاب فایل دیگر` |
| `PARTIAL_APPLY` | بعضی تغییرها ثبت نشد | شمار و item results + retry failures |
| `SERVICE_DISABLED` | این قابلیت موقتاً در دسترس نیست | degraded path مشخص؛ «بعداً» بدون زمان قطعی |

## 12. Accessibility copy requirements

- icon-only button accessible label object-specific: `ویرایش مقدار برنج`، `حذف شیر از لیست`.
- row checkbox name: `{itemName}، {quantityLabel}، {statusLabel}`؛ تغییر state با announcement کوتاه.
- live region batch: `{count} تغییر تازه از اعضای خانوار دریافت شد.`؛ هر event جدا announce نشود.
- form error summary: `فرم ارسال نشد. {count} مورد را بررسی کنید.`
- destructive dialog title به‌تنهایی اثر را بیان کند.
- link text مستقل: `دیدن نتیجهٔ تصمیم`، نه `اینجا`.
- hidden helper copy برای bidi input: `نام و عدد ممکن است با جهت‌های متفاوت نمایش داده شوند.` فقط در صورت نیاز واقعی.

## 13. Copy QA checklist

- [ ] هیچ success پیش از ack نیست.
- [ ] offline/pending/partial/conflict واژهٔ مستقل دارند.
- [ ] هیچ push پیش‌فرض نام item/meal/member/sensitive field ندارد.
- [ ] هیچ ادعای medical، professional verification، AI یا delivery-read جعلی نیست.
- [ ] CTA object و اثر دارد؛ `بله/خیر/تأیید` مبهم نیست.
- [ ] removed/expired/revoked state existence یا identity اضافی افشا نمی‌کند.
- [ ] placeholderها escaped و bidi-isolated هستند.
- [ ] اعداد، جمع، زمان، تاریخ، مقدار و واحد formatter دارند.
- [ ] managed profile «حساب کودک» نامیده نمی‌شود.
- [ ] متن در 320/360 و 200% zoom بدون حذف اطلاعات حیاتی تست می‌شود.

## نتیجهٔ عملی

`[قطعی]` این keyها باید به catalog ترجمه متصل شوند و screenshot/interaction tests روی pending، partial، conflict و lock-screen privacy نوشته شود. اگر backend نتواند ack، error code و delivery state را تفکیک کند، copy دقیق قابل پیاده‌سازی نیست و feature Ready محسوب نمی‌شود.
