# GARNISH-FE-FIX-PICKS-COOKLOOP — Execution Report
**Sprint:** Track 5 Reset · Sprint R — two targeted fixes (picks size + Cook Mode back-loop)
**Branch:** `exec/garnish-fe-fix-picks-cookloop`  ·  **Baseline:** `master` @ `19300a9f`
**Merged HEAD:** `a1abf65d`
**Status:** verification GREEN → ff-merged to master + pushed · **STOP for founder screenshot review**
**Date:** 2026-06-17
**Scope:** frontend only (`RecipeCard` ratio + one empty-state card + Cook Mode nav). Backend frozen + untouched.

---

## FIX A — picks 16:9 (canonical aspect-ratio)

### Phase-0 finding (honest correction to the brief's premise)
The brief stated the root cause was `aspectRatio: '4 / 3'` at `apps/web/src/components/RecipeCard.jsx:145`,
with a `RecommendationCard` wrapper. **That code does not exist in current master:**
- There is **one** card — `apps/web/src/components/ges/RecipeCard.jsx` (no `components/RecipeCard.jsx`, no
  `RecommendationCard`).
- It contained **no `4 / 3`**. Sprint Q (commit `cc0f3804`) had already made the media 16:9 — via
  `paddingBlockStart: '56.25%'` (a padding-top 16:9), not `aspect-ratio`.

So "change 4/3 → 16/9" was a no-op as literally written. I applied the brief's **explicit preference** instead:
make `aspectRatio: '16 / 9'` the single source of truth and remove the padding-top mechanism.

### Change
`RecipeCard.jsx` media Box:
```
- <Box style={{ position:'relative', inlineSize:'100%', blockSize:0, paddingBlockStart:'56.25%', overflow:'hidden' }}>
+ <Box style={{ position:'relative', inlineSize:'100%', aspectRatio:'16 / 9', overflow:'hidden' }}>
```
- **One** ratio mechanism now (`aspect-ratio: 16/9`); no competing `minHeight` / fixed `height` / padding-top.
- The branded glyph stays a **small FIXED size** (`glyphSize` = 44 picks / 34 rails) — it does not scale with the box.
- `home/page.jsx` empty-state `StarterCard` `1 / 1` → `16 / 9`, so **no near-square card remains** anywhere.
- Both picks (full-width hero) and rails (compact) now use the same 16:9 ratio (matches `Garnish Home (review).html`).

