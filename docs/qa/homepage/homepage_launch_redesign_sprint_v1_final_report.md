# Homepage Launch Redesign Sprint v1 — Final Fresh Master Run

## 1. Verdict
PASS

[قطعی] Homepage از showcase چندبخشی به launch homepage تصمیم‌محور تبدیل شد: greeting کوتاه، search action واقعی، یک hero recommendation/fallback، چهار quick action اصلی، حذف سطوح fake/immature، و nav هماهنگ‌تر با food OS loop.

## 2. origin/master Hash Used
- Remote primary branch: `origin/master`
- `origin/main`: not present
- Base hash: `195fd856ae79c7f1629445654bd96fefa5400a97`
- Short hash: `195fd856`

## 3. Worktree Path
- `C:\dev\garnish-homepage-launch-v1-final`

## 4. Branch Name
- `sprint/homepage-launch-redesign-v1-final`

## 5. Baseline Build Before Implementation
Commands:

```bash
pnpm ignored-builds
pnpm --dir apps/web build
pnpm --dir apps/server build
```

Results:
- `pnpm ignored-builds`: no blocking ignored build scripts after install; initial fresh-worktree call reported no `node_modules`.
- Web build: PASS
- Server build: PASS
- Server build ran Prisma prebuild:

```text
prisma generate --schema=prisma/schema.prisma
nest build
```

## 6. Files Changed
```text
apps/web/src/app/home/page.jsx
apps/web/src/app/home/lib/useHomeData.js
apps/web/src/app/home/home.smoke.test.jsx
apps/web/src/components/ges/SearchField.jsx
apps/web/src/components/ges/RecipeCard.jsx
apps/web/src/components/ges/RecipeCard.dismiss.test.jsx
apps/web/src/shell/navConfig.js
apps/web/src/shell/navConfig.launch.test.js
docs/qa/homepage/homepage_launch_redesign_sprint_v1_final_report.md
```

## 7. Files Explicitly Not Touched
```text
docs/qa/recipes/global_143_pre_apply_backup_v0_1.json
apps/server/**
apps/server/prisma/schema.prisma
apps/server/prisma/migrations/**
recipe data
ingredient data
import/seed scripts
AI/recommendation backend
package/dependency policy files
```

## 8. Before Home Order
1. SearchField
2. Greeting
3. Food DNA card
4. Gamification strip
5. AIWhisper
6. Meal type row
7. Cuisine row
8. “برای تو، امشب” recommendation list
9. Pantry-labelled rail: `بر اساس آشپزخونه‌ات`
10. Popular rail
11. Fresh rail
12. OccasionCard with soon toast
13. ResumeCard if `resume` exists

## 9. After Home Order
1. Short greeting
2. Honest search action: `چی می‌خوای بپزی؟ / جستجو در دستورها`
3. One hero: `پیشنهاد امروز` for real recommendations, `برای شروع` for catalog fallback
4. Quick actions: `کشف غذاها`, `برنامه`, `لیست خرید`, `از دستیار بپرس`
5. Meal/category browsing rows
6. More recommendation stack: `پیشنهادهای بیشتر`
7. One recipe rail: `محبوب‌ها`
8. Food DNA card demoted below primary decision surfaces
9. Gamification strip demoted below primary decision surfaces and still conditional

## 10. Removed / Hidden Surfaces
- Removed Home `AIWhisper`.
- Removed Home `OccasionCard`.
- Removed Home `به‌زودی` seasonal/occasion toast path.
- Removed Home pantry-labelled rail because it was not proven pantry-backed.
- Removed Home fresh rail because recency-window/product value was not established for launch.
- Removed fake resume surface from Home render path.

## 11. Search Behavior
- Home search is a button/action, not an editable fake input.
- Copy:
  - `چی می‌خوای بپزی؟`
  - `جستجو در دستورها`
- Route: `/discover`
- Accessible label: `چی می‌خوای بپزی؟ — جستجو در دستورها`
- Tap target: 50px min block size.

