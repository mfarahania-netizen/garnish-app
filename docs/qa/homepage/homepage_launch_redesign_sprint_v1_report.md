# Homepage Launch Redesign Sprint v1 Report

## 1. Verdict
BLOCKED

[قطعی] Sprint طبق Hard Stop خود سند متوقف شد. دلیل توقف: `git status --short` تغییرات unrelated و پرریسک گسترده نشان داد؛ از جمله تغییرات در server recipe/search/AI، recipe detail، cook mode، food-dna، shopping، styles، package workspace و ده‌ها script/report untracked. در چنین وضعیتی ویرایش Home می‌تواند با تغییرات قبلی مخلوط شود و checkpoint قابل audit برای launch ندهد.

## 2. Branch / Commit Hash
- Branch: `fix/shopping-mealplan-overhaul`
- HEAD: `058a75df`

## 3. Scope
درخواست این sprint: launch-ready کردن Homepage / Main App Shell با تغییرات کوچک frontend/product، بدون لمس recipe data، ingredient data، migration، production، import pipeline یا backendهای AI/recommendation/meal-plan/shopping.

اقدام انجام‌شده در این اجرا:
- خواندن سند sprint.
- اجرای preflight اولیه.
- بررسی branch و git status.
- بررسی وجود audit files مبنا.
- استخراج package scripts.
- ساخت این گزارش BLOCKED.

اقدام انجام‌نشده به دلیل Hard Stop:
- هیچ کد frontend تغییر نکرد.
- هیچ test/build اجرا نشد.
- هیچ migration، import، recipe/ingredient update یا server route تغییر نکرد.

## 4. Files Changed
- `docs/qa/homepage/homepage_launch_redesign_sprint_v1_report.md`

## 5. Files Explicitly Not Touched
- `apps/web/src/app/home/page.jsx`
- `apps/web/src/app/home/lib/useHomeData.js`
- `apps/web/src/components/ges/SearchField.jsx`
- `apps/web/src/components/ges/RecipeCard.jsx`
- `apps/web/src/components/ges/RecipeRail.jsx`
- `apps/web/src/components/ges/AIWhisper.jsx`
- `apps/web/src/components/ges/PlatePlaceholder.jsx`
- `apps/web/src/shell/navConfig.js`
- `apps/web/src/shell/BottomNav.jsx`
- `apps/web/src/shell/NavDrawer.jsx`
- همه فایل‌های backend.
- همه migrationها.
- همه recipe/ingredient/import/seed فایل‌ها.
- production config/deploy.

## 6. Preflight Findings

### Audit Files
Audit files مبنا موجود بودند:
- `docs/qa/homepage/final_homepage_audit_report.md`
- `docs/qa/homepage/homepage_backend_capability_map.md`
- `docs/qa/homepage/homepage_final_recommendations.md`

### Git Status Blocker
`git status --short` شامل تغییرات unrelated گسترده بود. نمونه‌های مهم:
- modified server files:
  - `apps/server/src/ai/tools/suggest-substitutions.tool.ts`
  - `apps/server/src/recipes/recipes.controller.ts`
  - `apps/server/src/recipes/recipes.service.ts`
  - `apps/server/src/recipes/search/tfidf.ts`
- modified web files outside homepage shell:
  - `apps/web/src/app/cook/[id]/page.jsx`
  - `apps/web/src/app/food-dna/page.jsx`
  - `apps/web/src/app/recipe/[id]/page.jsx`
  - `apps/web/src/app/shopping-list/useShopping.js`
  - `apps/web/src/context/ThemeContext.jsx`
  - `apps/web/src/styles/tokens.css`
- many untracked recipe repair/authenticity/import scripts under `apps/server/scripts/recipes/`.
- many untracked recipe-detail, ingredient display, audit and recipe QA files.

[قطعی] این وضعیت طبق سند Sprint یک Hard Stop است: «قبل از هر تغییر، اگر git status نشان دهد تغییرات unrelated و پرریسک وجود دارد، STOP کن و فقط report بده.»

## 7. Before Home Order
از audit قبلی و map موجود:
1. SearchField
2. Greeting
3. error/empty branch
4. FoodDnaCard
5. GamificationStrip
6. AIWhisper
7. MealTypeRow
8. CuisineRow
9. recommendation cards
10. pantry-like rail
11. popular rail
12. fresh rail
13. OccasionCard
14. ResumeCard if available

## 8. After Home Order
Not changed because sprint is BLOCKED before code edit.

Target order برای اجرای بعدی:
1. short greeting
2. honest search action
3. one hero recommendation/action
4. quick actions: discover/plan/shopping/assistant
5. optional real plan/shopping preview only if lightweight and truthful
6. max two recipe rails
7. secondary profile/gamification surfaces lower and conditional

## 9. Removed / Hidden Surfaces
Not changed because sprint is BLOCKED.

