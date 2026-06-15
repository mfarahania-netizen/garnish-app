# GARNISH-PROFILE-L4-05 — Living User Profile (Food DNA): Mature Backend + Data Foundation

> Execution report. Branch `exec/garnish-profile-l4-05` (off master `b4ef76ff`).
> **Backend only — NO visual/display, NO onboarding screens** (display is premature; backend first).
> Maturity stage 1 of a multi-stage plan; the architecture is extensible (stage-2 = add a registry
> entry, no rewrite). Within the Constitution v1.0.1 + Amendment 2.

## Phase 0 — Data foundation (findings first, then the fix)

**Investigation (before changing anything):**
- The server DB importer (`scripts/data/import-ingredients.js` → `scripts/data/ingredient-dictionary.js`)
  **already loads the VERIFIED 1008-item dictionary** (`data/ingredients/phase-one-final/Ingredient
  Dictionary/ingredients_verified_structure_resolver_ready_1008_only_recipe_resolver_alias_patch_00.json`),
  validates exactly 1008 (unique ids/codes), and maps the rich fields (allergens, substitutionOptions,
  taxonomy/category, tasteProfile…) into the `Ingredient` model. So the AI tools (Sprint 1) and the
  profile's taste/safety grounding are **already backed by the 1008 rich dictionary** once imported.
- `packages/shared/data/ingredients.json` (the 124-item `{id,title,searchableTerms}` stub) has **ZERO
  code consumers** — no `import`/`require` anywhere in `apps/`, `packages/`, server scripts, or web
  (`grep` confirmed; the web app does not import it via `@garnish/shared`). It is a **vestigial stub**
  from "Clean start", NOT the runtime source. The premise that the 124-file was the runtime source was
  inaccurate; the real import path was already correct.

**Fix (no fabrication, no new IDs):** `apps/server/scripts/data/build-shared-ingredients.js` projects
all **1008** verified ingredients into the existing `{id,title,searchableTerms}` shape, replacing the
misleading 124-item stub. Every id/title/term is derived from the 1008 dictionary; a `--check` mode
asserts `projectedCount=1008, newIds=0, duplicateIds=0`. **Result: shared file 124 → 1008; 0 new IDs;
importer validation still passes at 1008.** No schema change, no migration.

## Phase 1 — Living profile (declared + observed + onboarding engine), backend-only

### A. Declared dimensions (new, consent-gated, privacy-classed) — `behavior-engine/profile/declared/**`
A SEPARATE pure subsystem from the observed `UserFoodIdentityGraph` (so its 11-dimension QA gate is
untouched). **22 extensible dimensions** across the founder's groups, each with confidence + recency:

- **context:** age_range, gender, work_pattern, income_band, household_composition, cooks_for_count,
  time_at_home, exercise_frequency.
- **dietary (mature):** pattern (omnivore/vegetarian/vegan/pescatarian/flexitarian/mediterranean/keto/
  low_carb/paleo/halal/kosher/custom), allergies_intolerances (with severity), hard_dislikes,
  cultural_constraints.
- **goals:** primary (general/eat_healthier/weight_loss/muscle_gain/more_energy/save_money/save_time/
  learn_cooking/none) — declared goals, **non-medical framing**.
- **history:** dieted_before, researched_nutrition, knowledge_self_rating.
- **constraints:** weekly_budget_band, kitchen_equipment, cooking_skill, cooking_time_workday,
  cooking_time_weekend, meal_timing_rhythm.

The registry guard forces every sensitive dim to **P2-sensitive**, enforces banding for numeric-ish
sensitive dims (age/income/budget/time/cooks_for), and rejects any forbidden medical/protected term in
user-facing text.

### B. Observed signals (extended the existing registry)
Added **11 `status:'planned'` signals** (emission wiring is a later phase — backend contracts now):
`taste.recipe_dwell`, `taste.section_focus`, `taste.repeat_cook`, `taste.explicit_like`,
`taste.unmet_search_demand`, `reco.save_without_cook`, `routine.scroll_velocity`,
`routine.open_time_of_day`, `skill.cookmode_abandonment`, `grocery.list_edit_pattern`,
`ai.question_satisfaction` — each with confidence policy + recency half-life + privacy/consent +
forbidden-inference list. Statuses are taxonomy-grounded so the registry-consistency gate stays green.

