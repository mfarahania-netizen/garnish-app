# GARNISH-FE-HOMEFIX-RECIPE — Execution Report
**Sprint:** Track 5 Reset · Sprint C — fix Home's 4 review issues + build Recipe Detail
**Branch:** `exec/garnish-fe-homefix-recipe`  ·  **Baseline:** `master` @ `a8a55121` (14-section Home)
**Status:** verification GREEN → ff-merged to master + pushed · **STOP for founder screenshot review**
**Date:** 2026-06-17

---

## 1. Summary
Fixed the 4 Home issues from the screenshot review and built the **Recipe Detail** screen, both as fresh React + Mantine on the GES tokens against the handoff-bundle mockups (`home-screen-design-exploration/project/`). The bundle runtime is **never imported** and the folder is **gitignored** (not bundled). **Backend untouched** (`apps/server` diff empty; the stray bundle-ignore line that an editor kept adding to `apps/server/.gitignore` was reverted).

## 2. Home — the 4 fixes (other 13 sections unchanged)
**FIX 1 — picks no longer tall/huge.** Root cause: `PlatePlaceholder` sized its glyph with `blockSize:'30%'` + `maxBlockSize:44` + `inlineSize:'auto'` — fine on the small rail image, but on the big full-width picks image the cap/auto didn't constrain it, so the glyph blew up/distorted and the card read as "a near-square block with a big glyph." Fix: a **fixed square `glyphSize`** (no %/auto) — small + undistorted at every size (picks 44, rails 34, hero 56, thumb smaller). The picks image was already `aspect-ratio:16/9` (same as the rails the founder confirmed look right); now the glyph is small, so picks read as compact 16:9 cards.

