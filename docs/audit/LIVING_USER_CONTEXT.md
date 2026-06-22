# Living User Context — the omniscient read-layer of the Garnish assistant

> ## ⚠ CRITIQUE CORRECTIONS (verified, authoritative — override contrary text below)
> 1. **`skill.recipe_step_dropoff` is closer to LIVE than the body says** — its allowed event types
>    (`recipe_skip`, `quick_exit`) ARE in the EventType enum; only `cookmode_abandonment` (`cookmode_abandon`) is
>    truly planned-with-missing-event. Don't conflate the two.
> 2. **The popularity "slow payload scan" is only in dev/test scripts, not the live candidate path** —
>    `UserEvent.recipeId` is denormalized; the live ranker does not run the slow scan. Treat as a cleanup, not a hot bug.
> 3. **HEADLINE (the answer to "does the giant system exist?"): NO — it is ~0% WIRED, but the signal stores
>    largely EXIST and are rich → the work is INTEGRATION, not invention.** The verified capture holes that need
>    NEW work: swaps + portion-scaling + ingredient-removals emit ZERO events (sessionStorage only), and
>    stuck-points (the founder's "where they hit problems") have no capture at all. `cook_complete` is
>    emitted+consumed but missing from the EventType enum.
>
> ---

> Companion to `AI_INTERNALIZATION_ARCH.md`. Where that doc defines the *answer* engine (deterministic
> floor → minimal-LLM boundary → admin L2b), this doc defines the *knowing* engine: the single, unified,
> deterministic read-surface that lets the assistant know **everything about the user** — and the capture
> roadmap that keeps it from being blind.
>
> **Code-grounded, 2026-06-22.** Verified against `profile-read.service.ts`, `living-profile.ts`,
> `behavioral-context-snapshot.service.ts`, `get-user-food-context.tool.ts`, `feature-store.service.ts`,
> `food-dna-projection.ts`, `gamification.service.ts`, `real-time-context.ts`, `event-taxonomy.ts`,
> `usePersonalization.js`, `useCook.js`, and `prisma/schema.prisma`.
>
> **The one architectural idea this whole doc rests on:**
> **Knowing-everything = reading our OWN database/signals = $0 LLM. The omniscience is FREE; only the final
> phrasing is (rarely) paid.** Max-personalization and min-cost are therefore the SAME lever, not a
> trade-off. >90% of "wow, it knows me" moments render from deterministic templates over data we already
> own. A model call is reserved for open-ended free-text, behind the existing cost controller + the HARD
> allergy gate.

---

## 0. Reality Check (verified in code, not asserted)

[قطعی] **The founder's "the assistant knows everything" is ~0% wired today.** The assistant's actual
context object is `BehavioralContextSnapshotService.build()`
(`apps/server/src/ai/context/behavioral-context-snapshot.service.ts`). Read verbatim, it reads **only**
`UserPreference.{diet, skillLevel, budget}` and then **hardcodes** `signals: {}`, `consents: ['core']`,
`nutritionSourceLocked: false`, `dataMaturity: 'cold-start'`. The exposed LLM tool
`get_user_food_context.tool.ts` returns `recentSignals: []` with the literal comment
`// no stored safe signals yet (behavior engine: later phase)`. **So the rich stores below EXIST but are
NOT plumbed into the assistant. The work is integration, not invention.**

[قطعی] **The free-omniscience claim is true for COST, with one latency caveat.** Reading our own DB = $0
LLM, correct. BUT a naive per-turn full hydration is a **latency/DB-load** cost, not an LLM cost:
`getLivingUserProfile` rebuilds the observed graph + reconciliation on every call; `GamificationService.getSummary`
calls `recomputeForUser` (it **writes** streak/achievements/progress as a side effect on every read);
popularity is an `O(events)` `groupBy`. **Mitigation:** a cached, precomputed per-user
`AssistantOmniscienceSnapshot` (mirror the `UserFeatureVector` pattern, refresh on event-drain). The
phrasing being the only billed part remains correct.

[قطعی] **ALREADY-CAPTURED ≠ ALREADY-KNOWN-BY-ASSISTANT.** Almost everything in §1 is persisted and
recoverable today, yet almost none reaches the assistant: the snapshot is near-empty, the observed
Food-DNA graph is **consent-DORMANT** (`getLivingUserProfile` only hydrates observations when
`consent.granted.includes('personalization')`, and that purpose is never granted today), and the
collective/regional priors (`RecipePrior`, `collective-signal.ts`) are default-OFF/shadow.

[قطعی] **The single biggest capture hole: swaps/scaling/removals emit ZERO events.**
`apps/web/src/hooks/usePersonalization.js` holds `{servedFor, swaps, removed}` in **sessionStorage only**
(`EMPTY = { servedFor: null, swaps: {}, removed: [] }`); `applySwap` / `toggleRemoved` / `setServedFor`
contain **no `trackEvent` call** — verified. A swap is the strongest taste signal in the app and we throw
it away every time.

[قطعی] **`cook_complete` is a silent contract gap.** `useCook.js:101` emits
`trackEvent('cook_complete', { recipeId: id })` and gamification consumes it
(`COOK_COMPLETE_TYPES = ['cook_complete']`), but `cook_complete` is **absent from the `EventType` enum**
in `event-taxonomy.ts`. Emitted + consumed, never declared (open task `task_2b4b0715`).

---

## 1. The UserContextGraph — every signal, grouped, with source + capture-state

Capture-state legend:
- **[A] ALREADY-CAPTURED** — persisted in DB / feature-store; recoverable now (but usually not *read by the
  assistant* yet — see §0).
- **[C] CAPTURABLE-BUT-NOT-EMITTED** — the action happens in the UI but no event/signal is written.
- **[N] NEEDS-NEW-CAPTURE** — no capture mechanism exists at all.

### A) IDENTITY / TASTE-DNA (who they are)

| Signal | Source (real code/schema) | State |
|---|---|---|
| `name` | `User.name` | [A] |
| `email` / `phone` (PII — greeting only, never in a model prompt) | `User.email` / `User.phone` | [A] |
| `locale` + `country` (→ cohort key AND timezone) | `User.locale` / `User.country` | [A] |
| `isGuest` / `deviceKey` (anon vs registered) | `User.isGuest` / `User.deviceKey` | [A] |
| declared diet / cooking skill / weekly budget band | `UserPreference.{diet,skillLevel,budget}` (the ONLY identity the assistant sees today) | [A] |
| **allergies (declared, SAFETY)** | `UserAllergy → Allergy`; `getDeclaredAnswers` reads them **fail-closed** (re-throws) | [A] |
| cuisine preferences (declared) | `UserCuisine → Cuisine` | [A] |
| health goals (declared, SENSITIVE) | `UserHealthGoal` + `UserBehaviorProfile.healthGoals`; `get_user_food_context` strips `health*` keys | [A] |
| favorite/disliked FOODS + favorite/disliked INGREDIENTS | `UserBehaviorProfile.{favoriteFoods,dislikedFoods,favoriteIngredients,dislikedIngredients}`; feature-store emits `signal_favorite_*`/`signal_disliked_*` | [A] |
| family size / motivation style / budget range | `UserBehaviorProfile.{familySize,motivationStyle,budgetRange}` | [A] |
| **observed taste-DNA (4 user-facing dims)** taste/effort/skill/routine | `UserFoodIdentityGraph` via `getFoodDnaProjection`: `ingredientAffinities/Avoidances`, `cuisineAffinities`, `explorationScore`, `repetitionPreference`, `flavorPatternSummary`, `quickMealPreference`, `techniqueConfidence`, `weeklyPlanningPattern`… | [A] but **consent-DORMANT** |
| full observed graph (11 dims incl. `recommendationBehavior`, `notification`, `planner`, `grocery`, `aiInteraction`) | `UserFoodIdentityGraph` | [A] but only 4 dims user-facing |
| per-ingredient signed affinity/aversion | `UserBehaviorSignal` rows `signal_ing_*`, IDF-salience weighted (`signal-calculator.applyIngredientSignals`) | [A] not exposed |
| coarse taste signals (`likes_chicken/beef/spicy/cheese/eggplant…`, `prefers_vegetarian/keto`) | `signal-calculator.extractSignalsFromRecipe` — **Persian-keyword based** (matches `مرغ`, not "chicken") → GAP for the Europe/general launch | [A] but locale-narrow |
| explicit **"favorite ingredient"** as a first-class fact (founder named) | today only inferred (affinities) or buried in `UserBehaviorProfile` JSON | [N] — surface top-1 from `taste.ingredientAffinities` or a `declared.favorite_ingredient` UserFact |

### B) BEHAVIOR-HISTORY (what they've done)

| Signal | Source | State |
|---|---|---|
| **# recipes cooked** / cook dates / distinct recipes / distinct cuisines / hard recipes | derived from `UserEvent type='cook_complete'` (`gamification.resolveCookStats`) | [A] (taxonomy gap on the type itself) |
| ratings / explicit feedback | `FavoriteRecipe` (`favorite_add/remove`), `RecommendationAttributionEvent` (`save/cook/dismiss/ignore`); `recipe_skip/not_interested/quick_exit` in enum | [A] partial |
| searches | `UserEvent type='search_query'/'search_result_click'/voice_search_*` | [A] |
| **unmet search demand** | UI emits `'search_unmet'` (`useDiscovery.js`) but it is **not in `EventType`**; signal-registry `taste.unmet_search_demand` status `planned` | [C] |
| recipe views + recency windows (7/30/90d) | `UserEvent type='recipe_view'`; `feature-store.buildWindowSignalProfile`; `UserEvent.recipeId` denormalized (popularity still uses slow payload scan — perf, not gap) | [A] |
| derived behavior personas (`quick_meal_lover`, `breakfast_person`, `family_cook`, `high_protein_seeker`, `comfort_food_lover`, `explorer_score`, `late_night_eater`, `weekend_cook`) | `feature-store.buildDerivedBehaviorSignals` (last 90d) | [A] |
| section-read engagement (`nutrition/ingredients/tools/steps/tips/faq _expand/_collapse/_read`) | `EventType.*_EXPAND/_COLLAPSE/_READ` | [A] events; **no signal** (`taste.section_focus` = planned) |
| **SWAPS / substitutions chosen** (flagship gap) | `usePersonalization.swaps` — **sessionStorage only, ZERO emission** | [C] |
| **portion/serving SCALING** (recovers family-size) | `usePersonalization.{servedFor,scaleFactor}` — session-only | [C] |
| **ingredient REMOVALS** (hard avoidance signal) | `usePersonalization.removed[]` — session-only | [C] |
| **STUCK-POINTS / where-they-hit-problems** (founder named, biggest miss) | NO event for "paused on step N", "opened AISheet on step N", "replayed a step". `useCook.js` tracks `currentStep` in component state, never sent. Signal-registry `skill.recipe_step_dropoff` + `skill.cookmode_abandonment` are `planned` with event types the cook UI never emits | [N] |
| **question-history / previous questions** (founder named) | `ChatMessage` stores every turn by `conversationId`; `UserFact` stores distilled safe facts | [A] persisted, **never read back into context** |
| AI feedback votes | UI emits `'ai_feedback'` (`useAssistant.js`) — **not in enum**; `ai_response_like/dislike` are | [C] |
| recipe DWELL time / scroll velocity / repeat-cook | signal-registry `taste.recipe_dwell`, `routine.scroll_velocity`, `taste.repeat_cook` all `planned`; UI emits none | [N] |

### C) RIGHT-NOW CONTEXT (the every-second vector)

| Signal | Source | State |
|---|---|---|
| time-of-day / meal-window / day / weekend / season / Persian + European occasion | `buildRealTimeContext` (`real-time-context.ts`), locale/tz-aware, DST-correct for Amsterdam, European occasions CORE | [A] wired to **ranker**, not assistant |
| current SCREEN / route | `UserEvent.page` exists for past `page_view`; no **live** "current screen" channel | [N] per-request field |
| current RECIPE / current STEP being cooked | `useCook.js` `currentStep` in component state; not sent to assistant | [N] per-request field |
| PANTRY / on-hand inventory | `PantryItem` (soft-linked to `Ingredient`) | [A] not used by assistant |
| active meal PLAN + **which days are EMPTY** (founder named) | `MealPlan`/`MealSlot`; empty = 7×mealType − filled slots; `fullWeeksPlanned` already computed | [A] |
| **# meals added to plan** (founder named) | count of `MealSlot` with `recipeId` | [A] |
| shopping list + completion state | `ShoppingList`/`ShoppingItem.isChecked` ("you still need to buy X") | [A] |

### D) ENGAGEMENT / EMOTIONAL (how they're doing)

| Signal | Source | State |
|---|---|---|
| **days-as-member / tenure** (founder named) | `User.createdAt` (`now − createdAt`) | [A] trivial, not surfaced |
| streak (current/longest weeks, at-risk, grace, kind message) | `UserStreak` + `computeStreak` (weekly cadence) | [A] |
| **badges / achievements** (founder named) | `UserAchievement` + `evaluateAchievements`; append-only `GamificationEvent` ledger | [A] |
| **level / points / mastery** (founder named) | `UserProgress.{level,levelName,score}` + `computeMastery` | [A] |
| churn-risk + days-since-active + retention trend | `UserRetentionSnapshot.{churnRisk,daysSinceLastActive,retentionScore}` → `retention_churnRisk`; `UserBehaviorProfile.{churnRiskScore,consistencyScore}` | [A] |
| activity scores 7/30/90d + active-days-last-30 | feature-store window profiles + `UserEngagementSnapshot.{activeDaysLast30,avgSessionDuration}` | [A] |
| **data-maturity / confidence band** (cold_start→mature) | `feature-store.getDataMaturity` + `LivingUserProfile.maturity.band` (`maturityFor`: declared capped at 0.20 → forming) | [A] — the honesty backbone |
| outcomes (save/cook/shopping-completion/AI-accept/dismiss rates) | `UserIdentitySnapshot` + `UserOutcome` | [A] |
| wins / frustration / emotional state | partially derivable (at-risk streak = soft frustration; abandons = friction); no dedicated capture | [N] — synthesize as a derived READ, not a new event |

### E) COLLECTIVE / POPULARITY / COHORT (the world around them — founder named individual/collective/regional)

| Signal | Source | State |
|---|---|---|
| PERSONAL dish popularity | per-user views/favorites/cooks (`UserEvent` + `FavoriteRecipe`) | [A] |
| COLLECTIVE popularity (crude) | `ranking.calculatePopularityScore = (views + favorites×2)/250` — global count, NOT the richer model | [A] weak |
| taste-neighbourhood collective ("users like you also cooked X") | `collective-signal.ts` `buildCollectiveModel`/`collectiveScore` | [A] but **shadow-only/additive**, never surfaced |
| **REGIONAL popularity / cohort** | `cohort-key.ts deriveCohortKey(country/locale/diet/skill/occasion)` + `RecipePrior` (scope population\|cohort\|person) — the hierarchical-shrinkage prior | [A] but **default-OFF** (L1 not activated) |
| recipe success-rate / reward | `RecommendationMetrics` (cookRate/saveRate/CTR) + `RecipePrior.mean` (IPS reward) | [A] |
| cohort assignment / experiment arm | `ExperimentAssignment` | [A] |
| served-slate log (position + propensity) + per-recipe WHY | `RecommendationServedItem` + `FeatureContributionLog{featureKey,contribution,finalScore}` — lets the assistant explain "I suggested this because…" | [A] (log may be empty while ranker is OFF — verify) |

---

## 2. The unified deterministic read interface — `getUserContextGraph(userId, now)`

**Principle: extend the seam, do NOT fork it.** Build **one** assistant-facing read service in
`apps/server/src/ai/context/` that composes existing services **BY REFERENCE** — every section deterministic,
every byte from our own DB, **ZERO LLM**.

```ts
// apps/server/src/ai/context/user-context-graph.service.ts  (new — composition only, no new ML)
interface UserContextGraph {
  identity:   { name; daysAsMember; memberSince; locale; country; isGuest };       // User.findUnique
  tasteDna:   FoodDnaProjection & { favoriteIngredient };                          // getFoodDnaProjection (+ top affinity)
  reconciled: LivingUserProfile;          // getLivingUserProfile — ALLERGY INVARIANT FLOWS THROUGH UNTOUCHED
  behavior:   { personas; recentTopics[]; recentQuestions[]; stuckPoints[] };      // feature-store + ChatMessage + (future) step events
  engagement: GamificationSummary;        // getSummary: streak, mastery/level, achievements, stats, celebrate
  plan:       { mealsPlanned; emptyDays[]; filledSlots };                          // MealPlansService.getCurrentPlan
  shopping:   { uncheckedCount; items };                                           // ShoppingListService.getList
  pantry:     PantryItem[];                                                        // "you already have X"
  now:        RealTimeContext;            // buildRealTimeContext(now, { timeZone: locale })  — per-request
  popularity: { individualTop; collectiveNeighbourhood; regionalTop };            // candidate-generator / collective-signal / RecipePrior (READ as priors)
  provenance: Record<section, { consentPurpose; maturityBand; source }>;          // mirror living-profile provenance
  schemaVersion: number;
}
```

**Non-negotiables baked in (must ship WITH it, not after):**

1. **ZERO-LLM.** This object is what the assistant reads *before* composing a reply. Knowing is free; only
   the final sentence is (rarely) billed, behind the cost controller.
2. **Allergy/safety invariant flows through unchanged.** `getUserContextGraph` composes
   `getLivingUserProfile` by reference; `reconciled.dimensions.allergies` (precedence `declared_safety`)
   stays the single source. Any new field is **enrichment only** and may NEVER widen the safe set. The
   grounding still runs `assessRecipeFit` + `analyzeRecipeIntegrity` as the HARD gate.
3. **Fail-closed + never-throws.** If a section can't load it degrades to cold-start for *that section*; the
   build never throws (the existing `BehavioralContextSnapshot` contract). If the allergy read fails,
   surface nothing.
4. **Per-section consent provenance.** Observed-graph hydration is already gated on
   `consent.granted.includes('personalization')`; analytics is legitimate-interest baseline. Carry the
   consent purpose each field was read under so a non-consenting user gets the **byte-identical cold-start**
   view and DSAR/export stays clean. Sensitive declared dims are owner-only and never enter a model prompt.
5. **Per-request vs persistent split.** `now` (real-time) + trending popularity → compute live each turn
   (cheap). Profile/gamification/plan/shopping → per-user state, read live but **cacheable for the session**
   (and ultimately served from the cached snapshot in §5).

**Wire it into exactly two places** (the chokepoints from §0): replace the near-empty body of
`BehavioralContextSnapshotService.build` with a composition of `getUserContextGraph`, and make
`get_user_food_context.tool.ts` read it instead of returning `recentSignals: []`. NestJS DI is already
wired — this is a read-composition, not a rebuild.

---

## 3. System-connection map (read + write/trigger per subsystem)

The assistant is **connected to every system** — reading from all, and (via existing write paths only)
acting on some. Every assistant action becomes a future signal: the loop closes.

| Subsystem | READ (what the assistant knows) | WRITE / TRIGGER (assistant as actor — reuse existing paths, never a new direct writer) |
|---|---|---|
| **Profile / Identity** | `getLivingUserProfile` (declared+observed+reconciled+maturity), `getFoodDnaProjection`, `User` row | — (read-only; declared edits go through the profile flow) |
| **Feature-store** | `buildFeatureVector` (signals, windows, personas, churn, maturity) — best single source for the cached snapshot | refreshed on event-drain |
| **Gamification** | `getSummary` (streak, mastery/level, achievements, stats, celebrate) | `recomputeForUser` (derive-only; never client-claimed) |
| **Meal-plan** | `getCurrentPlan` → empty days, meals planned | `MealPlansService.addMealSlot` (validates recipe visibility + allergy) to fill an empty day |
| **Shopping** | `getList` → unchecked count, items | `ShoppingListService.addItems` / `buildFromPlan` |
| **Pantry** | `PantryItem` | — |
| **Notifications (INE)** | consent/quiet-hours/fatigue state | `IneService.decideForUser` ONLY (owns consent + `DAILY_CAP=2` + DRY-RUN default) — **never a parallel notifier** |
| **Event stream** | `UserEvent` + `EventOutbox` + `SignalObservation` (the capture spine) | emit a `user_problem`/`ai_error`/action-acceptance `UserEvent` through the SAME ingest → routes via `EventOutbox` into `aiInteraction`/`safetyBoundaries` dims → readable next turn |
| **Real-time context** | `buildRealTimeContext` | fused at call time (8am vs 8pm, Yalda vs ordinary Tuesday) |
| **Popularity / collective / cohort** | `candidate-generator.getTrendingRecipes`, `collective-signal.ts`, `RecipePrior` + `deriveCohortKey` | **READ as priors for phrasing only** — must NOT flip the ranker on (see §6) |
| **Explain-why** | `FeatureContributionLog` (per-feature contribution rows) | — ("I suggested this because you cook chicken + quick meals") |
| **Chat history** | `ChatMessage` (recent topics / past questions) + `UserFact` | new turns persist normally; read back as `recentQuestions[]` |

---

## 4. The JAW-DROP proactive playbook (trigger → data read → mostly-zero-LLM render)

**Psychology (research-grounded):** narrative bias (reflecting a user's OWN behavior back = identity
ownership, Spotify Wrapped); loss aversion (a visible streak hurts to lose; day0→7→14→30 is where churn
collapses, Duolingo); recognition-not-surveillance (users *want* to feel known — the line is HOW/WHY; ~80%
are nervous about data *use*); transparency beats creepy (Netflix "Because you watched" is loved because
the reason is shown).

**Uncanny-valley line (top guardrail):** delight = data the user KNOWINGLY created **in this app**, reflected
back **with its source**. Creepy = inferred/sensitive attributes never typed (health/weight/allergy-as-
judgment), cross-context surprise, or precision with no visible "why". **Garnish rule: every line carries a
"because you ___" and never narrates a sensitive inference.**

| Moment | Trigger | Data read (all our own DB) | Render | Cost |
|---|---|---|---|---|
| **Greeting with real history** | assistant/home open | `User.name`+`createdAt`, `stats.totalCooks`, `streak.currentWeeks`, last `cook_complete` title, `now` (meal window + occasion) | "Welcome back {name} — {daysAsMember} days in, {totalCooks} cooks. Last time: {dish}." Cold-start → curiosity/cohort hook, never fake intimacy | **zero-LLM** |
| **Fill the empty plan day** | plan view / briefing when `filled<7` | `getCurrentPlan` empty slots + `proposePlan` (allergy-HARD-filtered) + `now` (weekend→family size) | name the empty days + 2 one-tap safe picks; WHY-line from top `FeatureContributionLog.featureKey` | **zero-LLM**, action-attached |
| **Celebrate a win / streak / level-up** | `recomputeForUser` yields `newlyUnlocked` OR `mastery.level`↑ OR `streak.atRisk` | `getSummary.celebrate`, `mastery.levelName`, `streak.kindMessage` | win: name badge + `distinctCuisines`; at-risk: kind nudge. Push via INE | **zero-LLM** (capped 1/response) |
| **Pre-empt a known stuck-point** (Swiss-watch) | opens a recipe previously viewed-without-cooking or `quick_exit`'d, or hard-for-their-skill | `UserEvent` (view/quick_exit without `cook_complete`) + `recipe.difficulty` vs skill + GRIS `troubleshooting`/`commonMistakes` | "Last time you stopped here; most people get stuck at {step}, do it this way." | mostly zero-LLM; precise version needs step capture (§5) |
| **Allergy reassurance** ("I hid 14 + swapped 6") | any allergy-filtered surface | `droppedForAllergy` count (FREE today) + (future) swap count from `ingredient_swapped` | "Hid {n} dishes + swapped {m} ingredients for your allergies — want to see what I hid?" Care + control, NEVER judgment; keep the "informational, not a guarantee" hedge | zero-LLM (hidden); swapped needs §5 |
| **Next-milestone nudge** (goal-gradient) | profile/assistant open, N from a threshold | `stats` vs `gamification-achievements.ts` nearest unmet | "One more new-region cook and Explorer is yours ({distinctCuisines}/5)." | zero-LLM (single nearest only) |
| **Remember past questions** (continuity) | assistant open / follow-up | `ChatMessage` recent topics | "Last time you asked about a substitute for {ingredient} — same topic or something new?" Factual recall only | zero-LLM once wired |
| **Regional / cohort trend hook** (cold-start-safe, Holland-launch CORE) | home/discover, esp. low-maturity | `RecipePrior(scope=cohort, deriveCohortKey{country=NL;occasion=christmas})` OR a `UserEvent` groupBy rollup | "This week in the Netherlands, cooks reached most for {dish} — try it?" | zero-LLM; works at ZERO personal data |
| **Favorite-ingredient callback** | recipe view / chat | top positive from `taste.ingredientAffinities` (already accrues via `signal_ing_*`) | "Noticed you love {ingredient} — this recipe is built on it." Avoids the swap-event gap entirely | zero-LLM once exposed |

**Privacy / creepiness guardrails (every moment):** (1) **source-show** — each line implies "because you
{did X in Garnish}"; never reference data not created here. (2) **No sensitive narration** — never speak
allergies/health/weight as inference/judgment; allergy moments are CARE + a "show me what you hid" control.
(3) **Consent-tiered** — observed/behavioral hooks require granted `personalization`; declared-only + cohort
hooks run on `core`. (4) **Maturity-gated confidence** — no strong "I know you" below `developing`;
cold-start gets curiosity/cohort hooks. (5) **Frequency-respecting** — push via INE only (consent /
quiet-hours / `DAILY_CAP=2` / fatigue); in-app respects dismiss-fatigue; ONE highlight per surface.
(6) **Owner-only** — `userId`-scoped reads; gamification is no-leaderboard. (7) **Data minimization +
k-anonymity** — render from aggregates/bands; require ≥N cooks before naming a collective/regional trend.
(8) **Reversible** — every nudge dismissible with a visible "why am I seeing this / turn off".

---

## 5. Capture roadmap — what P0 observability must emit so the assistant isn't blind

The pipes (capture → signal → profile) are ~80% built. The remaining work is **last-mile plumbing into the
assistant + 3 missing captures**, not a rebuild.

**P0 — the wiring that turns ~0% into ~80% (days, all free-to-read):**
- Build the cached **`AssistantOmniscienceSnapshot`** (mirror `UserFeatureVector`: a cached row refreshed on
  event-drain) joining feature-vector + `getFoodDnaProjection` + `getSummary` + plan/empty-days + shopping +
  pantry + tenure + churn + cohort popularity. Wire `getUserContextGraph` over it INTO
  `BehavioralContextSnapshotService` + `get_user_food_context`.
  **Pass/fail:** the assistant answers "what do you know about me?" with ≥12 true, specific facts in <300ms,
  $0 LLM for retrieval; and answers referencing ≥3 real systems with ZERO model call.
- Ship the **first-message "I know you" block** (name + daysAsMember + #cooks + streak + badges +
  empty-plan-days + "users in NL also cooked X"), maturity-gated so it never overclaims at cold-start.

**P0 — close the biggest capture hole (small, high-leverage, NO ML):** emit from `usePersonalization.js`
(keep sessionStorage UX byte-identical; just ALSO emit `trackEvent`):
- `ingredient_swapped {fromIngredientId, toIngredientId, recipeId, reason}` → processor → `taste.ingredient_affinity(+)` / `avoidance(−)`
- `portion_scaled {recipeId, servedFor, scaleFactor}` → family-size signal
- `ingredient_removed {ingredientId, recipeId}` → hard avoidance
- `allergy_filter_applied {hiddenCount, swappedCount, recipeId}` → powers the allergy-reassurance moment

**P0 — the founder's flagship "where they hit problems":** instrument `useCook.js` to emit
`cook_step_paused` / `cook_step_help_opened` / `cook_step_replayed` / `cookmode_abandon`
`{recipeId, stepIndex, dwellMs}` → activates the already-defined `skill.recipe_step_dropoff` +
`cookmode_abandonment` signals → enables the pre-empt-stuck-point moment.

**P0 — live request context:** pass `{currentScreen, recipeId, stepIndex, clientLocalTime}` into every
assistant call so "help me with THIS step right now" works and `now` folds in the right meal-window/occasion.

**P1 — taxonomy reconciliation (`task_2b4b0715`):** declare `cook_complete`, `search_unmet`, `ai_feedback`
in `EventType` so the event-quality gate + signal-registry validate against reality.

**P1 — make "favorite ingredient" first-class:** top-1 from `taste.ingredientAffinities` (or a declared
fact) so the assistant states it reliably instead of guessing.

**P2 — perf, not feature:** stop popularity from scanning `UserEvent.payload`-contains; use the denormalized
`UserEvent.recipeId` index. (Wrong-data risk if collective/RecipePrior ever go live on the slow path.)

**P3 — scale, not now:** materialize a nightly `RecipePopularity {recipeId, window, scope(country/cohort),
cookCount, saveCount}` rollup so the omniscient popularity read is O(1). Premature before launch volume —
defer until trending `groupBy` shows latency.

**DELIBERATELY DEFER / DO-NOT-BUILD-YET:**
- Do **not** flip `RecipePrior`/L1 learned weights or `collective-signal` to LIVE just to feed the assistant
  — they're default-OFF behind an offline-replay gate for good reason. Read them as **priors for phrasing**;
  do not let them change ranking.
- Do **not** auto-grant `personalization` consent to unlock the observed graph — that's a GDPR landmine for
  the Holland/Europe launch. Wire an explicit consent-grant flow first (phase B); then the dormant observed
  dims light up legally and byte-identically.
- DELETE: any predictive health/nutrition inference — legal/creepy, no MVP value.

---

## 6. Honest gaps (what is NOT capturable yet)

- **No live "current screen/step" channel.** `UserEvent.page` is a *past* `page_view`; "help with THIS
  step" is impossible until the per-request context field (§5 P0) ships. This is a client-contract change
  across ~5 surfaces — the timeline is the real risk, not the code.
- **Stuck-points don't exist as data today.** `stepDropoffRisk` is a real graph dimension **with no feeding
  event**; the v1 "pre-empt" moment must approximate from view-without-cook / `quick_exit` until
  `cook_step_*` capture lands. Honest: v1 is heuristic, not precise.
- **Swaps/scaling/removals are session-only.** Until §5 P0 emits them, "you always swap yogurt for X" has no
  behavioral substrate — must be inferred from cooked-recipe ingredients (weak).
- **Past questions are persisted but unread.** `ChatMessage` exists; retrieval into context is not wired.
  Factual recall only when it ships — no inferred intent.
- **Observed Food-DNA is consent-DORMANT.** Legally correct to keep it dark until phase-B consent — so for
  non-consenting users the assistant is honestly limited to declared + cohort, by design.
- **Collective/regional popularity is computable, not materialized or live.** `RecipePrior` is default-OFF;
  `collective-signal` is shadow. Cohort hooks work as priors; precise per-recipe collective scores wait on
  L1 activation (gated) and the §5 P3 rollup.
- **Emotional state has no dedicated capture.** Wins/frustration are *synthesized reads* over existing
  signals (at-risk streak, abandons), never a measured event — keep the confidence honest.
- **Coarse taste signals are Persian-keyword-bound.** `likes_chicken` matches `مرغ`, not "chicken" — a real
  gap for the Dutch general-public launch until the matcher is localized.
- **Latency/side-effect risk at scale.** `getSummary` writes on every read; `getLivingUserProfile` rebuilds
  per call. The cached snapshot (§5 P0) is mandatory before this is fast at scale — and `FeatureContributionLog`
  may be empty while the ranker is OFF, so the explain-why moment must degrade gracefully.

---

## 7. Investor framing (one paragraph)

The moat is that **omniscience = reading our OWN signals = $0 marginal cost and a defensible data network
effect**, while competitors pay an LLM to *fake* personalization on every turn. Garnish knows the user from
data the user knowingly created in-app, reflects it back with its source (delight, not surveillance), and
spends model tokens only on the rare free-text residue. The honest disclosure: the capture→signal→profile
pipes are ~80% built; the remaining work is last-mile plumbing into the assistant plus three small captures
(swap, step, live-context) — integration, not invention.