### C. Onboarding question engine (backend logic only, NO UI)
`profile/onboarding/**`: a typed question **bank derived from the declared registry** (cannot drift) +
a deterministic `QuestionSelectionService`. Next-question logic: skip dims already known with good
confidence; prioritize **high-value, low-confidence** dims; **never ask a sensitive question without its
required consent purpose**; re-ask dims whose declared value has gone stale. Returns the question + an
explicit `reason`. No screens, no visual flow.

### D. Profile read + uncertainty/coverage
`profile/read/**`: owner-only, consent-aware living profile = declared (owner view) + observed summary
(cold-start until signal hydration — a stage-2 plug-in) + **per-dimension confidence** + an overall
**maturity/coverage score** (band: empty→forming→developing→mature) with trust guidance. Endpoints
(`ProfileController`, jwt, owner-scoped): `GET /profile`, `GET /profile/next-question`,
`POST /profile/answer` — all registered `deferred:E-profile-ui`.

### Privacy / consent handling of sensitive fields
- Sensitive declared data (age/gender/job/income/household/goals/exercise) is **P2-sensitive**,
  **consent-gated** (a dim whose purpose is not granted is `consent_withheld` — never built/exposed),
  stored as **bands/categories** (raw precise values rejected by `validateDeclaredAnswer`), **never
  written to event metadata** (`projectDeclaredForMetadata` excludes sensitive + asserts
  `assertNoPIIInMetadata`), and **omitted from any non-owner read** (`ownerReadView`).
- Persistence respects the existing guard: non-sensitive declared facts → `UserFact` (which still
  enforces its sensitive-key guard — never weakened); diet/skill/budget → `UserPreference`; allergies →
  the dedicated allergy flow (never re-stored through the safe-fact store).
- **No medical/diagnostic/treatment claims** — goals are user-declared preferences framed as guidance.

### Uncertainty / coverage scoring
`composeLivingProfile` blends declared coverage (stated breadth) and observed confidence (behavioral
depth) into `maturity.overallScore` + a band + trust guidance; `perDimensionConfidence` exposes each
declared/observed dimension's confidence so downstream features know how much to trust the profile.

### Extensibility (stage-2 onward)
Add a `def(...)` entry to `DECLARED_DIMENSIONS` (+ a prompt in the question bank) → the dimension flows
automatically through the builder, privacy gate, question engine, read model, and QA gate. Add a
`mk(...)` entry to `SIGNAL_REGISTRY` for a new observed signal. No engine rewrite.

## Clean-install verification (Phase 2, verbatim)

```
$ rm -rf node_modules apps/server/node_modules apps/web/node_modules packages/shared/node_modules  → rm exit=0
$ pnpm install --frozen-lockfile                          → Done in 55.7s ; install exit=0
$ pnpm --dir apps/server exec prisma generate (NOT npx)   → prisma exit=0
$ pnpm build                                              → Tasks: 2 successful, 2 total (26.6s) ; build exit=0
$ pnpm coverage:check
  scanned: models=52 recipeFields=37 endpoints=98(internal 9) routes=17 events=B117/F116
  coverage: mapped=59 internal=15 admin=39 deferred=11 must-render=2 | UNMAPPED=0 UNREGISTERED=0 orphanEndpoints=30 orphanEvents=1
  COVERAGE GATE PASSED. ; coverage exit=0
$ pnpm test
  Test Suites: 151 passed, 151 total
  Tests:       1202 passed, 1202 total ; test exit=0
$ git status --short        (qa artifacts regenerated by tests omitted)
  ?? docs/execution/GARNISH_PROFILE_L4_05_REPORT.md
$ git diff --name-only master | grep -E 'runtime-shadow/|prisma/schema.prisma|migrations?/'
  NONE — runtime-shadow/schema/migration untouched

# ── scope-proof greps ──
runtime ingredient count (importer dictionary): 1008  ok: true
shared ingredients file count: 1008
no-new-ids check: { ok: true, projectedCount: 1008, newIds: 0, duplicateIds: 0 }
privacy gate sensitive-field tests: sensitive_are_p2 · consent_withheld_not_built · metadata_excludes_sensitive
  · nonowner_omits_sensitive · "never asks a sensitive question without consent"
```

