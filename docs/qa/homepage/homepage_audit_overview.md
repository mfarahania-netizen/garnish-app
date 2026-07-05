# Homepage / Main App Shell UX Audit Overview

## Reality Check
[قطعی] صفحهٔ خانه الان «مرکز فرماندهی غذا» را هدف گرفته، اما هنوز به اندازهٔ کافی ساده و اقدام‌محور نیست. کاربر عادی باید در کمتر از ۵ ثانیه بفهمد: جستجو کنم، یک پیشنهاد را باز کنم، برنامه بچینم، یا از دستیار بپرسم. کد فعلی چند قابلیت واقعی دارد، اما ترتیب و وزن بصری باعث می‌شود home بیشتر شبیه ترکیبی از showcase فیچرها باشد تا یک مسیر تصمیم‌گیری سریع.

## Scope
- بررسی فقط بر اساس کد فعلی frontend/backend.
- هیچ کد، UI، دیتابیس، recipe data، migration یا commit انجام نشد.
- فایل‌های گزارش در `docs/qa/homepage/` ساخته شدند.

## Exact Component / File Map

| Area | File(s) | Notes |
|---|---|---|
| Route tree | `apps/web/src/App.jsx` | `/` داخل `RequireAuth` و `AppShell`؛ recipe detail خارج از auth shell، cook داخل shell |
| App shell | `apps/web/src/shell/AppShell.jsx` | max width 480، sticky top/bottom chrome |
| Header/top bar | `apps/web/src/shell/TopBar.jsx` | hamburger on tab routes, back on pushed routes, bell link |
| Bottom nav | `apps/web/src/shell/BottomNav.jsx`, `apps/web/src/shell/navConfig.js` | ۵ تب: خانه، برنامه، کشف، علاقه‌مندی‌ها، پروفایل |
| Hamburger drawer | `apps/web/src/shell/NavDrawer.jsx`, `navConfig.js` | profile/Food DNA/recipes/plan/shopping/assistant/settings/support |
| Homepage route | `apps/web/src/app/home/page.jsx` | greeting, Food DNA, gamification, AI whisper, chips, picks, rails |
| Home data hook | `apps/web/src/app/home/lib/useHomeData.js` | calls `/users/me`, `/recommendations`, `/profile`, `/gamification/me`, `/recipes` |
| Home copy helpers | `apps/web/src/app/home/lib/reasons.js`, `greeting.js` | localized reasons, time greeting |
| Search entry | `apps/web/src/components/ges/SearchField.jsx` | button-like search, navigates to `/discover` |
| Discovery/search | `apps/web/src/app/discover/page.jsx`, `useDiscovery.js`, `categories.js` | real search input and `GET /recipes/search` |
| Recipe card | `apps/web/src/components/ges/RecipeCard.jsx` | placeholder media, save, dismiss, meta, why chip |
| Recipe rail | `apps/web/src/components/ges/RecipeRail.jsx` | horizontal rail, compact cards |
| AI card | `apps/web/src/components/ges/AIWhisper.jsx` | one dismissible suggestion, navigates to recipe |
| Resume card | `apps/web/src/components/ges/ResumeCard.jsx` | wired component but `resume: null` in home data |
| Image placeholder | `apps/web/src/components/ges/PlatePlaceholder.jsx` | branded placeholder, no real photos |
| Empty/error/loading | `EmptyState.jsx`, `ErrorState.jsx`, `LoadingSkeleton.jsx`, `HomeLoading` in home page | skeleton and safe empty/error states |
| Favorites | `apps/web/src/hooks/useFavoritesQuery.js`, `apps/web/src/app/favorites/page.jsx` | real saved recipes |
| Meal plan | `apps/web/src/app/plan/page.jsx`, `apps/web/src/hooks/useMealPlannerQuery.js`, backend `meal-plans.controller.ts` | real plan/propose/swap/build flows |
| Shopping list | `apps/web/src/app/shopping-list/page.jsx`, `useShopping.js`, backend `shopping-list.controller.ts` | real list, from-plan, pantry |
| Notifications | `apps/web/src/app/notifications/*`, backend `notifications.controller.ts` | top bar bell exists |
| Assistant | `apps/web/src/app/assistant/page.jsx`, `useAssistant.js`, backend `ai.controller.ts` | chat, conversations, opener, safe tools |
| Recommendation backend | `apps/server/src/recommendation/recommendation.controller.ts`, pipeline services | `GET /recommendations`, `POST /recommendations/impression`; lab/debug admin-only or not implemented |
| Recipe backend | `apps/server/src/recipes/recipes.controller.ts`, `recipes.service.ts` | public list/search/detail, allergy gate, engagement ordering |

## Current Home Structure
1. SearchField button.
2. Greeting hero.
3. Error/empty branch when applicable.
4. Food DNA card.
5. Gamification strip.
6. AI whisper.
7. Meal type row.
8. Cuisine row.
9. “برای تو، امشب” vertical recommendation cards.
10. “بر اساس آشپزخونه‌ات” rail.
11. “محبوب‌ها” rail.
12. “تازه‌ها” rail.
13. Occasion card.
14. Resume card if available, but currently never available because `resume: null`.

## High-Level Diagnosis
[احتمالاً] مشکل اصلی home کمبود backend نیست؛ مشکل اصلی اولویت‌بندی UI و ادعای ضمنی personalization است. کد تلاش کرده همه چیز را نشان دهد: Food DNA، streak، AI، chips، recommendation، rails، occasion، resume. نتیجه: صفحه برای کاربر تازه یا گرسنه کمی پرحرف است و primary action ضعیف می‌شود.

## What Is Good
- Endpointهای home واقعی هستند و mock اصلی در runtime دیده نمی‌شود.
- Search به discovery واقعی وصل است.
- Recommendation impression/click/save telemetry وجود دارد.
- Favorite save state server-truth است.
- Allergy safety در backend برای recipes/search/detail/recommendations لحاظ شده.
- Tap targets عمدتاً 44px یا بیشتر هستند.
- RTL و فونت Vazirmatn در shell رعایت شده.
- Loading/error/empty states وجود دارند.

## What Is Weak
- Search روی home input واقعی نیست؛ فقط button است.
- `popular` در home در واقع همان اول catalog بعد از engagement sort است، نه necessarily “popular now”.
- `fresh` بر اساس `createdAt` است و ممکن است با هدف اخیر کاربر تضاد داشته باشد.
- `resume` UI دارد ولی data ندارد؛ نباید تا زمان persistence واقعی بالاتر بیاید.
- AI whisper فقط recipe open می‌کند، نه real assistant action.
- Occasion card نمونهٔ “به‌زودی” است؛ برای launch باید حذف یا به feature واقعی وصل شود.
- کارت‌ها بدون عکس واقعی در کل صفحه تکرار placeholder زیادی ایجاد می‌کنند.
- Meal/category chips home و discovery منطق متفاوت دارند: home route به `/recipes?meal/category` می‌زند، discovery search term می‌زند.

## Main Recommendation
[قطعی] برای لانچ، home را باید از “feature showcase” به “decision surface” تبدیل کرد:
1. Search / “چی بپزم؟” در بالا.
2. یک hero recommendation واضح.
3. Continue/Plan/Shopping preview فقط اگر data واقعی دارد.
4. Quick actions محدود.
5. دو rail کافی: “مناسب الان” و “محبوب/کوتاه”.
6. حذف cardهای نمایشی و sectionهای بدون data واقعی.

