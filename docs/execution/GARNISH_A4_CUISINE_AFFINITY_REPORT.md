# A4-CUISINE-AFFINITY — Execution Report
**Surface:** Additive cuisine/flavor taste-affinity + scorer wiring (`recommendation/intelligence/*`).
**Baseline:** `master` @ `9788f6ca`  ·  **Merged HEAD:** `9250f059` (ff-merged to master + pushed)
**Status:** all gates GREEN · A4 builder / allergy / `getLivingUserProfile` byte-identical → merged.
**Date:** 2026-06-18

> Part 1 of the engine-learning work: build the cuisine/flavor taste signal the **safe, additive** way
> (no frozen A4 change), and wire it into the ranking scorer additively. ENGINE-PROOF Part 2 (the ≥50-user
> learning-curve proof + collective signal + report) follows as its own pass.

---

## PHASE 0 — the finding that shaped this
The audited A4 graph builder (`profile-dimension-aggregation.ts`) leaves
`TasteDimension.cuisineAffinities`/`ingredientAffinities` **EMPTY by design** — its own honesty note (lines
9-11): *"name-list fields … require a recipe-data join we do not perform in v1 — present but left empty."*
So the affinities had to be produced **outside** the frozen builder. Per the founder's instruction (prefer
the additive path; only modify A4 if impossible), this does the recipe-data join the **S2 `/profile/dna`
way** — a new additive computation — and does **NOT** modify the A4 builder.

## PHASE 1 — build (additive; no frozen change)
- **NEW `taste-affinity.ts`** — `computeTasteAffinities(events, recipeIndex)`: joins the user's REAL positive
  taste events (cook/save/view of specific recipes; weighted cook ≫ view) with those recipes'
  cuisine + ingredients → PII-free cuisine/ingredient affinity rankings + normalized cuisine weights. Pure.
  `cuisineAffinityMatch()` is the pure, scorer-facing match.
- **`recommendation-shadow-scorer.ts`** — `tasteFit` now blends a **bounded, DATA-GATED** cuisine-affinity
  contribution: `0.7·tasteBase + 0.3·affinityMatch`, applied **only** when the user has computed cuisine
  affinities AND the candidate carries `cuisineTags`; `cuisineAffinityMatch` returns `null` otherwise →
  `tasteFit` is **byte-identical** to before. A non-matching cuisine keeps a floor (diversity guard).
  Shadow-only (`productUseEnabled: false`); allergy path untouched.

## PHASE 2 — raw evidence (clean-room worktree @ `9250f059`)
```
pnpm install                                   # 40.4s
pnpm --dir apps/server build                   # nest build → ok
( cd apps/server && pnpm exec jest --maxWorkers=2 --workerIdleMemoryLimit=600MB )  # 200 suites / 1505 tests / 0 skipped
pnpm --dir apps/server run recsys:eval         # 19/19 PASS
pnpm --dir apps/server run ai:eval:regression  # 46/46 PASS
git diff --name-only master...HEAD             # 3 files (scorer + taste-affinity.ts + .spec) ONLY
```
**Byte-identical proof:** the scorer + A5/A7/A9 + decision-QA gates (31 tests) pass **unchanged** — because
`cuisineAffinities` is empty on every existing path, the new term is a no-op. **A4 builder, allergy filter,
`getLivingUserProfile`, candidate-generator are NOT in the diff** (untouched/byte-identical).

```
VERDICT BLOCK
=============
SPRINT: A4-CUISINE-AFFINITY (additive; ENGINE-PROOF Part 1)
ADDITIVE PATH (no A4 builder change): Y
A4 builder / allergy / getLivingUserProfile byte-identical (diff + gates): Y
SCORER cuisine contribution additive + data-gated (byte-identical when empty): Y (31 A-layer tests unchanged)
SHADOW-ONLY / freeze flags false: Y (productUseEnabled false; flags untouched)
BUILD: PASS  SERVER SUITE: 200/1505 skipped=0  recsys/ai-eval: PASS/PASS
SCOPE = scorer + taste-affinity (+spec) ONLY: Y
MERGE+PUSH: DONE @9250f059
```

## NEXT — ENGINE-PROOF Part 2
Build the ≥50-user, time-evolving (10/20/40 sim-day) synthetic population + a new additive collective
co-occurrence signal, and prove genuine recovery (effort/skill/feedback **+ cuisine/flavor**) via the REAL
`scoreRecommendationCandidates` + cold-start lift, 0 allergen leaks, freeze flags false →
`GARNISH_ENGINE_PROOF_REPORT.md`. (Honest framing: synthetic proves the mechanism; real users tune
real-world quality.)