**FIX 2 — pick meta / repeated reason.** The visible "تند · قارچ · سالم — مثل ذائقه‌ات" was the inline WhyChip reason (repeated per card, with an ingredient), shown because the real meta wasn't joining. Fix: (a) the meta line is the recipe's **real** time · difficulty · servings (catalog join, limit raised to 60 for coverage; omitted gracefully if a recipe isn't joinable — never wrong); (b) the repeated inline reason line is **dropped** — the «چرا این؟» WhyChip remains and reveals the real per-recipe `matchedSignals` (localized) on tap, per your guidance ("show the WhyChip without a fabricated reason rather than repeating the same string").

**FIX 3 — Food DNA traits showed an ingredient (قارچ).** Traits were sourced from recommendation `matchedSignals` (which include `likes_mushroom`→قارچ). Fix: traits now come from the **profile's taste/behaviour DIMENSIONS** (`plant_forward`→گیاه‌محور, `health_conscious`→سلامت‌محور, …) via a curated map that contains **no ingredients**. Empty while cold-starting (honest forming state — ring + headline only). An ingredient can no longer appear as a trait.

**FIX 4 — occasion card dark gradient.** Replaced the dark `--g-scrim-photo` over a placeholder with a **warm, light, flat** surface (brand-50 tint, brand-200 border, a saffron calendar glyph tile, «مناسبتی» pill, dark readable title) — per GES (no decorative gradients on content). Calm + inviting, no muddy dark block.

## 3. Recipe Detail (new screen — `apps/web/src/app/recipe/[id]`, standalone route `/recipe/:id`)
Home picks / rails / AI-Whisper now **navigate** to `/recipe/:id` (toast no-ops removed for recipe opens). Built to `Garnish Recipe Detail.dc.html`, top→bottom RTL:
1. **Hero** — real `imageUrl` (img + photo scrim) when present, else the **small-glyph branded placeholder** (never another dish's photo — `jujeh-kabab.png` is a mockup sample, not used as a generic fallback). Back / save / share controls. *(Title renders just below the hero in dark ink — always readable, since most recipes have a placeholder, not a photo; the mockup's title-on-photo overlay assumes a photo.)*
2. **Meta row** — time · difficulty · servings (overlaps the hero), real recipe values.
3. **Fit + Why** — honest fit from `fit.recommendation`: great_fit → «عالی برای تو» (success), ok → «مناسبِ تو» (info), **avoid_allergen → allergen banner, demoted-not-hidden** listing `fit.safety.conflictingAllergens` (localized to Persian). «چرا این؟» WhyChip reasons are built from the **structured** fit fields (dietary/effort/skill) — the API's English `reasons`/`explanation` are never rendered.
4. **AI Sheet entry** «برای من تنظیمش کن» → `AISheet`: disclosed (AI glyph + «AI»), hedged ("پاسخِ هوش مصنوعی ممکن است اشتباه کند… هر تغییری پیش از اعمال از تو می‌پرسد"), **proposes-not-auto** (the real propose→«بله، اعمال کن»/«بی‌خیال» loop lands with the AI Chat screen; this sprint shows no fabricated answer and auto-applies nothing).
5. **Author byline** — owner-safe `recipe.author`.
6. **Ingredients** — «مواد لازم» list with real name + amount + a «جایگزین؟» affordance (→ routes to the assistant; no invented ingredient IDs).
7. **Nutrition** — real calories per serving + `NutritionBadge` (estimate when a number exists, **unavailable** + «عدد دقیقی موجود نیست» when not — never fabricated), with the mandatory **«اطلاعات عمومی، نه توصیهٔ پزشکی»**.
8. **Method** — «مراحل پخت» numbered steps, «نکته‌ها» tips, «سؤال‌های پرتکرار» FAQ (real recipe data) as accordions.
9. **Action shelf** — «بپز» (→ Cook Mode, toast until built) + plan.
**States:** loading skeleton, error («دستور بارگذاری نشد / اتصال کوتاه قطع شد» + retry), empty/missing → error path. Wired to **GET /recipes/:id/full** (+ public **GET /recipes/:id** fallback when logged-out). New token-pure primitives: `NutritionBadge`, `AISheet`.

## 4. Honesty / safety
Allergen **demoted-not-hidden** (banner from real `conflictingAllergens`); nutrition badge + non-medical caption, no medical framing; AI **disclosed + hedged + proposes-not-auto**; no fabricated data (real API or honest empty/omit); the English `explanation`/`reasons` are never shown raw; no invented ingredient IDs; the occasion card («شب یلدا») is static curated content, «محبوب‌ها» is the recipe catalog (popularity ranking pending) — both disclosed in prior reports.

## 5. Token purity / a11y / RTL
Zero banned hex (`grep #FF6B35/#1A237E/#4CAF50` = 0). No raw color literals across `app/**` + `components/ges/**` — only `var(--g-*)` tokens and theme-adaptive `color-mix(...)`. Flat warm surfaces (occasion de-gradiented). Logical RTL only (no physical left/right). ≥44px targets; visible focus; reduced-motion respected; no new CSS keyframe; no new dependency.

## 6. Clean-room verification (isolated worktree, detached at the branch tip)
```
git worktree add --detach ../garnish-verify 851a815a
pnpm install --frozen-lockfile          # Done in 34.3s (frozen)
pnpm --dir apps/server exec prisma generate   # exit 0
pnpm build                              # Tasks: 2 successful, 2 total (web vite + server) → exit 0
pnpm coverage:check                     # UNMAPPED=0 UNREGISTERED=0 → COVERAGE GATE PASSED → exit 0
( cd apps/server && pnpm exec jest --maxWorkers=2 )
                                        # Test Suites: 191 passed, 191 total
                                        # Tests:       1412 passed, 1412 total ; Snapshots: 0 ; skips: 0 → exit 0
git diff --name-only master -- apps/server   # EMPTY (backend untouched)
git worktree remove ../garnish-verify
# build evidence: dist has NO support.js/_ds_bundle/x-import and NO home-screen-design-exploration/jujeh-kabab
#   (bundle runtime + assets not bundled); the variable font IS bundled.
```

### Scope-proof
- Changed set vs master = `App.jsx`, `app/home/{page.jsx,lib/useHomeData.js,lib/reasons.js}`, `app/recipe/[id]/{page.jsx,useRecipeDetail.js}`, `components/ges/{PlatePlaceholder,RecipeCard,OccasionCard,NutritionBadge,AISheet}.jsx`, `tools/coverage/coverage.registry.json`, `docs/coverage/coverage.generated.json`, `.gitignore`. **No other page. No `apps/server` change.**
- Home 4 fixes done; other 13 sections untouched. Picks/hero imagery = real or small-glyph placeholder (no huge/tall/circle/gray/empty).
- Bundle runtime not imported; `home-screen-design-exploration/` gitignored, not bundled.
- Zero non-brand hex. Coverage green (`/recipes/:id/full` + `/recipes/:id` → frontend:recipe-detail/RecipeDetailPage). Server tests 1412 / 0 skips. Build green.

## 7. Render — in words (no headless screenshot here; the founder's next step)
**Home:** picks are now compact 16:9 cards with a small saffron dish glyph (like the rails), a real time·difficulty·servings meta line, and a «چرا این؟» chip (no repeated «قارچ»); Food DNA traits are taste dimensions (or none while forming); the occasion card is a warm light saffron-tinted card (no dark block). **Recipe Detail:** a hero (photo+scrim or small-glyph placeholder) with back/save/share, an overlapping meta row, an honest fit chip (+ allergen banner when relevant) with «چرا این؟», the disclosed «برای من تنظیمش کن» AI sheet, the author byline, ingredients with «جایگزین؟», nutrition with the non-medical caption, and method/tips/faq accordions, over a sticky «بپز» action shelf. RTL + Vazirmatn; toasts for not-yet-built destinations; clean console expected on mount.

---

## VERDICT
```
FE_HOMEFIX_RECIPE RESULT: PASS
Clean install (worktree): build(web+server) exit 0, coverage:check green, server tests Test Suites 191/191, Tests 1412/1412, skips 0
HOME fixes: picks cards = 16:9 + compact (not huge) = yes; meta = real time/difficulty/servings (no repeated قارچ) = yes; Food DNA traits = dimensions not ingredients = yes; occasion card warm/light (no gray gradient) = yes; other 13 sections not regressed = yes
RECIPE DETAIL built to mockup (hero/meta/fit+why/AI-sheet/author/ingredients+substitute/nutrition/steps/tips/faq/بپز) = ok
Recipe hero + Home picks imagery = real or SMALL-glyph branded placeholder (no huge/tall/circle/gray/empty) = yes
APIs wired: /recipes/:id/full (+ public /recipes/:id fallback); Home unchanged APIs intact = yes
Honesty/safety: fit + allergen demoted-not-hidden + nutrition badge + «اطلاعات عمومی، نه توصیهٔ پزشکی» + AI proposes-not-auto + no fabricated data + no invented ingredient IDs = yes
bundle runtime NOT imported, design-reference NOT bundled = yes
Zero non-brand hex (no #FF6B35/#1A237E/#4CAF50) = yes, grep
RTL + Vazirmatn + reduced-motion + AA + >=44px = yes
Frontend-only: only Home-fix + Recipe Detail + primitives; backend untouched = yes (apps/server diff empty)
Render (in words): compact 16:9 picks / real meta / dimension traits / warm occasion · Recipe hero / honest fit / nutrition caption / proposes-not-auto / RTL / clean console
Coverage: re-mapped honestly (/recipes/:id/full + /recipes/:id → frontend:recipe-detail/RecipeDetailPage); gate green
Merge/push: exec/garnish-fe-homefix-recipe → master (ff, pushed)
Verdict: FE_HOMEFIX_RECIPE_PASS
```

---

**Next: Cook Mode (entered from «بپز»), then onboarding/profile — screenshot-gated.**
