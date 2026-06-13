# PHASE 4A — Visual QA / Rejection Triage Report

**Date:** 2026-06-13 · **Task:** `PHASE_4A_VISUAL_REJECTION_TRIAGE` · **Surface:** Home / Command Center
· **Method:** real screenshots of the running app (Edge headless via `playwright-core`, served from the live
dev build at `:5173` against the live backend `:3000` with 122 real recipes). No app code was changed for this
triage (only a throwaway capture script under `docs/qa/`). Each screenshot was visually inspected; the banner
and dark-mode findings were confirmed with a read-only DOM probe.

> **Founder verdict being triaged:** Phase 4A is *technically* accepted (clean scans, token-pure, states present)
> but *visually / product-quality* **rejected** — cards, layout, hierarchy, spacing, and overall feeling are not
> acceptable. This report diagnoses why, with evidence, and recommends keep / patch / revert.

---

## 1. Screenshots (package)
All under `docs/qa/phase4a/` (RTL by construction — the app is `dir="rtl"`):

| File | Viewport | Theme | State |
|------|----------|-------|-------|
| `home-mobile-light.png` | 390×844 | light | populated (real recipes) |
| `home-mobile-dark.png` | 390×844 | dark | populated |
| `home-desktop-light.png` | 1440×900 | light | populated |
| `home-desktop-dark.png` | 1440×900 | dark | populated |
| `home-loading-mobile-light.png` | 390×844 | light | loading (LoadingSkeleton) |
| `home-error-mobile-light.png` | 390×844 | light | error (ErrorState) |
| `home-empty-mobile-light.png` | 390×844 | light | empty (EmptyState) |

`_capture.cjs` is the repro tool. **Note:** the personalized recommendation rail is **auth+data gated**, so with no
login token it is hidden — these captures show first-load-for-anonymous Home (the rail does not appear).

## 2. Exact visible sections on Home (top → bottom)
1. App top bar (logo + hamburger + bell) — *MainLayout / Phase 3*, not Home.
2. Home brand header: "Garnish OS" + chef-hat icon + tagline "دستیار هوشمند تغذیه و آشپزی شما".
3. Hero **banner carousel** (Swiper, 2 slides, autoplay).
4. Search bar (pill) + voice mic button.
5. Filter chips row (سریع / سالم / گیاهی / ایرانی).
6. "Today's special" card (پیشنهاد سرآشپز امروز).
7. *(Recommendation rail — hidden when not logged in.)*
8. "دسته‌بندی‌ها" section header + 3×3 category grid.
9. AI-assistant CTA card ("با مواد یخچال چی بپزم؟").
10. Recipe tabs (همه رسپی‌ها / سریع و آسان / پرطرفدارها) + recipe list (4 cards) + "مشاهده همه رسپی‌ها".
11. Scroll-to-top FAB.
12. Bottom navigation (MainLayout / Phase 3).

## 3. Component inventory — GES vs legacy
| Component | Status |
|-----------|--------|
| Loading / Error / Empty states | **GES primitives** (LoadingSkeleton / ErrorState / EmptyState) — render cleanly |
| "Today's special" card | **GES** (CardShell + GES Button) |
| Category tiles | **GES** (CardShell interactive) |
| Section headers | **GES** (SectionHeader) |
| Tabs / view-all / today CTA | **GES** (Button) |
| AI CTA card | GES **tokens** (ai-surface / border-ai), custom Box (not a primitive) |
| Hero banner | GES **tokens** (brand-ramp gradient), custom Swiper slide (not a primitive) |
| **RecipeCard** (recipe list + the recs rail items) | **LEGACY — NOT migrated** (out of 4A scope) |
| **RecommendationRail** | container is **GES** (CardShell + SectionHeader), but the **items it renders are legacy RecipeCard**; rail itself is hidden without auth |

- **Is RecipeCard still legacy?** **YES.** It still uses hardcoded per-type hex gradients + glassmorphism, a chef-hat
  placeholder (no food photography), and has **no dark-mode handling**. It is the dominant visual element of Home and
  is the single biggest driver of the "not premium / generic" feeling. (Out of Phase 4A scope by directive.)
