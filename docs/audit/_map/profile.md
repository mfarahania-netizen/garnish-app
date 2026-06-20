# FORENSIC AUDIT: User Profile + Taste Personalization

**Slice:** User profile + taste (declared → reconciled → living profile)

## QUICK FACTS

- **Declared prior cap:** 0.20 max contribution to maturity
- **Observed weight:** 0.80 (behavior drives real growth)
- **Allergies:** NEVER overwritten by behavior (declared_safety precedence)
- **Taste corrections:** Reversible, locked against inferred overwrites
- **Cold-start:** Honest, no fabrication
- **Frozen:** Shadow-mode only, not wired to runtime

## KEY FILES

### Declared Profile
- living-profile.ts (lines 63-74): maturity formula = min(0.2, cov*0.3) + obs*0.8
- declared-profile.builder.ts (lines 72-158): buildDeclaredProfile() with recency decay
- declared-dimension-registry.ts: 24 dimensions (age_range, dietary.pattern, allergies, etc.)

### Observed Layer
- user-food-identity-graph.builder.ts (lines 55-180): buildUserFoodIdentityGraph() from SignalObservations
- profile-dimension-aggregation.ts: buildTaste(), buildEffort(), buildSkill(), etc.
- 11 dimensions: taste/effort/skill/routine/recommendation/notification/planner/grocery/aiInteraction/onboardingColdStart/safetyBoundaries

### Reconciliation
- profile-reconciliation.ts (lines 62-198): reconcileProfile(declared, observed)
- 4 reconciled dims: dietary_pattern, allergies (SAFETY-CRITICAL), effort, skill
- **GUARANTEE:** allergies precedence=declared_safety, reconciledValue=ALWAYS declared set

### Living Profile
- living-profile.ts (lines 128-155): composeLivingUserProfile() unifies all three layers
- maturityFor(): overallScore = min(0.2, cov*0.3) + obs*0.8
- Bands: <0.1=empty, 0.1-0.35=forming, 0.35-0.7=developing, ≥0.7=mature

### Taste Correction
- taste-correction.service.ts (lines 47-121): listTastePreferences(), correctTastePreference()
- signal-calculator.service.ts (lines 181-209): **CRITICAL upsertIngredientSignal() guard**
  - If existing.signalType==ingredient_correction, RETURN (never overwrite user correction)
- ingredient-salience.ts: IDF-based salience, √K attribution

### Food DNA
- profile-read.service.ts (lines 136-154): getFoodDnaProjection() hydrates from real signals
- food-dna-projection.ts (lines 69-115): projectFoodDna() PII-free projection
- page.jsx: FoodDnaRing + dimension cards + TasteSection + question
- useFoodDna.js: React hook, queries /profile/dna, /profile/taste, /profile/answer

## API ENDPOINTS (profile.controller.ts)

GET /profile → LivingUserProfile v2
GET /profile/dna → FoodDnaProjection (S2 activation)
GET /profile/next-question → onboarding Q
POST /profile/answer → persist answer
GET /profile/taste → TastePreference[]
POST /profile/taste/correct → update one ingredient stance

## MATURITY FORMULA (CRITICAL)

```
declaredPrior = min(0.2, declaredCoverage * 0.3)  // declared-only ≤ 0.20
observed = min(1, observedConfidence)
overallScore = min(1, declaredPrior + observed * 0.8)  // 0.80 weight on observed
```

Bands:
- < 0.1: empty
- 0.1–0.35: forming (cold-start, fully-declared)
- 0.35–0.7: developing (behavior growing)
- ≥ 0.7: mature (strong behavioral signal)

## DECLARED DATA FLOW

UserFact (key=declared.*) ← declared-profile.builder.ts
UserPreference (diet, skillLevel, budget) ← profile-read.service.ts
UserAllergy → user_allergy flow (safe-fact guard, never declared path)
ConsentLog → getConsentState()

## OBSERVED DATA FLOW

SignalObservation → loadObservations(rebuild) → buildUserFoodIdentityGraph(obs, mode=offline_eval) → getFoodDnaProjection()
Note: getLivingUserProfile uses mode=shadow + empty obs for cold-start (allergy safety)

## THREE-LAYER ALLERGY SAFETY GUARANTEE

1. Reconciliation: precedence=declared_safety, reconciledValue=ALWAYS declared allergens
2. Signal calculator: if signalType==ingredient_correction, never modify
3. AI GroundedReplyService: reads profile.reconciled.dimensions.allergies before surfacing recipes

## FROZEN FOR PRODUCT USE

All 11 observed dimensions have downstreamReadiness.safeForProductUse=false
Limitations: "NOT persisted, NOT wired into runtime, NOT product-enabled"
Mode handling:
  - getLivingUserProfile: mode=shadow + empty observations (cold-start)
  - getFoodDnaProjection: mode=offline_eval + real persisted observations (activation screen only)

## CONSTANTS & THRESHOLDS

Declared:
  BASE_CONFIDENCE=0.85, STALE_THRESHOLD=0.4, half-lives=365-1825 days

Maturity:
  DECLARED_PRIOR_CAP=0.20, OBSERVED_WEIGHT=0.80
  FORMING_CEILING=0.35, DEVELOPING_CEILING=0.70

Taste:
  LIKE_VALUE=0.5, DISLIKE_VALUE=-0.7, SHOW_FLOOR=0.05, MAX_ITEMS=12
  ING_BASE_DELTA=0.15, AFFINITY_CAP=0.6, AVERSION_CAP=1.0
  CONF_FLOOR=0.2, CONF_STEP=0.1

Graph:
  HALF_LIFE=90 days, SALIENCE_TTL=6 hours

