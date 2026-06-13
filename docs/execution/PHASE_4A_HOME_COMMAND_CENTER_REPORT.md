# PHASE 4A — Home / Command Center Migration Report

**Date:** 2026-06-13 · **Scope:** GES Redesign Phase 4A (Home surface only) · **Branch:** `master`
· **Commit:** `bc996d1` · **Build:** green

> Strict scope per Founder: Home / Command Center surface only; recommendation rail (it is structurally
> part of Home); use existing GES primitives; add/keep loading/empty/error states; keep mobile-first + RTL.
> **Forbidden (confirmed not done):** AI-Chat / Admin / Recipe-Detail / Meal-Planner / Grocery migration;
> new features; strategy/design-language changes; new health/vision/agentic claims; fabricated recommendation Why.
> Method: parallel **understand** sweep → migration → **adversarial multi-lens review** (token-purity, RTL/a11y/states,
> feature-parity, scope, GES-API) with each finding independently verified → fixes → re-verify.

---

## 1. Files changed
| File | Change | Diff |
|------|--------|------|
| `apps/web/src/app/home/page.jsx` | Full GES token + primitive + motion migration of the Home surface | **151 insertions / 208 deletions** (net −57; only logic-preserving presentation changed) |

**Exactly one file changed.** No backend, no other surface, no shared component touched. Navigation remains route-string only (no direct import of any other surface's module).

## 2. Surfaces touched (all within Home)
Page header/brand · hero banner carousel · server-backed search (input + voice + results dropdown) · filter chips · "today's special" card · **personalized recommendation rail** · category grid · AI-assistant CTA card · recipe tabs (all/quick/popular) + view-all · scroll-to-top FAB · loading / error / empty states.

## 3. GES primitives used
`CardShell` (today-special, recs container, category tiles ×9) · `SectionHeader` (recs, categories) · `Button` (today-special CTA, 3 tabs, view-all) · `LoadingSkeleton` (loading state ×2: media + list) · `ErrorState` (error state, with retry) · `EmptyState` (empty recipe-tab state). **12 GES primitive usages.** Plus GES **tokens** (`--g-color-brand-*`, `--g-color-bg-surface`, `--g-color-text-*`, `--g-color-border-subtle`, `--g-color-ai-surface`, `--g-border-ai`, `--g-shadow-1/2`, `--g-radius-*`, `--g-space-*`, `--g-focus-ring`, `--g-z-sticky`) and **motion presets** (`riseIn`, `gentleFade`, `pressResponse`, `withReducedMotion` from `lib/motion`).

## 4. Loading / Empty / Error states
| State | Before | After |
|-------|--------|-------|
| **Loading** | raw Mantine `Skeleton` blocks | `LoadingSkeleton shape="media"` + `shape="list"` (role=status, aria-busy, sanctioned shimmer) |
| **Error** | Mantine `Alert` (no retry) | `ErrorState variant="section"` + Persian `retryLabel="تلاش دوباره"` + `onRetry` (role=alert) |
| **Empty** | **none** (rendered an empty grid) | **new** `EmptyState` when a tab/filter yields zero recipes, with a "پاک کردن فیلترها" recovery action |

The empty state is **new** (Founder explicitly required "add/keep loading, empty, and error states"). The view-all button remains reachable alongside the EmptyState (parity preserved — see §10).

## 5. Why / explainability surfaces (recommendations)
The recommendation rail is migrated visually (CardShell + SectionHeader + a "شخصی‌سازی شده / personalized" indicator preserved). **No per-item "Why" chip was added in 4A — a deliberate CA-boundary decision, not an omission:**
- The `/recommendations` API **does** carry real explainability per item (`explanation`, `reasonSignals`, `matchedSignals`, `contributions`, `scoreBreakdown`) — confirmed by tracing the controller→pipeline→ranking/explainability services.
- BUT `explanation` is **English** and exposes **internal score percentages** ("27% matches proven taste signals"), and `reasonSignals` are snake_case tokens. Surfacing them verbatim to a Persian audience is poor UX and borderline internal-exposure; authoring user-facing **Persian** reason copy is a **content (CM)** decision and what to expose is an **AI-presentation (AA)** decision — **neither is CA's to make** (Constitution Part 18).
- **Action:** the GES `WhyChip`/`WhySheet` primitives exist and the data is ready; wiring them is **deferred to a dedicated ticket** gated on CM (Persian reason labels) + AA/UX (what to expose). Recommended as a new risk/follow-up. The mandatory "every recommendation has a Why" rule is therefore **OPEN** for the rec rail pending that ticket.

## 6. Before / after scans (`home/page.jsx`)
| Metric | Before | After |
|--------|:------:|:-----:|
| Hardcoded hex (`#rrggbb`) | **13** | **0** |
| Raw `rgba(...)` | **10** | **0** |
| Ad-hoc motion (custom `fadeInUp` variant, inline `whileHover`/`whileTap`, literal-duration `transition:`) | **16** lines / 10 `whileHover`+`whileTap` | **0** |
| Remaining `animate`/`transition`/`keyframes` lines | 16 (all ad-hoc) | 10 (all **preset-based**: `variants={withReducedMotion(riseIn/gentleFade)}` + `{...pressResponse}` from `lib/motion`) |
| `linear-gradient` | 7 (hardcoded hex) | 2 (**token-based** brand ramp) |

No remaining raw hex/rgba; no ad-hoc `whileHover` lifts (dropped — not in GES's calm motion vocabulary); all motion sourced from `lib/motion` and reduced-motion-aware via `withReducedMotion`.

## 7. Build result
- `pnpm --filter ./apps/web run build` → **green** (Vite + PWA `generateSW`, 37 precache entries, built in ~2.7s).
- `eslint home/page.jsx` → **0 errors**, 31 warnings (all pre-existing JSX-import false positives from the repo's missing `eslint-plugin-react`; none introduced here).

## 8. Screenshots
Not captured — no headless browser/screenshot tooling is available in this environment (consistent with prior phases). Verification was done via build, scans, adversarial code review, and WCAG luminance computation. A visual QA pass on a running dev server is recommended before sign-off.

## 9. Accessibility & RTL (verified)
- **Banner contrast (WCAG AA) — fixed during review:** the first migration put near-white `--g-color-text-inverse` on a saffron gradient, which fails AA in **light** mode (2.16–3.02:1) because the brand ramp is theme-independent while `text-inverse` flips. Re-done as a **soft light-brand gradient (`brand-100→300`) with fixed dark `brand-900` text → ≥5.6:1 in BOTH themes** (verified by relative-luminance recompute).
- **Keyboard a11y added** to the AI-CTA card, hero banner slides, and filter chips (`role="button"`, `tabIndex=0`, `onKeyDown` Enter/Space; `aria-pressed` on chips). The category grid is keyboard-accessible via `CardShell interactive` (real `<button>`).
- **RTL preserved** (Persian); search input keeps intended `textAlign:right`; no nested interactive elements (today-special outer click + inner GES `<button>` verified non-nested since CardShell here is a non-interactive `<div>`).
- **Mobile-first** preserved: 480px max container, bottom padding for the bottom nav.

## 10. Feature parity (verified against `git HEAD`)
All behaviors preserved: debounced server search, voice search, results dropdown navigation, filter-chip toggle + `filter_use`, banner autoplay + `banner_click`, seeded daily "today's special" + `today_special_click`, token-gated recommendations fetch + `recommendation_impression`/`recommendation_click`, category navigation + `category_click`, AI CTA + `ai_chat_button_click`, recipe tabs + slice(0,4), view-all (`total > 4`) + `view_all_recipes_click`, scroll-to-top FAB, scroll + page_view analytics. **No feature added or removed** (the new EmptyState is a Founder-mandated state, not a feature). The view-all button's guard was restored to `total > 4` so `view_all_recipes_click` stays reachable even when the EmptyState shows.

## 11. Remaining risks / follow-ups (out of 4A scope)
1. **Recommendation "Why" OPEN** — data-ready; wiring `WhyChip`/`WhySheet` deferred to a CM (Persian labels) + AA/UX (exposure) ticket (see §5). The mandatory Why rule is not yet satisfied for the rec rail.
2. **Filled-brand contrast (systemic token note for UX)** — `--g-color-brand-600` + `--g-color-text-inverse` (used by GES `Button` primary, and thus by the active filter chip / active tab / view-all here) computes ~3.0:1 in light mode. This is a **design-token property inherited from GES** (every GES primary Button shares it), not introduced by 4A; flagged for UX to review the brand-600/inverse pairing or define an on-brand text token. CA did not diverge per-component to stay consistent with the design system.
3. **Pre-existing a11y debt (not regressions; present in the original):** search-result dropdown rows are click-only (proper fix = Mantine Autocomplete option data — a refactor beyond 4A); scroll-to-top FAB uses physical `right:16` (codebase-wide convention across 6+ pages; functionally bottom-right in both directions — changing only Home would create inconsistency). Recommend a dedicated a11y ticket.
4. **`RecipeCard` not tokenized** — it still contains hardcoded hex/glassmorphism and is rendered by Home, but `RecipeCard` itself is **out of 4A scope** (shared component); flagged for a future phase.
5. **Banner art direction** — the calmer light-brand banner is a deliberate accessibility + token-purity outcome; final hero art direction is a **UX** sign-off item.
6. **Pre-existing copy** preserved verbatim; the nutrition/AI-assistant taglines ("دستیار هوشمند تغذیه و آشپزی شما", AI-CTA copy) are flagged for **CM** review (not rewritten by CA).

## 12. Status
**Phase 4A (Home / Command Center): COMPLETE & VERIFIED.** Stopping here per directive — **no Phase 4B without Founder approval.**