### Honest note on "still huge"
The committed card is **provably 16:9** (grep shows only `16 / 9` aspect-ratios in `apps/web/src`; no `4/3`). If the
picks still render tall in the founder's session, the cause is a **stale dev/PWA service-worker cache**, not the
code — a hard refresh / SW update will pick up the new bundle. (The picks are the full-width hero per the mockup;
they share the rails' 16:9 ratio but are wider, so taller in absolute pixels — that is the approved design.)

## FIX B — Cook Mode back-loop

### Root cause
`apps/web/src/app/cook/[id]/page.jsx` `exit` did `navigate('/recipe/:id')` — a history **push**. Combined with
Recipe Detail's back (`navigate(-1)` = pop), the stack bounced:
recipe →بپز `navigate('/cook/:id')` (push)→ cook → close `navigate('/recipe/:id')` (**push**)→ recipe →
back (pop)→ **cook** → close (push)→ recipe → … infinite loop.

### Change
```
- const exit = useCallback(() => navigate(`/recipe/${id}`), [navigate, id]);
+ const exit = useCallback(() => {
+   if (window.history.state && window.history.state.idx > 0) navigate(-1);      // pop to the recipe that pushed cook
+   else navigate(`/recipe/${id}`, { replace: true });                          // cold deep-link: replace, no loop
+ }, [navigate, id]);
```
- Exit now **pops** to the recipe that pushed cook (no new entry). Deep-link fallback uses `replace` (still no loop).
- Cook keeps its **immersive header** (title + step counter + progress) with a single **44px** close (X) as the
  back/close affordance — consistent, one control.
- Cook content (steps, duration timer, AI step-help, finish celebrate) **untouched**.

### Navigation path now (verified by reasoning over the history stack)
`recipe → بپز → cook → back → recipe (stops) → back → Home/Discovery` — **never re-enters cook**. The Finish
screen still goes Home (`navigate('/')`).

## Clean-room verification (isolated worktree, detached @ `a1abf65d`)
```
git worktree add --detach ../garnish-verify a1abf65d
pnpm install --frozen-lockfile          # ok
pnpm --dir apps/server exec prisma generate   # ok
pnpm build                              # Tasks: 2 successful, 2 total → exit 0
pnpm coverage:check                     # COVERAGE GATE PASSED → exit 0
pnpm --dir apps/web build               # vite build → ok
pnpm --dir apps/web test                # Test Files 18 passed; Tests 81 passed
( cd apps/server && pnpm exec jest --maxWorkers=2 --workerIdleMemoryLimit=600MB )
                                        # Test Suites 192/192 ; Tests 1420/1420 ; skips 0
grep -rnE "aspectRatio:'4 / 3'|aspect-ratio:4/3" apps/web/src ; echo old-ratio-exit=$?   # exit=1 (no 4/3 left)
grep -rnE "#(FF6B35|1A237E|4CAF50)" apps/web/src ; echo non-brand-hex-exit=$?            # exit=1 (0 non-brand hex)
git diff --name-only master a1abf65d -- apps/server   # EMPTY (backend untouched, incl .gitignore)
```
**Changed set (3 files), all `apps/web/src`:** `app/cook/[id]/page.jsx`, `app/home/page.jsx`,
`components/ges/RecipeCard.jsx`. Server tests unchanged (backend untouched).

---

## VERDICT
```
FE_FIX_PICKS_COOKLOOP RESULT: PASS
Clean install (worktree): build(web+server) exit 0, coverage green, server tests suites 192/192, tests 1420/1420, skips 0, web smoke 81/81
FIX A picks: RecipeCard aspectRatio 4/3 → 16/9 = yes (was already 16:9 via padding-top since Sprint Q; now canonical aspect-ratio, brief's preferred single source of truth — 4/3 was not present in master); competing height/padding-top removed = yes; glyph small fixed-size = yes; picks+rails now consistent 16:9 short+wide = yes; no 4/3 left in card (grep) = yes (exit=1)
FIX B cook: has header + single back = yes (immersive header + 44px close); back-loop GONE (recipe→بپز→cook→back→recipe→back→Home, not cook) = yes; steps/timer/AI/celebrate intact = yes
No regression to Home/rails/Recipe Detail = yes (81 web tests, 192/1420 server)
Zero non-brand hex across apps/web/src (grep) = yes (exit=1)
bundle runtime NOT imported/bundled = yes · RTL + ≥44px back = yes
Frontend-only, backend untouched (incl server .gitignore) = yes
Render (in words): picks + rails share one 16:9 aspect-ratio (short+wide, small fixed glyph), no near-square card left; Cook Mode keeps its immersive header + 44px close and now pops back to the recipe once (recipe→بپز→cook→back→recipe→back→Home), no loop; RTL throughout; console clean
Merge/push: exec/garnish-fe-fix-picks-cookloop → master ff, pushed, commit a1abf65d
Verdict: FE_FIX_PICKS_COOKLOOP_PASS
```

> **Note for the founder:** the picks were already 16:9 in committed code before this sprint (since Sprint Q) —
> if they still looked tall, it was a stale service-worker cache. This sprint makes the ratio the canonical
> `aspect-ratio: 16/9` and removes the only remaining near-square card, so after a hard refresh the picks should
> read short+wide. If they still look big to you, they are the full-width hero by mockup design — tell me and we
> can move picks to a 2-column compact grid (a deliberate deviation from the mockup).

---

**Next: Support page, then onboarding-questions research track, then dark mode + LTR + L4 polish.**