- **Is RecommendationRail still legacy?** Container migrated to GES; **its cards are legacy RecipeCard**, and it carries
  no per-item "Why". Functionally hidden for anonymous users.

## 4. Problem analysis (evidence-based)

### 4.1 Layout & hierarchy (MAJOR)
- **No desktop/command-center layout.** On 1440px the content is locked to a ~480px mobile column centered in a vast
  white void (`home-desktop-light/dark.png`). It reads as a stretched mobile app, not a food-**intelligence command
  center**. No rails, panels, at-a-glance intelligence, or use of width.
- **Flat hierarchy.** Every section is a similar-weight stacked card. There is no hero/focal point, no "first-screen"
  emotional anchor, no information density that says "command center." It feels like a generic list app.
- The **strongest-position element (the hero banner) is the weakest** (see 4.4).

### 4.2 Card design (MAJOR)
- **Legacy RecipeCards dominate**: loud orange gradient top half + chef-hat placeholder (no imagery) + "MEDIUM" /
  "LUNCH·DINNER" / "MAIN" chips. They are not appetizing, look unfinished, and clash with the calm GES cards
  (today-special / categories). They are also **identical loud orange in dark mode** (jarring on a dark surface).
- The GES cards (today-special, categories, AI CTA) are clean but **bland/floaty** — generic white rounded boxes with
  little personality or food-forward warmth.

### 4.3 Spacing & density (MINOR–MAJOR)
- Vertical rhythm is acceptable on mobile, but the page is **low-density and repetitive** — a long single-column scroll
  of same-shaped cards. On desktop the density problem is extreme (one narrow column, the rest empty).
- Category tiles feel under-filled (large padding, tiny emoji + label).

### 4.4 Hero banner (MAJOR)
- The banner **renders correctly** (text + emoji present; DOM-confirmed) but my Phase-4A contrast fix used a very pale
  `brand-100→brand-300` gradient with dark `brand-900` text. Result: **a washed-out block that reads as empty /
  unfinished** and has no emotional energy (`home-mobile-light.png`, `home-desktop-light.png`). It is accessible but
  visually flat — the opposite of an appetizing first screen. (This is a direct consequence of fixing the earlier
  white-on-vivid-orange WCAG failure with pale colors instead of a properly art-directed hero.)

### 4.5 Typography (MINOR)
- Uses the GES type tokens via primitives, but on Home the **type hierarchy is weak** — section headers, card titles,
  and meta don't establish a strong scale; the brand header "Garnish OS" is small and unremarkable.
- Persian (Vazirmatn) renders fine; no Latin/Persian mismatch observed in the captures.

### 4.6 Dark mode (MAJOR — app-level defect, exposed by Home)
- **The page canvas stays white in dark mode** while GES card tokens go dark. DOM probe: `data-theme="dark"`,
  `--g-color-bg-canvas = #171310`, but `body` background = `rgb(255,255,255)` and AppShell main = transparent
  (`home-desktop-dark.png`, `home-mobile-dark.png`).
- Consequence: dark cards float on a white page; the **brand header text and ghost-tab labels (light text-primary)
  become nearly invisible** on white. Legacy RecipeCards stay bright orange.
- **Root cause is app-level** (body/AppShell background not bound to `--g-color-bg-canvas`, and Mantine's colorScheme
  not flipping the body) — **pre-existing**, not introduced by Home 4A; Home merely exposes it. Fixing it touches the
  theme/MainLayout integration, not just Home.

### 4.7 Mobile reachability (OK)
- Primary actions are reachable; tap targets are ≥44px (GES primitives + the added keyboard a11y). Bottom nav is
  correctly anchored (`home-error-mobile-light.png`). FAB bottom-right. No reachability blocker found.

### 4.8 RTL (OK)
- RTL is natural and correct in every capture (layout mirrors, Persian reads right-to-left, search caret right-aligned,
  badges/icons mirror). No RTL defect found.

