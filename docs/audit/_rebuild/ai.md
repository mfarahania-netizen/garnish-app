# AI Subsystem Architectural Audit (GARNISH-E47)

## 1. What It Is

**AI Subsystem** (Constitution E47): A bounded, guardrailed, grounded conversational assistant for Persian cooking guidance. Not a generic chatbot, NOT autonomous, NOT medical/diet advice, does NOT use live LLMs by default.

### Core Files & Structure

- **apps/server/src/ai/ai.controller.ts** — HTTP entry point (POST /ai/chat)
- **apps/server/src/ai/orchestrator/ai-orchestrator.service.ts** — THE SINGLE ENTRY POINT for all AI calls; routes through mandatory snapshot → guards → model → logging
- **apps/server/src/ai/chat/chat-orchestration.service.ts** — Chat surface; builds snapshot, routes to orchestrator, applies allergy-safe deterministic reply or live output
- **apps/server/src/ai/chat/grounded-reply.service.ts** — **HARD ALLERGY GATE**; reads getLivingUserProfile(), filters recipe corpus, never surfaces unsafe recipes
- **apps/server/src/ai/assist/ai-assist.service.ts** — Bounded tools (substitutions, pantry-match, pairings, technique); each calls: snapshot → guard → single tool → nutrition guard
- **apps/server/src/ai/context/behavioral-context-snapshot.service.ts** — Reads ONLY non-sensitive prefs (diet/skill/budget); NO allergies, NO health inference
- **apps/server/src/ai/guards/** — prompt-injection.guard, ai-safety.guard, nutrition-claim.guard
- **apps/server/src/ai/tools/** — get-user-food-context.tool, search-recipes.tool, suggest-substitutions.tool, match-pantry-recipes.tool, suggest-pairings.tool, explain-recipe-step.tool, grounding-utils.ts
- **apps/server/src/ai/providers/model-provider.factory.ts** — Pluggable provider (stub by default; Gemini when enabled)
- **apps/web/src/app/assistant/page.jsx** — React UI: empty state, message thread, composer, disclosure header
- **apps/web/src/app/assistant/useAssistant.js** — Hook: POST /ai/chat, tracks feedback, manages thread state

Key Contracts:
- **BehavioralContextSnapshot** (ai-core.types.ts:8-25): userId, generatedAt, locale, preferences (non-sensitive), signals (empty), dataMaturity
- **LivingUserProfile** (living-profile.ts:105-122): version 2; unifies declared + observed + reconciled allergies + maturity
- **ReconciliationResult** (profile-reconciliation.ts:38-45): cross-layer agreement/conflict with safetyAlwaysRespected guarantee
- **GroundingResult** (grounded-reply.service.ts:56-63): safeRecipes (filtered), unsafeTitles (dropped), groundingStatus

---

## 2. What It READS from the Shared Foundation (L0)

### Critical Path: getLivingUserProfile → Allergy Safety

Every time the AI surfaces a recommendation (deterministic reply, live model prompt, safety output gate), it MUST call:

    const profile = await this.profiles.getLivingUserProfile(userId);

This returns LivingUserProfile containing:
- econciled.dimensions.allergies.reconciledValue — the SAFETY-CRITICAL declared-allergy set
- econciled.dimensions.dietary_pattern.reconciledValue — declared dietary restrictions
- econciled.dimensions.effort.reconciledValue — cooking time preference
- observed — UserFoodIdentityGraph summary (confidence, strongestDimensions, weakestDimensions)
- maturity — overall profile maturity (band: empty/forming/developing/mature)

**File:** apps/server/src/behavior-engine/profile/read/profile-read.service.ts:103-118

### On Failure: AI Surfaces NOTHING

If getLivingUserProfile() throws or returns null, the AI surfaces NOTHING (unsafe_set_unavailable):

**File:** grounded-reply.service.ts:88-94

    let profile: unknown;
    try {
      profile = await this.profiles.getLivingUserProfile(userId);
    } catch (err) {
      this.logger.warn('living profile unavailable; surfacing nothing...');
      return this.emptyResult('unsafe_set_unavailable', 0);
    }
    if (!profile) return this.emptyResult('unsafe_set_unavailable', 0);

### The HARD Allergy Gate (Recipe Filtering)

**File:** grounded-reply.service.ts:111-127

    for (const id of ids) {
      const r = byId.get(id);
      const derived = analyzeRecipeIntegrity(r).derivedAllergens.allergens;
      const fit = assessRecipeFit(r, profile, derived);  // REUSES recommendation's logic
      if (fit.recommendation === 'avoid_allergen') {
        dropped += 1;
        unsafeTitles.push(r.title);
        continue;  // NEVER surfaces a recipe with declared allergen conflict
      }
      safe.push({ id, title, cookingTime, difficulty, fit });
    }

This uses the SAME assessRecipeFit() function that the recommendation engine uses:

**File:** apps/server/src/recipes/intelligence/recipe-fit.ts:82-136

Contract: profile.reconciled.dimensions.allergies.reconciledValue

Check: Any overlap between recipe allergens (declared ∪ derived) and profile's reconciled allergies → avoid_allergen (HARD DROP, never surfaced)

### What the AI NEVER Reads from L0
- ❌ Sensitive demographics (age, income, weight, blood pressure, BMI, pregnancy)
- ❌ Health conditions (diabetes, cholesterol, arthritis, anxiety)
- ❌ Medication/supplement info
- ❌ PersonalizedSignals (behavior engine's private observed graph)
- ❌ Recommendation scores or candidate-generator rankings

---

## 3. What It WRITES

### Persisted Outputs

1. **ChatMessage** (chat-message.service.ts)
   - Rows: { userId, conversationId, role ('user'|'assistant'), content, model, contentSafetyStatus, aiCallLogId }
   - Used for: thread continuity, analytics

2. **AICallLog** (ai-call-log.service.ts)
   - Rows: EVERY call (ok / blocked / error)
   - Fields: userId, model, provider, status, latencyMs, estimatedInputTokens, estimatedOutputTokens, estimatedCost, totalTokens, usageSource, costIsEstimated, guardHits, toolCalls, metadata, errorCode, errorMessage
   - Purpose: cost audit, safety audit, debugging

3. **Implicit Feedback** (optional)
   - Web analytics event: trackEvent('ai_feedback', { vote: 'up'|'down' }) when user rates a reply

### No Writes to Foundation
- ❌ Does NOT call recommender, ranking, or signal processors
- ❌ Does NOT update user profile or preferences
- ❌ Does NOT persist signals (behavior engine's domain)
- ❌ Does NOT modify allergy set or dietary preferences

---

## 4. Hard Dependencies on the Foundation

### Dependency #1: Living Profile (L0 → L3/L4) — CRITICAL BLOCKER

If the foundation cannot provide getLivingUserProfile(), the AI subsystem:
- ❌ Cannot establish the safe allergy set
- ❌ Cannot filter recipes by declared allergies
- ❌ Must surface nothing (unsafe_set_unavailable)
- ❌ Cannot personalize (all replies generic, or degrade to "profile unavailable")

**File:** grounded-reply.service.ts:84-94 — This is the fail-closed gate.

**What Must Exist First:**
1. ProfileReadService.getLivingUserProfile(userId) — must load and compose declared + observed profile
2. UserFact, UserPreference, UserAllergy tables — persisted declared data
3. ConsentLog table — consent state
4. UserFoodIdentityGraph builder — existing recommendation's observed layer
5. SignalObservation rows — (optional, cold-start works; enables maturity progression)

### Dependency #2: Recipe Corpus (L0 → L3) — HIGH

The AI retrieves recipes from the database and filters them. If the recipe corpus is missing:
- ❌ No candidates to filter
- ❌ Grounding returns empty (empty status → honest "no match found" reply)

**Files:**
- Recipe retrieval: search_recipes tool (apps/server/src/ai/tools/search-recipes.tool.ts)
- Recipe filtering: assessRecipeFit() + analyzeRecipeIntegrity() (apps/server/src/recipes/intelligence/recipe-fit.ts + recipe-integrity.ts)
- Prisma query: prisma.recipe.findMany({ where: { isPublic: true, ... }, select: FIT_SELECT })

**What Must Exist First:**
1. Recipe table — id, title, allergens (declared), ingredients, categories, difficulty, cookingTime, diet, isPublic
2. Ingredient table — with allergens (derived via dictionary)
3. RecipeIngredient junction
4. Allergy / AllergenDictionary — allergen definitions

### Dependency #3: Behavioral Context (L0 → L2) — MEDIUM

The orchestrator requires a valid BehavioralContextSnapshot for every call. If the snapshot builder fails:
- ❌ Orchestrator throws MissingBehavioralContextError
- ❌ Chat returns a safe "unavailable" message
- ❌ No model call, no tool execution, no personalization

**File:** behavioral-context-snapshot.service.ts:20-46

Reads UserPreference for (diet, skillLevel, budget) — all non-sensitive
Reads are best-effort; missing data degrades to minimal snapshot but never fails

**What Must Exist First:**
1. UserPreference table — with (diet, skillLevel, budget)
2. ConsentLog table — consent state

### Why Rebuilding Before the Foundation Causes Rework

The AI subsystem's **entire safety contract** rests on:
1. **Receiving a valid, accurate living profile** — so it can filter recipes by the real, reconciled allergy set
2. **Trusting the recipe corpus** — so deterministic grounding never fabricates or invents recipes

If you rebuild AI before the foundation is solid:
- ❌ You'll wire placeholder/mock profile reads → later swap to real getLivingUserProfile() calls
- ❌ You'll reimplement recipe-filtering logic → later match recommendation's audited assessRecipeFit()
- ❌ You'll burn cycles syncing allergy/dietary state between two codebases
- ❌ You'll have to re-test the allergy gate once real profile data flows through

**Correct Order:** Build foundation first (L0: profile, reconciliation, recipe corpus) → then wire AI (L3/L4) to call it.

---

## 5. What's Broken / Stubbed / Dead Today

### (1) Live LLM Path: Disabled by Default

**File:** apps/server/src/ai/providers/model-provider.factory.ts:51-53

Status: OFF by default
- Requires ALL of: AI_PROVIDER=gemini, AI_LIVE_ENABLED=true, GEMINI_API_KEY, AI_CHAT_LIVE_ENABLED=true
- If ANY missing or false → stub provider used
- Chat currently always uses the deterministic grounded reply (safe default)
- Live Gemini model is wired but never called without explicit configuration

### (2) Signal Hydration: Cold-Start Only

**File:** apps/server/src/ai/context/behavioral-context-snapshot.service.ts:41

Status: STUBBED
- BehavioralContextSnapshot.signals is always empty
- Signal observations from behavior engine (cook/save/plan events) are NOT hydrated into snapshot
- Maturity progression is limited (declared-only prior ≤0.20, forming band)

Impact: AI sees "cold-start" profile for every new user, even if they've browsed/cooked/saved

### (3) Provider Expansion: Stub Provider Only

**File:** apps/server/src/ai/providers/stub-model.provider.ts

Status: DEAD CODE (fallback only)
- Stub provider is wired when no live model is configured
- Gemini provider exists but is only called when LIVE flags are fully enabled

### (4) Tool Chaining / Autonomy: None

**File:** ai-orchestrator.service.ts:23-32

The orchestrator does NOT support:
- ❌ Tool chaining (calling one tool's output as another's input)
- ❌ Multi-step reasoning loops
- ❌ Agent autonomy
- ❌ Function calling (Claude/Gemini native tool calling)

By design (E47: bounded, deterministic, no autonomy)

### (5) Behavior Engine Integration: Partial

**File:** profile-read.service.ts:112-113

Status: SHADOW MODE ONLY
- When getLivingUserProfile() runs, it loads the observed graph in 'shadow' mode (cold-start)
- Real SignalObservation rows exist but are NOT hydrated unless getFoodDnaProjection() is called
- AI's maturity perception is always "forming" → low-confidence personalization

---

## 6. What World-Class Grounded AI Needs from L0 and L1

### From the Foundation (L0)

#### Must Exist
1. **A real, audited living profile** that the AI can trust
   - Declared + observed + reconciled allergies (safety-critical)
   - Declared + observed dietary patterns
   - Maturity bands (empty → forming → developing → mature)
   - Owner-only access, no PII leaks

2. **Consistent allergen data**
   - Recipe allergen declarations (manual, high-quality)
   - Ingredient-level allergen dictionary (derived from recipes + expert curation)
   - No gaps: if a user declares a peanut allergy, every recipe with peanuts must be marked

3. **A real recipe corpus**
   - Public, vetted recipes (isPublic=true)
   - Declared allergens + derived allergens (via ingredient dictionary)
   - Difficulty, cookingTime, diet, categories (for filtering + UX)
   - No invented recipes

4. **Persistent declared answers**
   - UserFact, UserPreference, UserAllergy tables with row-level safety gates
   - Consent logging (which purposes are granted)
   - High-quality, PII-respecting storage

#### Should Exist (for maturity)
5. **Signal hydration** (SignalObservation rows)
   - User cook/save/plan/rating events logged as signals
   - Behavior engine can build a real UserFoodIdentityGraph
   - AI profile maturity progresses beyond "forming" → "developing" → "mature"

6. **Cross-layer reconciliation**
   - When declared conflicts with observed (e.g. "vegetarian" but opens meat recipes), handle gracefully
   - Never override declared safety-critical facts (allergies, hard restrictions)
   - Preserve evidence of conflict for transparency

### From the Recommender (L1)

#### Must Exist
1. **Audited fit evaluation** that the AI can reuse
   - assessRecipeFit(recipe, profile, derivedAllergens) — deterministic, testable, documented
   - Same logic for both recommendation candidates AND AI-grounded replies
   - No duplication, no divergence

2. **Recipe intelligence** that the AI can call
   - analyzeRecipeIntegrity(recipe) — derive allergens from ingredients
   - getRecipeCategories() / searchRecipes() — deterministic retrieval, no hallucination

#### Should Exist (for live LLM)
3. **A safe grounding injection** for live model prompts
   - When chat-live is enabled, build a prompt that includes ONLY the safe recipes
   - Model never sees declared allergens or unsafe recipe names
   - Output gate screens for allergy mentions before surfacing

---

## 7. Summary Table

| Aspect | Status | Blocker |
|--------|--------|---------|
| **Deterministic chat (grounded reply)** | ✅ Ready | ❌ None — works today |
| **Allergy-safe filtering** | ✅ Ready | ❌ Depends on getLivingUserProfile() existing + accurate allergen data |
| **Live LLM chat** | ⏳ Wired, disabled | ❌ Requires AI_CHAT_LIVE_ENABLED=true + GEMINI_API_KEY + full profile hydration |
| **Signal hydration** | ❌ Stubbed | ⏳ Needed for maturity progression (forming → mature) |
| **Tool autonomy** | ❌ Not in scope | ✅ By design (E47: bounded, deterministic) |
| **Live vision** | ❌ Refused (E47-A7) | ✅ By design (no image analysis; cooking guidance only) |

---

## 8. Recommended Rebuild Sequence

### Phase 1: Foundation (L0)
1. Build ProfileReadService.getLivingUserProfile() — unifies declared + observed profile
2. Implement reconcileProfile() — cross-layer conflict resolution with safety precedence
3. Populate UserPreference + UserAllergy + ConsentLog — declared data storage
4. Audit Recipe + Ingredient + allergen dictionary — corpus quality

### Phase 2: Recipe Intelligence (L0.5)
1. Implement assessRecipeFit() + analyzeRecipeIntegrity() — audited fit logic
2. Build search_recipes tool — deterministic, PII-free retrieval
3. Wire recommendation engine to use getLivingUserProfile() — single source of truth

### Phase 3: AI Subsystem (L3/L4)
1. Wire GroundedReplyService → call getLivingUserProfile() → filter with assessRecipeFit()
2. Enable deterministic chat (grounded replies only)
3. Add live LLM path (with grounding injection + output gate)
4. Enable persisted AI call logging + analytics

### Phase 4: Behavior Engine (Optional, for Maturity)
1. Implement signal processors (cook, save, plan, rate events)
2. Hydrate UserFoodIdentityGraph from SignalObservation
3. Update maturityFor() — enable "developing" → "mature" bands
4. Wire signal observations into getLivingUserProfile()

---

## 4-Line Summary

| Aspect | Answer |
|--------|--------|
| **Area** | AI Subsystem (chat + grounded assistant tools; E47 bounded, deterministic, no autonomy) |
| **#1 Dependency** | ProfileReadService.getLivingUserProfile() — must load and compose living profile with reconciled allergies + maturity; AI fails safely (surfaces nothing) if unavailable |
| **Single Most Important Fact** | AI's entire safety contract rests on reading the SAME reconciled allergy set that the recommendation engine uses; rebuilding this area before the foundation is solid causes rework syncing allergy logic across two subsystems |
| **Rebuild Timing** | **Rebuild AFTER the foundation (L0: profile, reconciliation, recipe corpus, allergen data).** Do not rebuild AI in parallel; has a hard blocker on getLivingUserProfile() + audited recipe intelligence. |

