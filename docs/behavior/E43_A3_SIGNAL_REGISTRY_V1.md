# E43-A3 — Signal Registry v1 + SignalObservation Engine

> The first behavioral-interpretation layer: canonical/shadow events → typed signal observations →
> registry (confidence / evidence / decay / privacy / explainability). Pure, deterministic, auditable,
> and safe. This is a FOUNDATION — it does not complete BIP v1.

## 1. Current reality
- Event Envelope contract (E43-A1) + taxonomy contract + runtime guard (E43-A2) are merged.
- A legacy `SignalRegistryService` (`signal.registry.ts`) and Prisma models (`SignalObservation`,
  `UserBehaviorSignal`, snapshots, `UserFeatureVector`) already exist.
- E43-A3 adds an **additive**, richer v1 layer (hyphenated `signal-*.ts`) that is **pure** — it writes
  nothing to the DB. **No migration was added.**

## 2. What SignalObservation v1 IS
- A deterministic function `extractSignalObservations(events, options)` turning canonical events into
  typed `SignalObservation` records, each with: value, strength (−1..1), confidence (0..1), evidence
  (count + eventIds + source eventTypes), recency/consistency/frequency scores, privacy class, consent
  purpose, retention policy, a safe explanation, and limitations.
- A typed, guarded `SIGNAL_REGISTRY` (44 signals across 10 families) with per-signal confidence policy,
  allowed sources, and forbidden inferences.
- A transparent confidence model and a 103-check offline QA gate.

## 3. What it is NOT
- NOT BIP v1 completion. NOT a UserFoodIdentityGraph. NOT a prediction model. NOT a recommendation /
  notification / AI-personalization change. NOT wired into runtime. NOT persisted. NOT medical/
  diagnostic/strict-diet inference. NOT a protected/sensitive-attribute labeler. NOT a product rollout.

## 4. Signal registry table (44 signals)
| Family | Signals |
|---|---|
| taste | ingredient_affinity, ingredient_avoidance, cuisine_affinity, cuisine_exploration, flavor_pattern, repetition_preference |
| effort | quick_meal_preference, low_prep_tolerance, complex_recipe_readiness |
| skill | cook_completion_growth*, recipe_step_dropoff, technique_confidence* |
| routine | meal_time_pattern, weekly_planning_pattern, shopping_day_pattern, late_night_decision, weekend_cooking_pattern |
| reco | save_affinity, dismiss_avoidance, click_curiosity, cook_conversion, exposure_fatigue, repeat_success |
| notif | open_affinity, dismiss_fatigue, quiet_hours_inferred, suppression_candidate*, timing_fit* |
| planner | autofill_acceptance, plan_completion_intent, plan_abandonment |
| grocery | merge_preference, list_completion, friction_signal |
| ai | help_seeking_pattern, explanation_depth_preference, feedback_positive, feedback_negative, safety_boundary_trigger*† |
| onboarding | taste_seed, effort_seed, skill_seed, notification_preference_seed*, exploration_seed* |

`*` = `status: planned` (its source events are not yet produced as canonical events; supported offline only).
`†` = `P2-sensitive` (system-boundary event; never a label about the user), `audit-long`.
Each entry declares: `signalKey, family, description, allowedEventFamilies, allowedEventTypes, direction,
valueType, confidencePolicy, privacyClass, consentPurpose, retentionPolicy, forbiddenInferences,
explainabilityTemplate, status`.

## 5. Confidence model (transparent)
`confidence = evidenceSufficiency × recency × weightedQuality`, capped.
- **evidenceSufficiency** saturates at `minEvidenceCount`.
- **recency** = exponential half-life decay (`0.5` at one half-life).
- **weightedQuality** = policy-weighted blend of consistency, frequency, explicit feedback.
- **cap** = 0.95 in v1 UNLESS explicit feedback ≥1 AND evidence ≥ minEvidenceCount → up to 0.99.
Every term is a named, unit-tested function (no black box). Contradictory evidence lowers consistency,
hence confidence.

## 6. Evidence model
Evidence = the validated canonical events that map to a signal (by `allowedEventTypes`). The observation
records `evidenceCount`, sorted `evidenceEventIds` (opaque ids), and de-duped `sourceEventTypes` (safe
enum strings). No raw event payload / user text / AI text is ever stored.

## 7. Privacy / consent rules
- A signal of `consentPurpose=personalization` is emitted ONLY from events with `personalization`
  consent; `analytics` signals accept `analytics`/`personalization`; `core` signals accept any. Consent
  is **never silently fabricated** — incompatible evidence is dropped, and a signal with no compatible
  evidence is not emitted.
- Privacy class is **never downgraded**: if any source event is `P2-sensitive`, the observation is
  `P2-sensitive`.
- `b2b_aggregate` is **not used** by any v1 signal.
- No raw metadata is copied into observations.

## 8. Forbidden inference list
No signal infers/stores: medical diagnosis · treatment need · strict/therapeutic diet plan · pregnancy ·
eating disorder · religion · ethnicity · political belief · sexuality · precise location · mental-health
condition · financial status · criminal/legal status. Food preferences and weak, non-medical lifestyle
intent are allowed. The registry is guarded (`scanForForbiddenSignals`) so a forbidden term can never
appear in a user-facing field; explanations are guarded by `assertSafeExplanation`.

## 9. Event-to-signal mapping (derived from the registry)
| Event | Signal(s) |
|---|---|
| recipe_viewed / recipe_view | reco.click_curiosity, taste.* (seed candidates) |
| recipe_saved / favorite_add / recommendation_save | reco.save_affinity, taste.ingredient_affinity |
| recipe_dismissed / recommendation_dismiss(ed) / not_interested | taste.ingredient_avoidance, reco.dismiss_avoidance |
| cook_complete | reco.cook_conversion, skill.cook_completion_growth (planned) |
| recommendation_impression | reco.exposure_fatigue |
| ai_answer_feedback (rating sign) | ai.feedback_positive / ai.feedback_negative |
| ai_guard_block | ai.safety_boundary_trigger (P2) |
| notif_open / notification_read | notif.open_affinity |
| notif_dismiss / notification_delete | notif.dismiss_fatigue |
| notif_suppressed | notif.suppression_candidate (planned) |
| grocery_item_merged | grocery.merge_preference |
| planner_autofill_accepted / mealplan_add | planner.autofill_acceptance |
| onboarding_answered / preference_update | onboarding.* seeds |

Planned-source events are supported in the offline engine but flagged `status: planned`.

## 10. Remaining integration gaps
- Engine is **pure** — no persistence to `SignalObservation`/`UserBehaviorSignal` yet (staged).
- Not wired into runtime; no recommendation/notification/AI consumption yet.
- No UserFoodIdentityGraph, no prediction layer (out of scope).
- Some signals are `planned` (sources not yet emitted as canonical events).
- Confidence/decay is v1 and intentionally conservative.

## 11. Over-claim prevention
SignalObservation Engine v1 and Signal Registry v1 are **code-backed**. This does **not** complete BIP
v1, create a UserFoodIdentityGraph, change recommendation ranking, enable notification intelligence,
enable AI personalization in product, or enable a voice assistant. **No product rollout. No DB
migration. R3 & R4 remain Mitigating, not Closed.**
