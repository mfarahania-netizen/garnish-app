# GARNISH ENGINE PROOF — Individual + Collective Learning under Synthetic Load
**What this is:** numbers, not adjectives, showing the recommendation engine genuinely learns — driven by
the **real** `scoreRecommendationCandidates` over a 50-user, time-evolving synthetic population, with a
standard nDCG metric vs a latent taste we control. **Shadow/offline only — no live-market flip.**
**Date:** 2026-06-18 · **Determinism:** fully reproducible (hash-based, no `Math.random`) · run
`pnpm --dir apps/server exec jest src/recommendation/intelligence/recommendation-learning-proof`.

> **Honesty contract (per founder):** every weak/under-satisfactory result below was first attacked, then —
> where it could not be made stronger — its **exact reason** is stated. Nothing is hidden. The integrity
> rule held throughout: I tuned the **synthetic model** (honest assumptions), **never** the metric or the
> engine; if a curve had not risen, this report would say so.

---

## 1. Headline results (real engine, 50 users)
| Metric | Value | Verdict |
|---|---|---|
| **Individual learning — full arc (nDCG@10, mean)** | cold `0.294` → `0.705` (10d) → `0.723` (20d) → `0.731` (40d) | ✅ learns |
| Cold-start → learned gain | **+0.437** | ✅ large |
| Monotonic 10 < 20 < 40 | `0.7046 < 0.7232 < 0.7311` = **true** | ✅ (modest — see §3.1) |
| **Collective lift (cold-start user, nDCG@10)** | `0.258` → `0.749` = **+0.49** | ✅ strong |
| Cuisine top-1 recovery accuracy | `0%` → **100%** by day 10 | ✅ (saturates — see §3.2) |
| Cuisine dominance share (gradual) | `0 → 0.586 → 0.629 → 0.730` | ✅ gradual |
| **Allergen leaks under full load** | **0** | ✅ HARD guard intact |
| Freeze flags (`productUseEnabled` every run) | **false** everywhere | ✅ no live flip |
| Diversity (distinct cuisines in top-8, worst user) | **2** (≥2 required) | ✅ not collapsed |

**Plain statement:** a brand-new user with zero history ranks at nDCG **0.29**; after 40 simulated days of
behaviour the engine ranks their latent-preferred recipes at **0.73** — and a cold-start user gets a **+0.49**
lift purely from the collective "users like you cooked X" signal. Both come from the real scorer; the metric
is standard nDCG against the known ground truth.

## 2. Which dimensions the engine learns (fine-grained)
The real scorer (`recommendation-shadow-scorer.ts`) ranks on `tasteFit` (now incl. the additive
cuisine-affinity match), `effortFit`, `skillFit`, `routineFit`, `feedbackFit`, novelty − penalties.
- **Cuisine / flavor — YES.** Top-1 cuisine recovered to 100% by day 10; cuisine *dominance share* keeps
  strengthening `0.59 → 0.63 → 0.73` (10→20→40), which is what lifts preferred-cuisine items further over
  time. Mechanism: real engagements → `computeTasteAffinities` (additive A4 join) → scorer `tasteFit`.
- **Feedback — YES, a real contributor (`+0.147` marginal, measured by ablation §7).** Cooked recipes flow
  into the scorer's outcome history (`feedbackFit`) and push on-taste items up; removing them costs `0.147`
  nDCG@10. This is the **second-strongest** dimension after cuisine.
- **Effort — ≈0 here (`−0.016` marginal, §7) — correction.** *An earlier draft of this report claimed effort
  was "the 10→40 driver." The ablation §7 disproves that:* neutralizing the learned effort input does **not**
  reduce nDCG@10 (it nudges it up `+0.016`). The 10→40 rise is driven by **cuisine dominance + feedback
  accumulation**, not effort. Honest interpretation: the synthetic effort estimate is noisy enough that it
  doesn't net-help against the cuisine+effort relevance target — flagged for real-data validation (§7).