## Confirmations
- **Backend-only: display/UI = NONE** (no screens; endpoints registered `deferred:E-profile-ui`).
- **medical-claims = NONE**; **live-AI-default = OFF** (untouched); **runtime-shadow = untouched**;
  **newIngredientIDs = 0**; **no schema migration**.
- **tests:** 151 suites / 1202 tests, **0 skips** (was 147/1176; +4 suites, +26 tests).
- **Coverage gate green** — 3 new endpoints registered `deferred:E-profile-ui`.

## Files added / changed
**Added:** `apps/server/scripts/data/build-shared-ingredients.js`; `behavior-engine/profile/declared/**`
(types, registry, builder, spec, qa-gate spec); `behavior-engine/profile/onboarding/**` (bank,
selection service, spec); `behavior-engine/profile/read/**` (living-profile, service, controller, spec);
`behavior-engine/profile/profile.module.ts`; report + QA artifact.
**Changed:** `behavior-engine/signals/signal-registry.ts` (+11 planned signals); `app.module.ts`
(ProfileModule); `packages/shared/data/ingredients.json` (124→1008); `tools/coverage/coverage.registry.json`;
`docs/coverage/coverage.generated.json`.

## Merge / push
`exec/garnish-profile-l4-05` → `master` via `git merge --ff-only`, pushed to `origin/master` (master
tip = the branch tip; exact hash in `git log` / the hand-off verdict).

## Verdict

```
PROFILE_L4_05 RESULT: PASS
Clean install: build exit 0, coverage:check green, tests Test Suites 151/151, Tests 1202/1202, skips 0
Data foundation: runtime ingredients now=1008 (was 124); newIngredientIDs=0; resolver/dup-check=pass
Declared dimensions added: context(age_range,gender,work_pattern,income_band,household_composition,cooks_for_count,time_at_home,exercise_frequency), dietary(pattern,allergies_intolerances,hard_dislikes,cultural_constraints), goals(primary), history(dieted_before,researched_nutrition,knowledge_self_rating), constraints(weekly_budget_band,kitchen_equipment,cooking_skill,cooking_time_workday,cooking_time_weekend,meal_timing_rhythm) — 22 total
Observed signals added/confirmed: taste.recipe_dwell, taste.section_focus, taste.repeat_cook, taste.explicit_like, taste.unmet_search_demand, reco.save_without_cook, routine.scroll_velocity, routine.open_time_of_day, skill.cookmode_abandonment, grocery.list_edit_pattern, ai.question_satisfaction (11, status 'planned')
Onboarding question engine (backend, no UI): built — bank (registry-derived) + QuestionSelectionService + GET /profile/next-question, POST /profile/answer; NO screens
Profile read + uncertainty/coverage score: built — GET /profile (owner-only, declared+observed, maturity band + per-dim confidence)
Privacy/consent: sensitive fields (age/gender/job/income/household) consent-gated + P2 + banded + PII-safe (assertNoPIIInMetadata) + non-owner-omitted = yes, tests
Boundaries: display/UI=NONE, medical-claims=NONE, live-AI-default=OFF, runtime-shadow=untouched
Coverage gate: green (new endpoints registered deferred:E-profile-ui=3)
Extensibility: stage-2 dimensions plug in via a single DECLARED_DIMENSIONS def(...) entry (+ question prompt) — flows through builder/privacy/engine/read/QA with no rewrite
Merge/push: exec/garnish-profile-l4-05 → master (ff-only + pushed)
Verdict: PROFILE_L4_05_PASS
```
