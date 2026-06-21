# Garnish Onboarding v1 — Build Spec (distilled)

Source: `forge-onboarding-worldclass-v3` (38 agents, web-grounded benchmarks + LIVE-DB re-read, 5 red-team/refine
rounds). Claude independently verified the load-bearing claims against the live DB/code (the earlier v2 run had
anchored on a stale 124-row export and was discarded). Founder bar: ≤5 up-front questions, each must move a
DISTINCT live engine lever — no filler.

## Headline (the rigorous answer)
**v1 asks ONE up-front question (allergy safety).** For the MODAL no-restriction user it moves ZERO recipes (a
pure safety pre-write) — 100% of their first-slate value is AUTO-DERIVED by the engine. For the restricted
MINORITY, allergy + diet move real recipes off the served slate (verified: `generate() → safeIds → rank`). So the
"minimal that earns its place" count is **one-for-the-minority / zero-for-the-majority** — and the engine earning
the majority's value with no question is the IDEAL, not a gap. More up-front questions for the majority = the
exact filler to avoid.

## v1 question set (each earns its place via a LIVE lever)
1. **S1 — Allergy safety (the one up-front question).** A single safety screen: EU-14 declarable allergen chips
   (live 8 + fish, mustard, celery, lupin, sulphites, molluscs) + a visually-primary one-tap **None** fast-exit.
   Copy: "allergies only — not dislikes." Lever: `safeIds` HARD gate. Chip set governed by EU-14 legal
   declarability, NOT recipe count (peanut-at-3 must be protected → so mustard-at-3 cannot be cut).
2. **Diet / observance — optional, post-slate (S4b card + one-tap "hide meat / hide pork" on the slate).**
   Counted honestly (not "free"). Live options only: Vegetarian / Vegan (+ a separate No-pork chip). Lever:
   `where.diet` + VEG_RESTRICTIONS + no-pork path. Zero for the majority; near-required for vegan/halal (serving
   them meat on first impression is a trust violation). No-pork ships only behind a pork-coverage audit.
3. **Effort "short on time tonight" — the ONE demonstrable declared lever, IN v1.** Two cold users differing only
   in declared time get visibly different slates. Ships WITH its full wire (cooking_time persistence + the
   served-pipeline effort term in ranking.service + graded effortFit). Single binary toggle in v1.
- **Account = silent device-keyed GUEST spine** (real User + JWT minted in background) so every request carries a
  userId and hits `safeIds` (anonymous = filter OFF today — unacceptable). Phone+password is NOT the front door;
  email/social moves to a later "claim" step (value before commitment). Guest→registered merge must be additive +
  allergy-preserving.
- **NO swipe deck in v1** — the in-session re-ranker does not exist (a no-effect swipe teaches users the gestures
  are dead). Early taste = zero-effort behavior logging (taps/saves/cook-starts), personalization-gated for
  cross-session use. The swipe returns as an optional "tune these" affordance once the re-ranker ships.
- **Progressive (earned across sessions):** skill (at first "too hard"), dislikes (incl. seafood-aversion),
  servings/household (at first cook), goals/budget (deferred). UI language from device locale; market/familiarity
  cohort from server-side IP-geo at guest-mint (NOT device locale).

## Aha / metrics
Activation = **first safe slate render (S0→S4) in <60s** (the account+consent steps are silent/background or
post-value, stated relative to that clock). Healthy completion 60-80%. Track median + p75 TTV, first-cook.

## Real bugs it found (Claude-verified against live code — fix regardless of onboarding)
- **fish ↔ shellfish entanglement [VERIFIED]:** `looseMatch` (grounding-utils.ts:54-59) is bidirectional
  substring; recipe-fit.ts:93 uses it for allergen matching; `'shellfish'.includes('fish')===true` → a shellfish
  chip ALSO hides all fish dishes and vice-versa. Over-warns (safe direction) but silently shrinks the restricted
  slate. → motivates exact-match canonicalization (set-intersection on canonical tokens).
- **no-pork is best-effort:** PORK_TOKENS misses plain "sausage" + Dutch "worst" → gate the no-pork chip on a
  containsPork coverage audit.
- **personalization consent granted UNCONDITIONALLY** (useOnboarding ~line 132 on both persist paths) → real
  consent-timing defect; un-bundle + ask at a high-engagement moment.
- **anonymous = allergy filter OFF** (recipe-safety-filter:35 `if (!userId) return candidateIds`) → the guest
  spine fixes this (give every user a real JWT).
- **allergen chips chosen by recipe-count** (peanut-3-kept vs mustard-3-cut contradiction) → use the EU-14 legal set.

## Convergence — honest
The loop did NOT reach literal zero faults (5 rounds; round 5 still listed ~19 items) — but the SUBSTANCE
converged: the round-5 items are mostly framing/edge-polish (the top one is literally "state the headline more
plainly"), not design flaws. A ruthless 5-lens adversarial panel will never let the count hit exactly 0; chasing
literal-zero is diminishing returns. The design is substantively settled + live-verified.

## Genuine open decisions (FOUNDER — not solvable by more looping)
1. **EU-14 allergen legal scope:** full EU-14 chip set vs a documented launch subset (legal sign-off).
2. **Familiarity content:** who authors the approachable-anchor recipe allowlist (or populates a
   Recipe.familiarity field) — a named content deliverable; the modal-user Aha can't ship until it exists.
3. **Accept the scope:** v1 is a multi-week, multi-workstream build (allergy-wipe + merge → exact-match allergen +
   fish/shellfish fix → no-pork audit + veg/vegan → familiarity content + cold-user fork → effort wire → NL/EN
   i18n + IP-geo cohort → guest spine + guest-safety test → consent un-bundle → GET /recipes/:id guard).
4. **Analytics lawful basis:** explicit consent vs documented legitimate-interest (legal).
5. Minor: observance coexistence (vegan AND no-pork) in v1 or defer; diet corpus re-tag (high_protein/regular are
   live values not surfaced); guest-spine abuse controls (rate-limit/TTL/geo).

## Imagery (founder-confirmed)
Onboarding swipe-free; the first slate + famous-first use the founder's 40 owned photos/videos (premium, zero
legal risk). Catalog long-tail = branded placeholder now → Wikimedia CC-BY + UGC progressively. No stock-as-the-
dish, no AI-as-real-photo, no scraping. (See chat research for the EU licensing rationale.)