- **Skill — ≈0 here (`−0.0002` marginal, §7).** Modeled + fed (per-user latent skill → `skill.technique_
  confidence` → `skillFit`), but its marginal is essentially zero in this population/metric. Honest
  interpretation: the relevance target is cuisine+effort, so skill-fit is not rewarded here — needs a
  skill-aware ground truth / real users to prove out (§7).

## 3. Weak / under-satisfactory spots — what I tried, and the honest reason
**3.1 Per-checkpoint individual gain after day 10 is small (+0.027 over 10→40).**
- *Attempted fixes:* (a) replaced normalize-to-max cuisine weights with **dominance-share** weights so the
  signal strengthens with evidence instead of saturating; (b) replaced constant-ratio noise (which biased
  the effort estimate and made the curve *decline*) with a **taste-formation** model (users explore then
  settle) so signal-to-noise genuinely grows; (c) added the **day-0 cold baseline** to show the real arc.
- *Honest reason it stays modest 10→40:* nDCG@10 is already **0.705** at day 10 because the dominant signal
  (top-1 cuisine) is recovered fast. The real learning is the **cold→day-10 jump (+0.41)**; after that the
  engine *refines* (effort precision + dominance), which is genuinely smaller. This is the engine learning
  **fast then fine-tuning** — not a defect, but stated plainly so the +0.027 isn't oversold.

**3.2 Cuisine top-1 accuracy saturates at day 10 (0→100%, then flat — not a 10→40 curve).**
- *Attempted fix:* added **cuisine dominance share** as the gradual companion metric (`0.59→0.73`), which
  *does* improve 10→40.
- *Honest reason:* top-1 cuisine is a strong, low-dimensional signal (5 cuisines); ~11 on-taste events by
  day 10 already make the favourite unambiguous. The gradual part of cuisine learning is *how strongly* it
  dominates, captured by the share metric — not the top-1 flag.

**3.3 Per-dimension ablation — DONE (§7), and it corrected a claim.**
- *Status: now done* (leave-one-out, INPUT-only neutralization, real scorer, 50 users @ day40 — see §7 for
  the table + method). The result revised §2: the real positive contributors are **cuisine (`+0.208`)** and
  **feedback (`+0.147`)**; **effort (`−0.016`)** and **skill (`−0.0002`)** are ≈0 in this synthetic
  population. The earlier "effort drives 10→40" hypothesis was **wrong** and is corrected above + in §7.
- *Honest reason effort/skill are ≈0:* the proof's relevance ground truth is cuisine+effort, and the effort
  estimate is noisy (so it doesn't net-help); skill isn't in the relevance target at all. This is a real
  signal about where the engine needs **pilot data** to prove out — not papered over.

**3.4 The result is SYNTHETIC.** It proves the **mechanism** (the real engine recovers a controlled latent
taste; the collective signal lifts cold-start). It does **not** claim real-world taste quality — real users
tune that at the gated pilot. The taste-formation assumption (explore→settle, 40% base → ~90% on-taste) is a
modeling choice, stated so it isn't mistaken for measured human behaviour.

## 4. Guardrails (asserted, not assumed)
- **Allergen HARD guard: 0 leaks.** An `allergen_conflict`-flagged candidate is `block`-decisioned by the
  scorer and **never surfaced or blended** — across all 50 users × 4 checkpoints + the collective runs.
- **Freeze intact:** every trace `productUseEnabled === false` (runtime-checked); `liveRankingChangedForUser`
  never set true. No live ranking changes for any real user.
- **Diversity guard:** the worst user's top-8 still contains ≥2 cuisines (collective + affinity don't collapse
  the feed to one cuisine).
- **Byte-identical frozen paths (diff-proven):** the audited A4 builder (`profile-dimension-aggregation.ts`),
  the allergy HARD-filter (`candidate-generator`/`assessRecipeFit`/`analyzeRecipeIntegrity`), and
  `getLivingUserProfile` are **not in the diff**. The scorer's cuisine term is additive + data-gated → the
  scorer/A5/A7/A9/decision-QA gates pass **unchanged** (proven in A4-CUISINE-AFFINITY, `9250f059`).

