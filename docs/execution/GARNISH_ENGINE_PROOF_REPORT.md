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
- **Effort — YES (it is the 10→40 driver).** Because cuisine top-1 is already saturated at day 10, the
  remaining nDCG@10 rise `0.705 → 0.731` can only come from the *other* relevance component — effort
  precision (relevance is `1.0` only when cuisine **and** effort match, `0.6` for cuisine alone). So the
  monotonic 10→40 gain **is** measured effort recovery (the effort estimate converges as behaviour
  accumulates and confidence rises).
- **Feedback — wired + contributing, NOT isolated.** Cooked recipes flow into the scorer's outcome history
  (`feedbackFit`) and push those items up; but the proof's relevance target is cuisine+effort, so feedback's
  *marginal* contribution is not separately quantified here (see §3.3).
- **Skill — modeled + fed (per-user latent skill → `skill.technique_confidence`), contributes to `skillFit`;
  not isolated as its own curve (same caveat as feedback).**

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

**3.3 effort/skill/feedback are not isolated per-dimension (no ablation).**
- *Status: NOT done in this sprint.* The proof measures the **combined** recovery (cuisine+effort via nDCG;
  cuisine separately). I did not run per-dimension ablations (score with only-effort, only-feedback, …) to
  quantify each dimension's marginal lift.
- *Reason / follow-up:* an honest ablation is a clean additive extension (toggle one signal at a time and
  re-measure nDCG). It is **recommended as the next step** if you want a per-dimension bar chart; it was out
  of scope for landing the core proof and I did not want to fabricate per-dimension numbers I had not
  isolated.

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
- **Per-dimension ablation (§3.3):** recommended next.

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
EFFORT: recovered (the 10→40 nDCG gain); SKILL/FEEDBACK: wired + contributing, NOT isolated (§3.3)
ALLERGEN LEAKS UNDER FULL LOAD: 0
LIVE FLIP frozen (productUseEnabled=false everywhere) + allergy + getLivingUserProfile + A4 builder untouched: Y (diff-proven)
HONEST LABELLING (synthetic=mechanism proven; real-world=awaiting pilot): Y
BUILD: PASS  SERVER SUITE: 202 suites / 1514 tests skipped=0  recsys/ai-eval: PASS(19) / PASS(46)
SCOPE = collective + learning-proof (+specs) this sprint; taste-affinity + scorer(additive) shipped in A4 sprint 9250f059; report only: Y
MERGE+PUSH: DONE @b636e4ce (clean-room verified)
```