Target removals for next clean run:
- OccasionCard / «به‌زودی»
- ResumeCard when `resume` is null
- Fresh rail if not product-critical
- fake pantry copy unless pantry-backed source is confirmed

## 10. Search Behavior
Not changed.

Current known issue from audit:
- Home SearchField looks like an input but acts as a navigation action to `/discover`.

Target behavior:
- Make home search visibly an action/link, not a fake editable input.
- Copy: «چی می‌خوای بپزی؟» / «جستجو در دستورها»
- Route: `/discover`
- Accessibility: button/link semantics with clear aria-label and >=44px tap target.

## 11. Hero Recommendation
Not changed.

Target behavior:
- One visually distinct hero.
- Source: `/recommendations` when real.
- Fallback: public recipe/catalog with non-personal copy.
- Reason shown only if real matched signal/source exists.
- Forbidden copy: unsupported AI/body/pantry/medical claims.

## 12. Rails
Not changed.

Current known issue:
- More than two recipe sections/rails can appear.
- Fresh rail and pantry-style copy are weak for launch.

Target:
- Max two rails.
- Honest names:
  - «پیشنهادهای بیشتر» / «برای تو» only when real recommendations exist.
  - «محبوب‌ها» when engagement/catalog source is used.
- No «ترند الان» unless recency-window backend exists.

## 13. Plan / Shopping
Not changed.

Decision for clean implementation:
- Add preview only if existing frontend hooks provide real, lightweight, non-blocking data.
- Otherwise defer and keep route-only quick actions.
- Do not fake counts or meals.

## 14. Bottom Nav
Not changed.

Current known nav from audit:
- خانه
- برنامه
- کشف
- علاقه‌مندی‌ها
- پروفایل

Target nav:
- خانه
- کشف
- برنامه
- خرید
- پروفایل

Favorites should move to drawer as «ذخیره‌ها».

## 15. AI Entry
Not changed.

Target:
- AI should be small/secondary.
- Route: `/assistant`
- Safe copy: «از دستیار بپرس»
- No bottom-nav AI.
- No floating intrusive AI.
- No medical/autonomous shopping claims.

## 16. Accessibility Checklist
Not executed due to BLOCKED.

Target checklist:
- No fake input semantics on home search.
- RecipeCard title/body/media keyboard-accessible navigation.
- Save/dismiss buttons stop propagation and have aria-label.
- Rails have clear title and usable focus path.
- Tap targets >=44px.
- 360px and 480px RTL layout verified.

## 17. Performance Checklist
Not executed due to BLOCKED.

Target:
- No new heavy query.
- No backend DTO/summary endpoint in this sprint.
- Plan/shopping preview only if conditional and non-blocking.
- Keep `/recipes?limit=60` cap unchanged unless there is measured need.

## 18. Tests Run
Not run.

Reason: Hard Stop before code edit/test. Running tests/builds on the dirty unrelated worktree would not validate the homepage sprint in isolation.

Available scripts discovered:
- root: `pnpm build`, `pnpm test`, `pnpm lint`
- web: `pnpm --dir apps/web build`, `pnpm --dir apps/web test`, `pnpm --dir apps/web lint`
- server: `pnpm --dir apps/server build`, `pnpm --dir apps/server test`, `pnpm --dir apps/server lint`

## 19. Builds Run
Not run.

Reason: same Hard Stop. Baseline build result would be contaminated by unrelated modified/untracked files.

## 20. Known Risks Left
- The homepage remains unchanged and still has the UX issues documented in prior audit.
- Dirty worktree can hide regressions or create false failures.
- If implementation proceeds without isolating this sprint, the final checkpoint will be hard to review, revert, or ship.

## 21. Final Hard PASS Checklist
- Home first viewport clear decision path: NOT CHECKED / NOT CHANGED
- No «به‌زودی» homepage card: NOT CHANGED
- Resume hidden unless real persisted data exists: NOT CHANGED
- No unsupported pantry/AI/personalization copy: NOT CHANGED
- Home max two recipe rails: NOT CHANGED
- RecipeCard title/body/media opens recipe: NOT CHANGED
- Save/dismiss do not open recipe: NOT CHANGED
- Bottom nav includes Shopping, not Favorites: NOT CHANGED
- Favorites reachable through drawer: NOT CHANGED
- AI small safe entry only: NOT CHANGED
- No recipe/ingredient data changed: PASS
- No migration created: PASS
- No server behavior changed: PASS
- Web build PASS: NOT RUN
- Server build PASS: NOT RUN
- Report created: PASS

## 22. Recommended Unblock Path
1. Create a clean branch/worktree from the intended base, or commit/stash the unrelated current work first.
2. Re-run this sprint in isolation.
3. Limit changes to the allowed frontend files and this report.
4. Run targeted web tests, web build and server build.

[قطعی] در وضعیت فعلی ادامه دادن با ویرایش Home تصمیم ضعیفی است، چون خروجی قابل اعتماد برای launch checkpoint تولید نمی‌کند.