## 12. Hero Recommendation Source / Fallback
- Real recommendation path: first `/recommendations` item, labelled `پیشنهاد امروز`.
- Fallback path: first public `/recipes` catalog item, labelled `برای شروع`.
- Recommendation reason is shown only as a restrained real-signal hint when `reasons` exist.
- No pantry/body/medical/autonomous execution claims were added.

## 13. Rails Final Count / Names
- RecipeRail components on Home: 1
- Final rail name:
  - `محبوب‌ها`
- Additional vertical recommendation stack:
  - `پیشنهادهای بیشتر`

## 14. Plan / Shopping Preview
Deferred.

[قطعی] Existing Home-safe lightweight preview hooks were not proven. Adding fake counts or fake today meal would violate the sprint rules, so Home uses direct quick actions to `/plan` and `/shopping-list`.

## 15. Bottom Nav Before / After
Before:
```text
خانه / برنامه / کشف / علاقه‌مندی‌ها / پروفایل
```

After:
```text
خانه / کشف / برنامه / خرید / پروفایل
```

## 16. Drawer Changes
- Favorites moved to drawer as:
  - `ذخیره‌ها` → `/favorites`
- Assistant remains in drawer.
- Assistant also appears as Home quick action.
- No debug/lab/internal route was added.

## 17. AI Entry Safety
- Prominent `AIWhisper` removed from Home.
- AI entry is now a small quick action: `از دستیار بپرس` → `/assistant`.
- No forbidden medical, weight-loss, diabetes, blood-pressure, autonomous shopping, or fake body-knowledge copy is rendered on Home.

## 18. Accessibility Checklist
- Home search action has button semantics and clear `aria-label`.
- Quick actions are buttons with clear labels and >=44px targets.
- Hero has explicit CTA `دیدن دستور`.
- RecipeCard media opens recipe.
- RecipeCard title/meta opens recipe.
- Save and dismiss remain separate controls and do not navigate.
- Bottom nav uses real routes.

## 19. Performance Checklist / New Queries
- New frontend queries: no
- New backend queries: no
- New endpoints: no
- Server behavior change: no
- Migration/data mutation: no

## 20. Tests Run
Targeted tests:

```bash
pnpm --dir apps/web exec vitest run src/app/home/home.smoke.test.jsx src/components/ges/RecipeCard.dismiss.test.jsx src/shell/navConfig.launch.test.js
```

Result: PASS

```text
Test Files: 3 passed
Tests: 11 passed
```

Note: jsdom emitted non-fatal XHR noise during the targeted run, but the command exited successfully.

## 21. Web / Server Build After Implementation
```bash
pnpm --dir apps/web build
```

Result: PASS

```bash
pnpm --dir apps/server build
```

Result: PASS

Server build again ran Prisma prebuild successfully.

## 22. Remaining Risks
- Visual QA in a real browser is still recommended before merge because this sprint changed first-viewport IA and RecipeCard interaction density.
- Plan/shopping preview remains deferred until a real lightweight Home-safe data source is confirmed.
- The Home category rows still navigate to `/recipes?...`; this was preserved to avoid widening scope into Discover/routing behavior.

## 23. Hard PASS Checklist

| Criterion | Result |
|---|---|
| fresh clean worktree from origin/master used | PASS |
| baseline web/server build PASS before implementation | PASS |
| Home first viewport has clear search/action + hero path | PASS |
| no `به‌زودی` homepage card | PASS |
| no fake resume | PASS |
| no unsupported pantry/AI/personalization copy | PASS |
| max two recipe rails | PASS |
| RecipeCard full-card navigation works | PASS |
| save/dismiss do not navigate | PASS |
| bottom nav includes Shopping | PASS |
| Favorites reachable through drawer | PASS |
| AI small and safe | PASS |
| no recipe/ingredient data touched | PASS |
| no migration | PASS |
| no server behavior change | PASS |
| web build PASS after implementation | PASS |
| server build PASS after implementation | PASS |
| targeted tests PASS | PASS |
| report created | PASS |
