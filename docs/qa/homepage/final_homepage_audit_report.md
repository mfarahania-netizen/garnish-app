# Final Homepage / Main App Shell Audit Report

## 1. Executive Summary
[قطعی] صفحهٔ خانه و شل اصلی اپ از نظر اتصال پایه‌ای کار می‌کنند، اما هنوز «مرکز فرماندهی غذا» نیستند. مشکل اصلی نبود کامل backend نیست؛ مشکل اصلی این است که home هم‌زمان می‌خواهد جستجو، پیشنهاد، Food DNA، گیمیفیکیشن، AI، دسته‌بندی، ریل‌های رسپی، مناسبت و ادامهٔ پخت را نشان دهد. نتیجه این است که کاربر سریع‌ترین مسیر تصمیم را نمی‌بیند.

[احتمالاً] برای لانچ، ارزش تجاری صفحهٔ خانه وقتی بالا می‌رود که از showcase فیچرها تبدیل شود به یک سطح تصمیم‌گیری: «چی بپزم؟»، «امروز چه چیزی در برنامه دارم؟»، «چه چیزی لازم دارم بخرم؟»، «اگر گیر کردم از AI بپرسم.»

## 2. Current Homepage Diagnosis
- route اصلی `/` داخل `RequireAuth` و `AppShell` است.
- shell موبایلی با عرض ثابت حداکثر 480px و bottom navigation دارد.
- home از `useHomeData` داده می‌گیرد و هم‌زمان `/users/me`، `/recommendations`، `/profile`، `/gamification/me` و `/recipes` را مصرف می‌کند.
- ساختار فعلی home: search entry، greeting، Food DNA، gamification، AI whisper، meal chips، cuisine chips، recommendations، pantry rail، popular rail، fresh rail، occasion card، resume card.
- `resume` در hook همیشه `null` است؛ یعنی کامپوننت ادامهٔ پخت آماده است ولی دادهٔ واقعی ندارد.
- `SearchField` شبیه input است، اما input واقعی نیست و فقط کاربر را به `/discover` می‌برد.

## 3. What Is Good
- اتصال‌های اصلی واقعی هستند، mock اصلی در مسیر runtime دیده نشد.
- recipe list/search/detail، favorites، recommendations، gamification، profile، meal plan، shopping list، notifications و assistant backend دارند.
- allergy/safety gating در مسیرهای recipe و recommendation لحاظ شده است.
- home loading/error/empty state دارد.
- bottom navigation ساده و قابل فهم است.
- drawer مسیرهای مهم را پوشش می‌دهد.
- impression/click/save/dismiss telemetry برای پیشنهادها وجود دارد.

## 4. What Is Bad
- home بیش از حد شلوغ است و primary action را ضعیف می‌کند.
- search روی home رفتار صادقانه ندارد؛ ظاهرش input است ولی فقط navigation است.
- ریل «بر اساس آشپزخونه‌ات» از نظر کد الزاماً pantry-backed نیست و از slice پیشنهادها ساخته می‌شود.
- `fresh` بر اساس `createdAt` ساخته می‌شود و با هدف relevance/engagement تضاد دارد.
- occasion card با toast «به‌زودی» برای لانچ اعتمادسوز است.
- AI whisper در home اکشن AI واقعی انجام نمی‌دهد؛ بیشتر shortcut به recipe است.
- کارت‌های recipe به دلیل placeholder media زیاد، از نظر بصری تکراری و کم‌اعتماد می‌شوند.
- tap target باز کردن recipe بیشتر روی media/overlay متمرکز است؛ title/body باید واضح‌تر tappable باشد.
- notification bell badge unread ندارد.
- meal/category behavior بین home و discovery یکدست نیست.

## 5. What Is Missing
- home summary endpoint سبک برای جلوگیری از چند fetch جداگانه.
- real inline search یا حداقل copy واضح که این دکمه کاربر را به جستجو می‌برد.
- compact today plan preview.
- shopping list preview/count.
- true pantry-aware module یا تغییر copy تا overclaim نکند.
- persistent continue cooking قبل از نمایش ResumeCard.
- lightweight recipe-card API shape.
- unread notifications count در top bar.
- image/media pipeline واقعی برای کارت‌ها.

