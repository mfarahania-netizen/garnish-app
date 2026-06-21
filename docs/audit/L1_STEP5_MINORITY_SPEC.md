# L1 Step 5 — Collective degradation + Minority protection — Build Spec

Source: `l1-step5-minority` forge (7-agent panel → 3-lens judge → synthesis). Aligns with `L1_PLAN.md` step 5.
Status: **BUILT, default-OFF, byte-identical** (guardian re-review pending). Builds on the step-4 `recipePrior`
component.

## Chosen approach — bounded post-linear additive term, LIFT-ONLY by default
The step-4 `recipePrior` LINEAR component (weight 0.0) is **untouched**. Step 5 adds a SEPARATE bounded term
between `rawScore` and `finalScore`, derived from the SAME prior value (`scores.recipePrior`) + the personal
signal (`scores.tasteAffinity`):

```
dev  = 2*vPrior - 1                       // [0,1] → [-1,1], 0 at neutral 0.5
term = (W <= 0)              ? 0          // DEFAULT-OFF (L1_PRIOR_STEP5_WEIGHT=0) → byte-identical
     : (W*dev >= 0)          ? min(W*dev, liftCap)              // LIFT: bounded, ungated
     : (tasteAffinity > 0.35)? 0                                 // HARD FLOOR: positive personal signal ⇒ no pull-down
     : max(-penCap, W*dev) * penMult * gate                      // PENALTY: default-OFF (penMult=0), bounded, gated
finalScore = max(0, rawScore + term - exposurePenalty) * contextBoost
```

Three minority-protection layers (per the plan): (1) **asymmetric bound** `liftCap=0.06 ≫ penCap=0.02`; (2)
**override gate** — `penMult=0` ships LIFT-ONLY, and even when enabled a **hard floor** zeroes any penalty for a
recipe with a positive personal signal (`tasteAffinity > TASTE_NEUTRAL=0.35`); (3) **cohort granularity** —
inherited from step 4's hierarchical `recipePrior` value.

## Why LIFT-ONLY default — the invariant is UNCONDITIONAL (and survives diversity)
With `penMult=0` the penalty branch is always 0, so `term ≥ 0` for EVERY recipe and ANY `tasteAffinity`. Since
`finalScore = max(0, rawScore + term - E) * C` is non-decreasing in `term≥0` and `round` is monotone,
**finalScore_step5 ≥ finalScore_no-prior** PRE-diversity for every candidate — strictly stronger than the
founder's "positive personal signal ⇒ score never drops".

**Diversity fix (guardian-caught):** `applyDiversity` applies an ORDER-DEPENDENT same-(mealType,diet) penalty, so
naively letting the lift change the sort order could reorder a peer above an un-lifted recipe and demote it into a
larger penalty — dropping its score below baseline. Fixed by ranking the diversity pass on a NO-PRIOR
`diversityScore` (= `max(0, rawScore - exposurePenalty) * contextBoost`, computed alongside finalScore, stripped
from output). Each recipe's diversity penalty is then baseline-deterministic, so `finalScore_step5 = baseline +
liftEffect ≥ baseline` END-TO-END through diversity. At default (term 0) `diversityScore === finalScore` →
byte-identical. (Property: a same-group peer lift never drops the un-lifted recipe — locked by a regression test.) This also sidesteps the fact that `tasteAffinity` is *declared*
preference (not per-recipe reward): with lift-only the gate is never the safety guarantor. Re-enabling the
two-sided down-signal post-launch is a config flip (`penMult=1`) — the centered (negative-capable) means keep
living in `RecipePrior`; no backfill. The hard floor then secures the invariant independent of the gate shape.

## Edits (apps/server/src/recommendation/pipeline/ranking.service.ts) — all ADD-ONLY, weightedScore untouched
1. import `TASTE_NEUTRAL` from the taste-affinity builder (single source of truth; builder floor refactored to it).
2. `priorStep5Config()` — env params, read at call time (`L1_PRIOR_STEP5_WEIGHT|LIFT_CAP|PEN_CAP|PEN_MULT|GATE_FULL`).
3. `recipePriorSlateTerm(vPrior, tasteAffinity)` — the pure term above (`||0` normalizes -0/NaN).
4. wire `priorTerm` INSIDE `Math.max(0, rawScore + priorTerm - exposurePenalty)`.

## Params + activation
`L1_PRIOR_STEP5_WEIGHT=0.0` (THE activation knob) · `LIFT_CAP=0.06` · `PEN_CAP=0.02` · `PEN_MULT=0.0` (lift-only)
· `GATE_FULL=0.62` · `TASTE_NEUTRAL=0.35` (shared code const). Activation needs ALL of: weight>0 + registered &
enabled prior source + accrued rows — founder-gated behind the offline-replay "lift beyond outcomeFit+popularity"
proof (L1_STEP4 open-Q5). Recommended first activation: weight ~0.08, penMult 0.

## Cold-start byte-identical — 5 guards (any one sufficient)
weight 0.0 (term=literal 0) · linear component unchanged · source unregistered · env flag OFF · neutral table
(dev=0). Existing `ranking.recipe-prior.spec.ts` + `ranking.service.spec.ts` stay green unchanged.

## Tests (`ranking.recipe-prior-step5.spec.ts` + extended `ranking.recipe-prior.spec.ts`)
default-off→0 · lift cap · lift-only-default · hard floor · bounded penalty · gate monotonicity · asymmetric
bound · NaN-safe · INVARIANT sweep (term≥0 for all W/v/ta at penMult=0) · INVARIANT penMult=1 (ta>0.35⇒≥0) ·
TASTE_NEUTRAL coupling · activation smoke (crowd dish UP, no dish drops below baseline). Full suite 1751 green.

## Status — BUILT + guardian-verified (find → fix → re-review CLEAN)
`28e69fcf` (build) · `ac919541` (diversity-invariant fix). Re-review: invariant holds end-to-end through
applyDiversity, byte-identical default preserved, both reviewers fixSound/no-rework.

### Known minor (guardian re-review, non-blocking)
- The end-to-end invariant proof assumes the step-4 recipePrior **LINEAR** weight stays 0 (it does, in
  defaultWeights). If a future `LearnedWeightSource` ever raises that linear weight, prior signal would enter
  rawScore (hence diversityScore) — re-verify the invariant then. The step-5 slate-term mechanism is unaffected.
- `diversityScore` is stripped at runtime (`delete`) but remains in rank()'s inferred return TYPE (undefined at
  runtime; no consumer reads it). Cosmetic TS-typing nuance only.

## Open questions — ALL activation-time / policy (none block the build; flag at activation)
1. CONTRACT: invariant is per-recipe SCORE never drops, NOT rank (rank-monotonicity is impossible for a
   slate reranker; matches the plan's verbatim wording). Founder sign-off.
2. PENALTY re-enablement: lift-only ships; flip `penMult>0` only post-launch after the replay gate proves the
   down-signal helps minorities. Who owns the gate?
3. RICH-GET-RICHER: lift-only can entrench head dishes; offset by diversity + exposurePenalty + liftCap + the
   offline-replay "lift beyond popularity" gate. Confirm the gate runs at activation.
4. CAP calibration (liftCap/penCap/gateFull) is hand-set pre-data → move to the control-plane/experiment later.
5. ACTIVATION authority/timing + per-cohort n threshold — founder call (with L1.5 bandit for honest propensity).