### 4.9 Why / explainability (OPEN)
- No per-recommendation "Why" surface (deferred in 4A pending CM Persian reason labels + AA/UX exposure decision — see
  the Phase 4A report). The rail (when shown) only carries a "شخصی‌سازی شده" badge. Status: **OPEN**, gated on CM/AA.

### 4.10 Empty / Loading / Error visual quality (GOOD)
- **Error** (`home-error-mobile-light.png`): clean GES card, icon, Persian title + retry button. **Good.**
- **Empty** (`home-empty-mobile-light.png`): clean GES EmptyState, icon, message, "پاک کردن فیلترها" action. **Good.**
- **Loading** (`home-loading-mobile-light.png`): calm GES skeleton — but **thin**; it shows a media bar + 3 list lines
  then lots of empty white, so it doesn't mirror the rich populated layout (banner + grid). Acceptable, could be richer.
- These three states are the **strongest part of Phase 4A** and should be kept as-is.

## 5. Visual acceptance checklist
| # | Question | Verdict |
|---|----------|---------|
| 1 | Does Home feel premium? | ❌ No — generic, low-density, washed-out hero |
| 2 | Looks like a food-intelligence command center (not a generic dashboard)? | ❌ No — a single mobile column of stacked cards; no intelligence/rails; broken on desktop |
| 3 | Is the first screen emotionally strong? | ❌ No — pale empty-looking banner, weak hierarchy |
| 4 | Are cards visually appetizing and calm? | ⚠️ Mixed — GES cards calm but bland; **legacy RecipeCards loud + no food imagery, not appetizing** |
| 5 | Are recommendation cards understandable? | ⚠️ N/A (rail hidden anonymous); when shown they are legacy RecipeCards with no Why |
| 6 | Is there clear hierarchy? | ❌ No — flat, equal-weight stack |
| 7 | Is the mobile-first layout clean? | ⚠️ Partially — clean but generic; no desktop layout at all |
| 8 | Are primary actions reachable? | ✅ Yes |
| 9 | Is RTL natural? | ✅ Yes |
| 10 | Any legacy-looking card/component? | ❌ Yes — **RecipeCard** (dominant), and dark-mode white canvas |

## 6. Recommendation: **PATCH (keep the foundation) — do NOT revert**
**Keep Phase 4A.** The token purity, GES primitives, motion presets, keyboard a11y, and the three state surfaces are
sound and are genuine improvements; reverting would re-introduce 13 hardcoded hex / 10 rgba / ad-hoc motion and lose
the loading/empty/error states. The visual rejection is **not** caused by the migration mechanics — it is caused by:

1. **Legacy `RecipeCard`** (loud, image-less, no dark mode) — the #1 visual problem, **out of 4A scope**; needs its own card-redesign phase.
2. **No desktop / command-center layout** — a **design-direction decision** (rails, density, hero) that belongs to **UX**, not CA.
3. **App-level dark-mode canvas bug** — a focused, patchable fix in the theme/MainLayout integration (bind body/AppShell bg to `--g-color-bg-canvas`; make Mantine colorScheme follow `dark`). Mostly pre-existing.
4. **Washed-out hero banner** — patchable, but the right hero treatment (vivid + accessible, or photographic) is a **UX art-direction** call.
5. **Flat hierarchy / missing personalized rail on first load** — product+design decision.

**What CA can patch quickly (with approval), low-risk, no scope creep:** the dark-mode canvas binding (item 3) and a
richer loading skeleton. **What requires a UX/Founder design-direction decision (CA must not invent):** the
command-center desktop layout, the hero art direction, the RecipeCard redesign, and the personalized-rail treatment.

**Suggested next step:** route the **visual direction to UX** (command-center layout + hero + card system + dark-mode
canvas), then schedule **RecipeCard redesign** as its own phase. Phase 4A's GES foundation remains the correct base to
build that on.

## 7. Status
**Triage complete. Stopping per directive.** No code changed. Awaiting Founder decision on the visual direction before
any further work (no Phase 4B; no RecipeCard/Admin/AIChat/RecipeDetail/MealPlanner migration; no backend changes).