## 6. What Should Be Removed
- OccasionCard تا وقتی feature واقعی ندارد.
- ResumeCard تا وقتی state ادامهٔ پخت واقعاً persist نشده.
- Fresh rail از home، مگر با دلیل محصولی روشن.
- هر copy که می‌گوید پیشنهادها دقیقاً از آشپزخانه/AI/رفتار کاربر آمده‌اند وقتی source آن قطعی نیست.
- social/community یا health/medical claims؛ backend و ریسک محصولی برای لانچ آماده نیست.

## 7. Frontend-Only Improvements
- ترتیب home را تغییر بده: search، hero recommendation، today plan، shopping preview، سپس حداکثر دو rail.
- SearchField را یا input واقعی کن یا ظاهرش را از input به action button تغییر بده.
- RecipeCard را full-card tappable کن، با جلوگیری از تداخل save/dismiss.
- rail labels را دقیق‌تر کن: «پیشنهادهای امروز»، «محبوب‌ها»، «غذاهای مناسب شام» به جای ادعای pantry اگر pantry واقعی نیست.
- OccasionCard را حذف کن.
- Food DNA و gamification را پایین‌تر ببر یا شرطی‌تر نمایش بده.
- AI card را به یک entry کوچک و واضح تبدیل کن: «از دستیار بپرس».
- bottom nav را بازبینی کن: اگر shopping loop برای اپ مهم است، Shopping از Favorites مهم‌تر است.

## 8. Backend Work Needed
- `GET /home/summary` یا معادل BFF برای home.
- lightweight recipe card DTO بدون include سنگین ingredients/steps برای ریل‌ها.
- plan preview endpoint یا مصرف سبک از meal plan.
- shopping preview endpoint یا count.
- unread notification count.
- pantry-aware recommendation source اگر قرار است copy «آشپزخونه‌ات» بماند.
- continue-cooking persistence.
- recency-window برای «popular now»؛ engagement total فعلی برای «now» کافی نیست.

## 9. Best Homepage Structure Proposal
1. Top search/action: «چی می‌خوای بپزی؟»
2. One primary hero: بهترین پیشنهاد امروز با دلیل کوتاه و CTA باز کردن recipe.
3. Today plan compact card: وعدهٔ بعدی، add/swap shortcut.
4. Shopping compact card: تعداد آیتم‌های باقی‌مانده، build from plan اگر plan وجود دارد.
5. Assistant compact entry: فقط برای سؤال/گیر کردن، نه مرکز صفحه.
6. One or two rails max: «محبوب‌ها» و «برای تو».
7. Profile/Food DNA progress پایین‌تر و شرطی.

## 10. Best Bottom Navigation Proposal
[احتمالاً] برای Garnish به عنوان food OS، ترکیب قوی‌تر از وضعیت فعلی این است:
- خانه
- برنامه
- خرید
- کشف
- پروفایل

Favorites بهتر است داخل profile/drawer یا داخل recipe flows بماند، مگر analytics نشان دهد کاربران روزانه زیاد به favorites برمی‌گردند. ریسک این پیشنهاد این است که اگر کاربرهای فعلی favorites-heavy باشند، جابه‌جایی تب باعث اصطکاک کوتاه‌مدت می‌شود.

## 11. Best Hamburger / Drawer Proposal
- Primary: پروفایل غذایی، دستورها، برنامه غذایی، لیست خرید، دستیار، تنظیمات.
- Secondary: اعلان‌ها، پشتیبانی، بازبینی سلیقه/آن‌بوردینگ.
- حذف/تعویق: هر آیتم آزمایشگاهی، debug، recommendation lab، یا feature «به‌زودی».

## 12. Best Recipe Card Proposal
- کل کارت به جز دکمه‌های save/dismiss باید recipe را باز کند.
- یک reason کوتاه و واقعی نشان بده: «محبوب»، «مناسب شام»، «سازگار با حساسیت‌ها».
- زمان، سختی، نفرات و status ایمنی باید همیشه از یک mapper مشترک بیاید.
- placeholder فعلی برای نبود تصویر قابل قبول است، اما تعداد زیادش کیفیت ادراکی را پایین می‌آورد.
- کارت full و compact باید variant واقعی داشته باشند، نه فقط همان ساختار با عرض متفاوت.

## 13. Best AI Entry Proposal
[قطعی] AI نباید قبل از اثبات retention/cost به primary tab تبدیل شود. برای لانچ بهتر است AI یک entry کنترل‌شده باشد:
- یک کارت کوچک در home.
- یک آیتم drawer.
- quick actions در contextهای مرتبط مثل recipe، shopping و plan.
- copy ایمن: «می‌تونم پیشنهاد بدم» نه «تصمیم قطعی پزشکی/تغذیه‌ای می‌گیرم».