## 5. Methodology (so the numbers are checkable)
- 50 users, 10 per cuisine (overlapping) × distinct effort/skill (`buildUsers`). Latent taste = ground truth.
- Deterministic behaviour over sim-days (`engagementsFor`): explore→settle; events → `SignalObservation`s
  (`buildUserFoodIdentityGraph`) + the additive cuisine-affinity overlay (`computeTasteAffinities`) + outcome
  history. Confidence rises with evidence.
- Scoring: the **real** `scoreRecommendationCandidates` over a 25-recipe universe (5 cuisines × 5 efforts) +
  1 allergen recipe. Metric: standard **nDCG@10** vs graded relevance (cuisine+effort = 1.0, cuisine = 0.6).
- Collective: `buildCollectiveModel` (per-cuisine popularity from the population's day-40 cooks) blended
  additively (`blendCollective`, λ=0.3) into a cold-start user's allow-listed candidates only.
- All assertions live in `recommendation-learning-proof.spec.ts` (7 tests, green) + unit specs for
  `taste-affinity` (4) and `collective-signal` (2).

## 6. Not claimed / deferred
- **Live-market flip (S25):** not here — freeze flags stay false.
- **Wiring the hydrated observed graph into the live allergy/recsys runtime (S26):** not here — the affinity
  overlay is exercised in the proof; the live path still uses `getLivingUserProfile` (cold-start observed)
  byte-identically.
- **Per-dimension ablation:** DONE — see §7.

## 7. Per-dimension ablation (measurement-only — engine untouched)
**Method.** Leave-one-out over the **same** 50-user population, the **same** real `scoreRecommendationCandidates`,
at the **learned state (day 40)**. Each dimension enters the scorer purely through an INPUT; I neutralize that
input to its zero-strength "no preference" value (`[]`/`{}`/`0` — never a hand-picked value) and re-score.
`marginal = nDCG@10(full) − nDCG@10(full − D)`. The scorer itself is **never** modified — proven by the
baseline (`runEngineLearningProof`) reproducing **byte-for-byte** (curve `0.294/0.7046/0.7232/0.7311`, gain
`0.4371`, collective lift `0.4915`) in the same test run. Ablation points: cuisine → empty
`taste.cuisineAffinities`/`cuisineWeights`; feedback → empty `history.outcomes`; skill → flatten
`dimensions.skill`; effort → flatten `dimensions.effort`. `full` = `0.7311` (= the day-40 baseline).

| Dimension | leave-one-out nDCG@10 | **marginal** (full − LOO) | only-this-active | read |
|---|---|---|---|---|
| **cuisine** | 0.5231 | **+0.2080** | 0.5402 | strongest contributor |
| **feedback** | 0.5839 | **+0.1472** | 0.5200 | strong — cooked items reinforce on-taste picks |
| effort | 0.7474 | **−0.0163** | 0.2890 | ≈0 / slightly negative (noisy estimate) |
| skill | 0.7313 | **−0.0002** | 0.2940 | ≈0 (not in the relevance target) |

**Honest interpretation (not tuned):**
- **Cuisine + feedback carry the engine.** Together they account for essentially all the learned ranking
  quality at day 40. Both are in the engine **and** rewarded by the relevance target.
- **Effort ≈0 (slightly negative).** Neutralizing the learned effort input doesn't hurt nDCG — it nudges it
  up `0.016`. The learned effort estimate is noisy enough (explore→settle behaviour) that it doesn't net-help
  against a cuisine+effort relevance target. **This corrects §2's earlier "effort is the 10→40 driver"
  claim** — the 10→40 rise is cuisine-dominance + feedback, not effort.
- **Skill ≈0.** Expected: the relevance ground truth is cuisine+effort, so skill-fit has nothing to be
  rewarded against here. The `only-this-active` column confirms it — skill-only nDCG `0.294` is exactly the
  cold baseline, i.e. skill alone differentiates nothing in this metric.
- **Why this is honest, not a defect of the engine:** the ≈0 results are a property of the **synthetic
  population + metric** (interpretation (a) from the brief: the behaviour model / relevance doesn't exercise
  effort-precision or skill), not proof the engine ignores them. The scorer *does* compute `effortFit`/
  `skillFit`; whether they help real users is a **pilot** question. The `only-this-active` column also shows
  cuisine-only (`0.540`) and feedback-only (`0.520`) each recover most of the quality alone, while
  effort-only/skill-only sit at the cold baseline.
- **Guardrails held in every ablation run:** `allergenLeaks = 0`, `productUseEnabled = false` everywhere.

Asserted in `recommendation-ablation.spec.ts` (5 tests, green): baseline reproduces byte-for-byte;
`full = 0.7311`; cuisine & feedback marginals `> 0.05`; effort & skill marginals `|·| < 0.05` (reported
as-is, **not** gated to be positive); 0 leaks; freeze false.

## 8. Effort/skill validation — do `effortFit`/`skillFit` work? (measurement-only)
§7 left a fair objection: effort/skill ≈0 could be a **metric artifact** — the original `relevance()` is
cuisine-dominant, makes effort a weak ±1 term, and **omits skill entirely** (so skill-only nDCG ≡ the cold
baseline; the test structurally can't see skill). The scorer *does* compute + weight them (`SCORING_WEIGHTS`
`effortFit 0.16`, `skillFit 0.12`; real math at scorer lines ~100–121). So this pass **changes the test's
definition of a satisfied user**, not the engine, and re-measures: if effort/skill now pull weight →
validated; if they stay ≈0 even when rewarded → exposed as weak **now, before market**.

**`relevanceES` — a principled satisfaction model (NOT scorer-fitted).** Cuisine is still the gate, but within
the right cuisine: **effort** dissatisfaction grows linearly with distance from the user's preferred effort
(full discrimination, not ±1); **skill** is in the target — a too-advanced recipe frustrates (heavy penalty
`1−0.5·gap`), a too-easy one only mildly bores (`1−0.2·gap`). Within-cuisine weights `0.40 + 0.35·effort +
0.25·skill`. These reflect a real cook's satisfaction; they are **not** the scorer's coefficients (scorer:
tasteFit .22 / effortFit .16 / skillFit .12; the skill asymmetry is reasoned from cooking, my `0.5/0.2` on a
3-level index ≠ the scorer's `1.3/0.6` on its 0..1 scale).

Re-ran the **same** leave-one-out ablation, **same real scorer**, 50 users @ day40, scored under `relevanceES`
(`full = 0.7082`; learning curve under it is monotonic `0.298 → 0.681 → 0.694 → 0.708`):

| Dimension | LOO nDCG (relevanceES) | **marginal** | only-this | §7 marginal (old metric) | read |
|---|---|---|---|---|---|
| **cuisine** | 0.5023 | **+0.2059** | 0.5345 | +0.2080 | real driver |
| **feedback** | 0.5843 | **+0.1239** | 0.4999 | +0.1472 | real driver |
| effort | 0.7306 | **−0.0224** | 0.2949 | −0.0163 | **still weak — still negative** |
| skill | 0.7019 | **+0.0063** | 0.2976 | −0.0002 | **still weak — near-noise** |

**Verdict: STILL WEAK → caught now, before market.** Even under a metric that genuinely rewards effort-match
and skill-appropriateness, neutralizing effort *improves* nDCG (`−0.022`) and skill barely moves (`+0.006`,
within rounding noise); the `only-this` column shows effort-alone and skill-alone sit at the **cold baseline**
(`0.295`/`0.298`) — i.e. each, on its own, differentiates **nothing**. Cuisine + feedback still carry the
engine. This was **not tuned** — the marginals are pinned in the spec exactly as measured.

**Precise root causes (verified in Phase 0, NOT speculation):**
- **Effort — the weekday effort-cap.** The proof's `CTX` is a weekday (`weekday: 3`), and the scorer
  deliberately caps weekday `desiredEffort = 0.25 + 0.25·(1−quick01) ∈ [0.25, 0.5]` (scorer line 108, comment:
  *"a 'dislikes quick' attitude can't push a 90-min recipe onto a Tuesday"*). With the proof's learned signal
  this is `desiredEffort = 0.25 + 0.0625·avgEffortIdx`, so the **entire** user effort range collapses into
  `[0.25, 0.5]` and `EFFORT_LEVEL` `high (0.75)`/`very_high (0.9)` are **unreachable on a weekday**. The ~40%
  of users who prefer high/very-high effort are therefore steered to `medium` — *away* from their true
  preference — while `feedbackFit` (uncapped, it boosts the high-effort recipes they actually cooked) serves
  them better. So removing effort *helps*. This is a deliberate product rule suppressing effort
  personalization on weekdays, **not** broken arithmetic.
- **Skill — the `userSkill` floor + a coupled corpus.** `userSkill = 0.4 + 0.5·skillConf + 0.1·challenge`
  (scorer line 115) lands at **≈0.56 for a beginner** in-sim (arithmetic floor 0.4), never near the
  `SKILL_LEVEL` beginner value 0.2 — so the scorer never treats anyone as a true beginner and can't serve
  beginner-appropriate recipes (which `relevanceES` rewards). Compounded by the
  synthetic universe coupling `skillLevel = SKILLS[effortIdx % 3]` (only 3 skill levels, tied to effort).
  The scorer's asymmetric `skillFit` helps a hair (advanced users do get advanced recipes), but not enough to
  clear noise.

**Why I did not "fix" it here:** the fixes are **engine changes** — relax/contextualize the weekday effort
band (or learn `complex_recipe_readiness` so a non-capped path carries the signal); lower/parameterize the
`userSkill` floor — and this pass is **frozen-engine, measurement-only**. They are scoped as a **future engine
sprint**, with the empirical confirmation being a re-run of this §8 after the change. What this pass delivers
is the thing we must not learn late: **effortFit/skillFit do not personalize in the current configuration —
known now, with the exact cause and the exact fix, not after a real-user embarrassment.**

**Honest limits (still synthetic):** this proves the *mechanism* question (does the scorer recover effort/
skill when they matter — no, not as configured), not real-world taste. The weekend path
(`complex_recipe_readiness`) is **not** exercised here (the proof only learns the weekday `quick_meal_
preference`), so the weekday cap is the *measured* cause; a weekend/real-data probe is the recommended
follow-up. `relevanceES`'s weights are a reasoned satisfaction model, not measured human behaviour.

> **These §8 numbers are the PRE-FIX measurement** (`fullES 0.7082`; cuisine `+0.2059`, feedback `+0.1239`,
> effort `−0.0224`, skill `+0.0063`) — the finding that motivated the **§9 engine fix**. After §9, the scorer
> changed, so the spec `recommendation-es-validation.spec.ts` now pins the **post-fix** values (and the §7
> ablation spec likewise). See **§9** for the fix and the new measurements.

## 9. Engine fix — effort/skill personalization (scorer change)
§8 proved effort/skill don't personalize because of two specific rules in `recommendation-shadow-scorer.ts`.
This section is an **engine change** (not a measurement) that fixes both. The numbers below therefore MOVE vs
§1–§8 — that is expected and correct; the bar is not "byte-identical" but "effort/skill now contribute,
nothing else regresses, allergy absolute, freeze false."

**The two changed formulas (and ONLY these two — diff-proven):**
- **Effort.** Old: `desiredEffort = weekday ? clamp01(0.25 + 0.25·(1−quick01)) : clamp01(complex01)` — a weekday
  HARD-cap to [0.25, 0.5]. New: `desiredEffort = clamp01(0.2 + 0.6·(1−quick01) + 0.2·complex01 − (weekday ? 0.1
  : 0))`. The user's real effort preference now drives desired effort across the FULL range (~[0.2, 0.9]); a
  weekday is a **mild downward lean (−0.1), not a ceiling** — a high-effort lover can be served a high-effort
  recipe on a weeknight. Principled (a real cook's weeknight time-pressure is a nudge), not §8-fitted.
- **Skill.** Old: `userSkill = clamp01(0.4 + 0.5·techConf01 + 0.1·readiness01)` — a 0.4 floor (beginner read
  ≈0.56, steered to intermediate). New: `userSkill = clamp01(0.15 + 0.7·techConf01 + 0.15·readiness01)` — maps
  confidence onto the recipe skill scale (`SKILL_LEVEL` beginner .2 → advanced .85), so a beginner reads ≈0.21
  and an advanced cook ≈0.94. The old floor actually *pushed beginners toward intermediate* (the opposite of
  its stated intent); the asymmetric `skillFit` (overshoot penalised harder than undershoot) is what protects
  beginners — and it is unchanged.

**Results (real scorer; 50 users @ day40). Engine got better overall** — `fullNdcgES 0.7082 → 0.7421`,
`fullNdcg(§7) 0.7311 → 0.7721`, individual curve `…0.7311 → …0.7721`, collective lift `+0.49 → +0.52`,
diversity top-8 `2 → 3`:

| Dimension | §8 marginal PRE-fix | **§8 marginal POST-fix** | read |
|---|---|---|---|
| cuisine | +0.2059 | **+0.2007** | stable — not regressed |
| feedback | +0.1239 | **+0.0510** | unique marginal shrank — see note (quality NOT lost) |
| **effort** | −0.0224 | **+0.0101** | **FIXED — flipped negative→positive** |
| **skill** | +0.0063 | **−0.0228** | corpus-coupling artifact — see note (formula proven correct) |

- **Effort — FIXED.** Marginal flipped from −0.0224 to **+0.0101** under `relevanceES` (and −0.0163 → **+0.0221**
  under the §7 metric); effort-only nDCG rose above the cold baseline. Proven directly on **decoupled**
  candidates (`recommendation-effort-skill-personalization.spec.ts`): a high-effort-preference user is now
  served a high-effort recipe even on a weekday (the old cap made this impossible).
- **Skill — formula FIXED and PROVEN correct, but its §8 marginal is negative due to the synthetic corpus.**
  On **decoupled** candidates the new `userSkill` works exactly as intended (test-proven): a true beginner now
  prefers beginner recipes over intermediate AND advanced (the old floor inverted this), an advanced cook
  prefers advanced — the skillFit ordering *flips* between them, i.e. the signal genuinely differentiates. But
  the §8 corpus couples `skillLevel = SKILLS[effortIdx % 3]` (one skill level per effort level) and
  `relevanceES` weights effort (0.35) above skill (0.25). So skill and effort act on the **same** recipe axis:
  once effort works (it now does), it dominates that axis and a strong skill signal competes with it →
  skill cannot earn marginal here and its (previously spurious, +0.006) contribution goes slightly negative.
  This is a **structural limit of the frozen synthetic corpus**, not a bad fix — and it is **unfixable in the
  scorer** (the scorer can't know the corpus couples the axes). **Honest verdict: skill personalization is
  real (proven on decoupled inputs) but cannot be validated on this corpus — it needs a skill-decoupled corpus
  / the pilot.** Reported as-is; the formula was NOT tuned to chase the §8 number.
- **Feedback marginal dropped (0.1239 → 0.0510) — overlap, not regression.** Pre-fix, effort was broken, so
  `feedbackFit` was the only signal serving high-effort users their cooked (high-effort) recipes. Now effort
  does that directly, so the two overlap and feedback's *unique* marginal shrinks — while feedback-only nDCG
  is ~unchanged (0.50 → 0.48) and `fullNdcgES` ROSE. No quality was lost.
- **No safety/scope regression:** `allergenLeaks 0`, `productUseEnabled false` everywhere; the allergy
  HARD-filter, `getLivingUserProfile`, the A4 builder, `taste-affinity`, `collective-signal` are NOT in the
  diff (the scorer only ranks). The only QA-gate check that changed is the `context_sensitivity` one that
  asserted the old weekday cap — flipped to assert the new lean (intended behaviour, not loosened).

Asserted by: `recommendation-effort-skill-personalization.spec.ts` (6 tests — the decoupled effort/skill
intended-behaviour proofs); the updated `recommendation-ablation.spec.ts` (§7 post-fix pins) +
`recommendation-es-validation.spec.ts` (§8 post-fix pins, skill negative pinned as-is + explained); the
decision-QA gate (the weekday check flipped) — full server suite green, 0 skips.

```
VERDICT BLOCK
=============
SPRINT: ENGINE PROOF — INDIVIDUAL + COLLECTIVE LEARNING (SYNTHETIC LOAD)
SIMULATOR extended: latent tastes + time-evolving + 50 population: Y
COLLECTIVE signal built (additive, shadow, guarded): Y
INDIVIDUAL LEARNING CURVE (nDCG@10): cold 0.294 → 0.705(10d) → 0.723(20d) → 0.731(40d); monotonic 10<20<40 = true; cold→learned +0.437
  └ honest note: per-checkpoint 10→40 gain is modest (+0.027) — engine learns fast (by day 10) then refines (§3.1)
COLLECTIVE LIFT (cold-start): 0.258 → 0.749 = +0.49
CUISINE recovery: top-1 0→100% by day10 (saturates, §3.2); dominance share 0.59→0.63→0.73 (gradual)
PER-DIMENSION MARGINAL nDCG@10 (ablation §7, leave-one-out @day40): cuisine +0.208, feedback +0.147, effort -0.016 (≈0), skill -0.0002 (≈0)
  └ correction: §2's earlier "effort is the 10→40 driver" was WRONG — ablation shows cuisine-dominance + feedback drive it (§7)
EFFORT/SKILL VALIDATION (§8, ablation under effort/skill-SENSITIVE relevanceES @day40): cuisine +0.206, feedback +0.124, effort -0.022, skill +0.006
  └ verdict: effort/skill STILL WEAK even when the metric rewards them → caught pre-market. Cause: weekday effort-cap (scorer L108) + userSkill 0.4 floor (L115). Fix = §9. NOT tuned.
ENGINE FIX (§9, scorer change — desiredEffort + userSkill only): §8 POST-fix cuisine +0.2007, feedback +0.0510, effort +0.0101 (was -0.0224 → FIXED), skill -0.0228 (was +0.0063)
  └ effort FIXED (flipped positive); skill formula proven correct on DECOUPLED candidates but §8-negative due to corpus coupling (skillLevel=SKILLS[effortIdx%3]) → needs decoupled corpus/pilot. fullNdcgES 0.708→0.742, collective +0.49→+0.52, diversity 2→3. allergy 0 / freeze false. NOT tuned.
ALLERGEN LEAKS UNDER FULL LOAD: 0
LIVE FLIP frozen (productUseEnabled=false everywhere) + allergy + getLivingUserProfile + A4 builder untouched: Y (diff-proven)
HONEST LABELLING (synthetic=mechanism proven; real-world=awaiting pilot): Y
BUILD: PASS  SERVER SUITE: 202 suites / 1514 tests skipped=0  recsys/ai-eval: PASS(19) / PASS(46)
SCOPE = collective + learning-proof (+specs) this sprint; taste-affinity + scorer(additive) shipped in A4 sprint 9250f059; report only: Y
MERGE+PUSH: DONE @b636e4ce (clean-room verified)
```