## 14. Accessibility Issues
- SearchField با ظاهر input ولی رفتار button از نظر affordance ضعیف است.
- horizontally scrolling rails باید keyboard/scroll affordance بهتری داشته باشند.
- hidden scrollbar می‌تواند کشف‌پذیری را کم کند.
- color-only states برای بعضی chips/cards باید با متن/آیکن پشتیبانی شود.
- notification bell بدون unread text/badge ارزش اطلاعاتی کمی دارد.

## 15. Performance Issues
- home چند request جداگانه دارد و `/recipes?limit=60` ممکن است DTO سنگین بدهد.
- recipe rails با کارت‌های متعدد و placeholder-heavy render می‌شوند.
- API بهتر است برای home یک payload سبک بدهد.
- sorting/filtering بخشی در client انجام می‌شود؛ برای scale بهتر است server-ranked sections داشته باشیم.

## 16. Roadmap

### P0
- P0 عملکردی قطعی برای homepage پیدا نشد.

### P1
- home search را صادقانه/واقعی کن.
- OccasionCard را حذف کن.
- ResumeCard را تا persistence واقعی پنهان نگه دار.
- pantry copy را اصلاح کن یا دادهٔ pantry واقعی وصل کن.
- home order را به decision-first تغییر بده.
- RecipeCard را full-card tappable کن.
- یکی از plan/shopping previewها را واقعی وارد home کن.

### P2
- unread notification badge.
- home summary endpoint.
- lightweight recipe card DTO.
- حذف یا rename ریل fresh.
- محدود کردن ریل‌ها به دو ریل.
- بهتر کردن empty/cold-start personalization.

### P3
- AI primary tab، فقط بعد از دادهٔ retention/cost.
- pantry-aware recommender واقعی.
- persistent continue cooking.
- media/photo pipeline.
- social/community.

## 17. Exact File / Component Map
- `apps/web/src/App.jsx`
- `apps/web/src/shell/AppShell.jsx`
- `apps/web/src/shell/TopBar.jsx`
- `apps/web/src/shell/BottomNav.jsx`
- `apps/web/src/shell/navConfig.js`
- `apps/web/src/shell/NavDrawer.jsx`
- `apps/web/src/app/home/page.jsx`
- `apps/web/src/app/home/lib/useHomeData.js`
- `apps/web/src/components/ges/SearchField.jsx`
- `apps/web/src/components/ges/RecipeCard.jsx`
- `apps/web/src/components/ges/RecipeRail.jsx`
- `apps/web/src/components/ges/AIWhisper.jsx`
- `apps/web/src/components/ges/ResumeCard.jsx`
- `apps/web/src/components/ges/PlatePlaceholder.jsx`
- `apps/web/src/app/discover/page.jsx`
- `apps/web/src/app/discover/lib/useDiscovery.js`
- `apps/server/src/recipes/recipes.controller.ts`
- `apps/server/src/recipes/recipes.service.ts`
- `apps/server/src/recommendation/recommendation.controller.ts`
- `apps/server/src/meal-plans/meal-plans.controller.ts`
- `apps/server/src/shopping-list/shopping-list.controller.ts`
- `apps/server/src/ai/ai.controller.ts`

## 18. Acceptance Criteria For Next Implementation Sprint
- کاربر در viewport اول بتواند search یا یک پیشنهاد اصلی را بفهمد و اجرا کند.
- هیچ کارت «به‌زودی» یا UI بدون data واقعی روی home نباشد.
- هیچ copyای درباره pantry/AI/personalization بدون source واقعی نمایش داده نشود.
- home با حداکثر دو rail recipe تمام شود.
- recipe card از title/body/media قابل باز شدن باشد.
- bottom nav با core loop اپ هم‌راستا باشد.
- build frontend/server بعد از تغییرات PASS شود.
- smoke test برای home authenticated/cold/error/non-empty اضافه یا به‌روز شود.

## Final Verdict
[قطعی] homepage فعلی برای استفاده پایه قابل اجراست، اما برای ادعای اپ غذایی حرفه‌ای بین‌المللی هنوز بیش از حد feature-heavy و کم‌تصمیم است. مسیر درست، اضافه کردن فیچر جدید نیست؛ اول باید home را به یک flow کوتاه، صادقانه و داده‌محور تبدیل کرد.
