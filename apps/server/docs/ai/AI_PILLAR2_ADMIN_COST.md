# Garnish AI — Pillar 2: Admin-Analytics Brain + Cost Transparency

**Authoritative addendum.** Companion to the user-facing assistant plan (Pillar 1 / "L2a omnipresent user assistant"). This document covers the **second** AI system in the founder's two-system vision: the admin/ops brain (L2b) plus per-user cost/usage transparency. It is code-grounded against `apps/server` as of master `dfd94531`. Confidence tags follow the working agreement: **[قطعی]** strong evidence · **[احتمالاً]** good evidence, not certain · **[حدسی]** inference · **[نامطمئن]** insufficient data.

> Status note on docs: there is no `docs/audit/` tree in this checkout and no separate companion file on disk yet. This addendum is self-contained. When the Pillar-1 plan is written to disk, cross-link it here.

---

## 0. Reality Check (read this before believing the rest)

[قطعی] **This pillar is ~80% deterministic plumbing and ~20% LLM.** The valuable, near-term, demoable part — per-user token meters, resets/remaining, an admin cost dashboard, "most-asked / most-popular / trends" — is metering + SQL + charts that needs **zero LLM**. The LLM earns its place in exactly two narrow spots, and only after the deterministic layer exists:

1. translating an admin's English question into one **governed, pre-approved metric**, and
2. **narrating** a number a deterministic function already computed.

If you build the chatty "ask the data anything" brain first, you will ship a tool that confidently hallucinates your own KPIs back to you — the single worst failure mode for an admin surface. The whole design hangs on one invariant:

> **The LLM never emits a number. A deterministic function computes every figure; the LLM only picks which governed metric to run and words the result. Undefined metric → "I can't answer that yet," never improvised SQL.**

[قطعی] **Two corrections to the original framing, both verified in code** — a tired founder will be misled if these aren't stated up front:

- **"Per-user $ cost is null today" is the wrong mental model.** It is null only because there are **zero live Gemini rows yet** (live chat is gated OFF), **not** because rates are missing. `PRODUCTION_RATE_CATALOG` already has an **active** `gemini-3.1-flash-lite` row ($0.25 / $1.50 per 1M, verified 2026-06-24, `isActive:true`) at `src/ai/cost/ai-cost-rate-catalog.ts:39-54`. `estimateCostUsdFromCatalog` (`:109-125`) returns a real number the instant a real `provider='gemini' model='gemini-3.1-flash-lite'` row lands with an input/output split — and the Gemini provider supplies that split (`completionTokens` from `usageMetadata`, `src/ai/providers/gemini-model.provider.ts`). So per-user $ is **computable today on real rows**. The work is "produce real rows + verify the env model id," not "build a rate row."
- **`AiTurnDecision` is not a Prisma model.** Grep of `prisma/schema.prisma` confirms **no such model exists**. The intent/turn-decision data ships as a JSON **payload** on a `UserEvent` (`AI_SUGGESTION_GENERATED`), un-indexed. Task #15 ("AiTurnDecision substrate", marked completed) shipped as event-payload capture, not a table. Any plan that promises "query the AiTurnDecision table" is wrong; you query a JSON path on `UserEvent`.

[احتمالاً] **Trust-the-ledger caveat.** Task #21 ("Fix AI cost observability", marked completed) made the write path code-correct, but its "real Gemini rows persist with non-null cost" claim is **DB-unverified in this audit** (no production query was run; live chat is OFF, so the historical 22 rows were stub-model with ~0 tokens). **Before demoing per-user $, run one live chat turn and confirm a `provider='gemini'` row lands with non-null `estimatedCost`.** Building a cost dashboard on a blind ledger is worse than no dashboard — it's false confidence.

**Build order (defended in §6):** (1) Pillar-A reads — one aggregator → `/me/ai-usage` + `/admin/ai/usage`; (2) verify deployed `GEMINI_MODEL == gemini-3.1-flash-lite`; (3) persist the search-gap signal (~30 min, highest-leverage Pillar-B fix); (4) the deterministic **analytics tool registry** (the keystone); (5) auto-insights job over the registry; (6) the NL admin brain **last**.

---

## 1. What the founder asked for

Two concrete asks, restated precisely so we can hold the build to them:

### 1a. Per-user cost/usage transparency
- **In the admin panel:** see how many tokens (and $) each user has consumed; aggregate spend; who the heaviest users are.
- **In the user's own profile:** the user sees their own consumption, what's **remaining**, and when it **resets** — in human language, not raw token integers.

### 1b. The admin-analytics brain ("analyze all-user data → professional insights")
- The AI analyzes data **across all users** and surfaces a professional admin panel of insights: **most-asked questions**, **most-popular dishes**, **trends over time**, and "**+more**" — cohorts/retention, search-gaps (unmet demand), allergy/diet distribution, cost-per-user.
- Founder's stated long-term shape (from the AI-vision memory): L2b = admin-analytics AI over ~200 parameters → admin panel + **supervised autonomy**. This addendum scopes the **read/insight** half now and explicitly **defers** the autonomy/action half behind a human-confirm gate.

**Success criteria (the bar this pillar must clear):**
- A founder/admin can answer "what did user X cost us?" and "what are users asking for that we don't have?" from a panel, with every number traceable to a deterministic query (provenance visible).
- A user can see "you've used N of M this week, K remaining, frees up in ~3h" sourced from the **same** counter the request-gate enforces.
- No raw user text, email, or identity ever reaches the analytics LLM or a non-owner surface; cohort distributions suppress segments below a floor.

---

## 2. Readiness — honest current state

The substrate is far more built than green-field. The gaps are **read/exposure surfaces** and **two unpersisted signals**, not schema.

### 2a. Pillar A — per-user cost/usage

| Capability | State | Evidence (file:line) |
|---|---|---|
| Per-user tokens + provider + model + cost **ledger** | **READY** | `AICallLog` model `prisma/schema.prisma:911-948` (userId, provider, model, estimatedInput/OutputTokens, estimatedCost, totalTokens, usageSource, intent, tier, cacheHit/cacheTokens; indexed `[userId,createdAt]` and `[provider,model,createdAt]`). Write path `src/ai/orchestrator/ai-orchestrator.service.ts:236-262` on **every** terminal path (ok/blocked/error). |
| Real per-user **$** | **READY**, preconditioned | Active rate row `src/ai/cost/ai-cost-rate-catalog.ts:39-54`; cost computed at write time `ai-orchestrator.service.ts:230`. Precond: live Gemini rows exist **and** deployed `GEMINI_MODEL == gemini-3.1-flash-lite` exactly. |
| **Consumed** per window (5h / daily / weekly / monthly) | **READY** | `consumedTokensToday` + `checkAllWindows` bounded SUM aggregates `src/ai/cost/persisted-daily-budget.service.ts:48-142`; windows/limits `src/ai/cost/ai-cost-policy.ts:37-45` (60k / 200k / 700k / 2M, 15s cooldown). |
| **Remaining** per window | **PARTIAL** | `limit − consumed` is trivial but **not assembled anywhere**; `checkAllWindows` early-returns the **first** blocking window only (`persisted-daily-budget.service.ts:138`). Needs one new aggregator. |
| **Next reset** per window | **DESIGN DECISION** | Windows are **rolling** (`createdAt >= now − durationMs`, `:134`) — a rolling window has **no reset instant**. "Soonest relief" must be derived from the oldest in-window row, or the gate switched to calendar buckets (a behavior change to a safety gate — defer). |
| **Admin** per-user usage endpoint | **MISSING** | No per-user `AICallLog` route in `src/admin/admin.controller.ts`. Existing AI-admin reads are aggregate-only (`OpsIntelligenceService.getEconomics`, no per-user breakdown). |
| **User** own-usage endpoint | **MISSING** | Only the GDPR bulk export exposes a user's own call logs (`src/users/export/user-export.service.ts:135-146`) — a JSON dump, not a usage/remaining/reset view. |

### 2b. Pillar B — admin analytics

Two honest analytics engines already exist and are wired to admin routes, and — critically — **they already carry honesty tags** (`status: 'real' | 'awaiting_pilot' | 'awaiting_rates'`) and never fabricate (no `Math.random`, explicit nulls):
- `AnalyticsIntelligenceService` — funnels / trends / cohorts / product-intelligence (`src/analytics/intelligence/analytics-intelligence.service.ts`).
- `OpsIntelligenceService` — health / safety-compliance / economics (`src/analytics/intelligence/ops-intelligence.service.ts`).
- Routes: `src/admin/admin.controller.ts:108-128` (`/admin/analytics/{funnels,trends,cohorts,product-intelligence}`, `/admin/ops/{health,safety-compliance,economics}`).

| Insight | Data exists? | Source / gap |
|---|---|---|
| Most-popular dishes (real cooks + favorites) | **READY** | `AdminService.getRecipeStats` topViewed/topFavorited `src/admin/admin.service.ts:268-314`; `observability.counters` cook-through. Rank by **`cook_complete`**, not views (honors the analytics-honesty memory). |
| Trends (time-bucketed) | **READY** | `AnalyticsIntelligenceService.getTrends` (`:62-71`). |
| Retention / funnel / drop-off | **READY (math) / awaiting real-user volume** | `getFunnels` (`:41-59`), `getCohorts` (`:74-86`); honest-null pre-pilot. |
| Cohorts / profiles | **READY** | `UserBehaviorProfile` (churn/consistency) → `getBehaviorProfiles` `admin.service.ts:332-344`; DNA maturity bands (`analytics-intelligence.service.ts:100-114`); locale/country. |
| Cost-per-user | **PARTIAL** | Aggregate `costPerUserUsd` / `avgTokensPerUser` exist (`getEconomics`, `:157,161`); **per-user breakdown not exposed** (same gap as 2a). |
| Most-asked **intents** | **PARTIAL** | Real `IntentClassifier` output **is persisted** in `UserEvent.payload.intent` of `AI_SUGGESTION_GENERATED` (`src/ai/chat/chat-orchestration.service.ts:740-762`), but **un-indexed** and with **no aggregator**. (`getAIInteractionStats` reads a keyword-match `enrichment`, not the real classifier.) |
| Most-asked **questions (verbatim)** | **NEEDS-WORK by design** | Raw text is in `ChatMessage.content`, but admin event reads **strip** `payload`/`enrichment` for privacy (`admin.service.ts:182-187`). Verbatim mining requires an explicit privacy/consent decision (lawyer-gated). Correct posture — bounds "most-asked" to **structured intents**, not raw sentences. |
| **Search-gaps** (asked-but-not-found) | **NEEDS-WORK (not persisted)** | `RecipeSearchService.unmetSearchLog` is an **in-memory `string[]`** that dies on restart (`src/recipes/search/recipe-search.service.ts:42,120-127`, comment "observed but unwired"). The enum `SEARCH_UNMET='search_unmet'` exists (`src/analytics/event-taxonomy.ts:148`) and the sanitizer whitelists it (`payload-sanitizer.ts`), but **nothing emits the event**. Not queryable today. |
| Allergy / diet distribution | **PARTIAL** | Data in `UserAllergy` / `UserPreference.diet` / `UserHealthGoal` (queryable), but **no aggregator written**. Cheap groupBy. Consent posture by purpose **is** aggregated (`ops-intelligence.service.ts:116-131`). |

**Honest one-liner:** the schema and the math are real; the **transparency feature is ~0% shipped** because nobody has wired the reads. That's the cheap half of the work — good news, but don't mistake "substrate ready" for "feature done."

---

## 3. Architecture (file-level)

Three things to build, in dependency order: (A) cost/usage endpoints, (B) the deterministic analytics tool registry, (C) the LLM narrator. Plus governance that's enforced **structurally**, not by prompt.

### 3.1 The invariant, drawn

```
┌──────────────────────────────────────────────────────────────────┐
│  LAYER 3   NL ADMIN BRAIN (LLM)                    [build LAST]   │
│  English Q → pick {metric, params} → narrate the returned number.│
│  Given ONLY the tool list. No DB. No SQL. Undefined → refuse.    │
└───────────────▲──────────────────────────────────────────────────┘
                │ tool-use (LLM narrates a deterministic number)
┌───────────────┴──────────────────────────────────────────────────┐
│  LAYER 2   ANALYTICS TOOL REGISTRY (deterministic)  [keystone]   │
│  ~12 named, governed metrics. Each = pure aggregate returning     │
│  {value, status:'real'|'awaiting_data', lineage}. ONE definition  │
│  reused by: dashboard cards · auto-insights · the NL brain.       │
│  Centralized k-anon floor (K=5) + lineage stamping in run().      │
└───────────────▲──────────────────────────────────────────────────┘
                │ wraps / delegates to (do NOT reimplement)
┌───────────────┴──────────────────────────────────────────────────┐
│  LAYER 1   EXISTING ENGINES (already real, honesty-tagged)        │
│  AnalyticsIntelligenceService · OpsIntelligenceService ·          │
│  AdminService.getRecipeStats · observability.counters · AICallLog │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 Pillar A — cost/usage endpoints

**(A) One new aggregator — unblocks the entire pillar, zero schema.**
`src/ai/cost/persisted-daily-budget.service.ts` → add `getUsageSummary(userId, now?)`.

```ts
export interface WindowUsage {
  window: '5h' | 'daily' | 'weekly' | 'monthly';
  consumedTokens: number;
  limitTokens: number | null;
  remainingTokens: number | null;     // max(0, limit - consumed); null if uncapped
  fractionUsed: number | null;        // clamped [0,1]
  earliestReliefAt: string | null;    // oldest-in-window.createdAt + durationMs (ISO); null unless at cap
  resetModel: 'rolling';              // honest: NOT a calendar reset
}
export interface AiUsageSummary {
  windows: WindowUsage[];
  costToday: { estimatedUsd: number | null; currency: string; isEstimate: true; status: 'real' | 'awaiting_rates' };
  cooldown: { activeUntil: string | null; cooldownMs: number };
  displayHint: { unit: 'ai_helps'; tokensPerUnit: number }; // FE & gate share ONE divisor (prevents meter/gate drift)
  generatedAt: string;
}
async getUsageSummary(userId: string, now?: Date): Promise<AiUsageSummary>;
```

Implementation reuses existing patterns, **DB-side bounded aggregates only** (no `findMany` row-loading):
- Per window: the **same bounded SUM** already in `checkAllWindows` (`:132-136`) — but assemble **all four** instead of early-returning the first blocker. `remaining = max(0, limit − consumed)`.
- `costToday`: reuse `consumedEstimatedCostUsdToday` (`:63-75`). `status:'real'` iff a verified rate exists (probe `estimateCostUsdFromCatalog('gemini','gemini-3.1-flash-lite',1,1).cost !== null`, mirroring `getEconomics`), else `'awaiting_rates'`.
- `earliestReliefAt` (only when consumed ≥ limit): one indexed `findFirst` per capped window — oldest in-window row `orderBy createdAt asc` within `gte: now − durationMs`; relief = `createdAt + durationMs`.
- `cooldown.activeUntil`: reuse the existing cooldown `findFirst` (`:118-122`).

**[قطعی] Reset-model decision — pick one, own it.** Code is **rolling**; a rolling window has no reset instant. Render copy as **"frees up in ~3h"** (from `earliestReliefAt`), **not** "resets Monday." This is truthful to the enforcement and zero-risk. Switching the gate to calendar buckets for prettier copy rewrites a **safety gate** (`checkAllWindows`) — **defer**, not worth the pre-pilot regression risk. The SOTA rule "meter must equal the enforced limit" is satisfied because the meter and the gate read the **same** aggregate.

**(B) User endpoint — `GET /me/ai-usage`.**
New `src/ai/usage/ai-usage.controller.ts` (or extend `users.controller.ts`). `AuthGuard('jwt')`; reads **`req.user.userId` only** — never a path-param user. Returns `AiUsageSummary` for the caller. PII-free by construction (only the self's counts/limits/timestamps; no other user reachable). The API returns **tokens** (true unit, needed for meter==gate); the **frontend** maps tokens→"AI helps" via the shared `displayHint.tokensPerUnit`. Lawful by default: own-usage transparency is GDPR Art.15, service-operation / `consentPurpose:'analytics'` baseline — **not** personalization.

**(C) Admin endpoints — `GET /admin/ai/usage` (+ `/user/:userId`).**
New `src/admin/ai-usage-admin.controller.ts` + an `AiUsageReportService` under `src/ai/usage/`. Guard `@Roles('admin')`, `recordAudit` on every read (follow `admin.controller.ts:19,67`). Aggregate query mirrors `getEconomics` but adds the **per-user breakdown it lacks**:

```ts
prisma.aICallLog.groupBy({
  by: ['userId', 'provider', 'model'],
  _sum: { totalTokens: true, estimatedInputTokens: true, estimatedOutputTokens: true, estimatedCost: true },
  _count: { _all: true },
  where: {
    createdAt: { gte: thirtyDaysAgo },
    provider: { not: 'stub-model' },
    usageSource: { in: ['provider', 'estimated'] },
  },
  orderBy: { _sum: { estimatedCost: 'desc' } },
  take: topN,
});
// both queries hit an index: [userId,createdAt] and [provider,model,createdAt] (schema.prisma:942,945)
```

Response: `{ window:{days:30}, aggregate:{totalTokens,totalCostUsd|null,distinctUsers,byProvider,byModel,byWindow}, topSpenders:[{userId,tokens,costUsd|null,callCount}], costStatus:'real'|'awaiting_pilot'|'awaiting_rates' }`. Ties broken by `userId` asc (deterministic). The `/user/:userId` drill-down returns the same numeric `AiUsageSummary` the user sees — **no message content, no email/name join** (follow the privacy-guardian precedent that strips payload, `admin.service.ts:182-187`).

**[قطعی] Cost-path trap.** There are **two** cost engines. The orchestrator uses the **catalog** (correct). `src/ai/cost/ai-cost-policy.ts` `estimateCostUsd()` reads `modelRatesUsdPer1k` which is `{}` → null forever. **New endpoints must read the persisted `AICallLog.estimatedCost`** (already computed at write time), never recompute via the policy path.

### 3.3 Pillar B — the analytics tool registry (Layer 2, the keystone)

New module `src/analytics/admin-brain/`:
- `analytics-tool.types.ts` — the contract:
  ```ts
  interface AnalyticsTool<P, R> {
    name: string;               // 'most_popular_dishes', 'search_gaps', ...
    description: string;        // for the LLM tool-selection prompt
    paramsSchema: ZodSchema<P>; // date range, segment, topN — validated before run
    run(params: P, ctx: AnalyticsCtx): Promise<AnalyticsResult<R>>;
  }
  interface AnalyticsResult<R> {
    metric: string;
    status: 'real' | 'awaiting_data';                                  // extend the existing honesty substrate
    value: R;                                                          // the deterministic number/series/list
    lineage: { source: string; query: string; windowDays?: number; rowCount?: number; computedAt: string };
  }
  ```
- `analytics-tool-registry.service.ts` — registers tools; exposes `list()` (for the LLM) and `run(name, params)` (the **only** execution path: validates params, stamps lineage, enforces the k-anon floor centrally).
- `tools/*` — one thin deterministic wrapper per metric, **delegating to Layer 1** wherever possible (don't reimplement):

| Tool | Delegates to / source | State |
|---|---|---|
| `most_popular_dishes` | `AdminService.getRecipeStats` + `observability.counters` cook-through | **real** |
| `active_cooks` | `distinctUsers('cook_complete')` (analytics-intelligence) | **real** |
| `trends` | `AnalyticsIntelligenceService.getTrends` | **real** |
| `cohort_retention` | `getCohorts` | real math / awaiting volume |
| `funnel_dropoff` | `getFunnels` | real math / awaiting volume |
| `dna_maturity_bands` | `getProductIntelligence().foodDna` | **real** |
| `consent_posture` | `OpsIntelligenceService` byPurpose | **real** |
| `cost_per_user` / `top_cost_spenders` | the §3.2(C) groupBy | **real** (precond: Gemini rows) |
| `most_asked_intents` | `groupBy` JSON-path on `UserEvent.payload.intent` | **partial** (JSON extract) |
| `allergy_diet_distribution` | **new** groupBy over `UserAllergy`/`UserPreference.diet`/`UserHealthGoal` | **partial** (cheap) |
| `search_gaps` | **new** `UserEvent` type `search_unmet` (§3.5) | **needs persistence first** |

**[قطعی] k-anonymity in `run()`, not per-tool.** Any segment/distribution bucket with `n < K` (K=5) collapses to `'<5 suppressed'`. Centralizing means no tool can accidentally leak a re-identifiable small segment. (Distinct from the per-user cost endpoint, which is admin-authorized attribution and intentionally per-user.)

### 3.4 Auto-insights job (Layer 2 → precomputed cards)

New `src/analytics/admin-brain/auto-insights.service.ts` + a scheduled trigger (**reuse the repo's existing job runner** — do not invent a cron). Runs the registry's "insight" tools on a cadence (hourly for cost/anomaly, daily for cohort/insight), diffs against the previous run for WoW deltas, writes panel cards. Deterministic detection; LLM narration optional (ship narration-free first).

**One new table** (the only schema add in Pillar B): `AdminInsightSnapshot { id, metric, periodStart, periodEnd, payloadJson, status, computedAt }` — append-only, **aggregate-only (no PII)**, so cards load instantly and trend history is free. [احتمالاً] justified: precompute is standard for dashboard latency.

### 3.5 The search-gap persistence fix (do this early, ~30 min)

Everything needed exists; only the emit is missing. In `src/recipes/search/recipe-search.service.ts`:
- Inject `AnalyticsService`; thread `opts.userId` into `recordUnmetSearch` (it already has it in `search()`).
- At `recordUnmetSearch` (`:120`), in addition to the in-memory log, emit:
  ```ts
  this.analytics.trackEvent({
    userId: opts.userId ?? SYSTEM_ANON,                 // anon allowed; never a raw identity
    type: EventType.SEARCH_UNMET,                        // src/analytics/event-taxonomy.ts:148
    payload: { queryLen: query.length, queryTokens: redactedTokens(query) }, // REDACTED, never raw free-text
  });
  ```
- **[قطعی] Privacy:** do **not** store the raw query string — length + redacted/normalized tokens only (the sanitizer already drops free-text/PII keys; be explicit). `search_gaps` then `groupBy`s these to rank unmet demand. Keeps the goldmine without storing verbatim user text. Output feeds `IDEAS_AND_GAPS` (partner-mandate) + the data-quality roadmap.

### 3.6 The NL admin brain (Layer 3) — build LAST

New `src/analytics/admin-brain/nl/admin-nl-query.service.ts`: English question → LLM call with the registry's `list()` as **tool definitions** → LLM picks `{toolName, params}` → registry `run()` computes → LLM narrates the returned number + picks a chart type. **Hard rules enforced in code, not just the prompt:**
1. The LLM is given **only** the tool list — no DB handle, no SQL capability. It cannot reach a table.
2. Narration receives the deterministic `AnalyticsResult` and may state **only** numbers present in `value`. A cheap post-check (number-set guard) **rejects** any response containing a numeric token not traceable to the result.
3. Unknown intent → LLM calls no tool → service returns `"I can't answer that yet (no governed metric)."` No fabrication path exists because there is no SQL path.
- **Reuse the orchestrator** (`src/ai/orchestrator/ai-orchestrator.service.ts`) so this LLM usage is itself logged to `AICallLog` (admin AI cost is metered too — nice symmetry). Don't stand up a second LLM client.
- **Audit:** every answer logs `{ adminUserId, question, toolName, params, lineage, narration }` via `recordAudit` (+ an optional `AdminNlQueryLog` for full reproducibility).

### 3.7 Governance (enforced structurally)

[قطعی] Three rules, each backed by a mechanism, not a promise:
1. **Deterministic compute, LLM narrates — never reverse.** Enforced by tools-only (§3.6). Every `AnalyticsResult` carries a first-class `status:'real'|'awaiting_data'` (extends the substrate `AnalyticsIntelligenceService`/`OpsIntelligenceService` already use). Never render a number without provenance.
2. **Read-only by default; supervised autonomy gated + deferred.** Layers 2–3 are all `SELECT`/aggregate — **zero write paths**. The L2b "~200 params + supervised autonomy" action layer (pause user, edit corpus, change a setting) is a **separate** module behind an explicit human-confirm gate, never reachable from the analytics brain. **Not in this build.**
3. **PII-free aggregates, consent-scoped.** K=5 floor centralized in `registry.run()`. Personal-data distributions read under the existing consent read-gate (analytics baseline lawful; personalization-derived cohorts respect withdrawal per the consent-architecture memory). Full audit on every read.

---

## 4. Capability matrix (grouped)

Format: `capability | example (admin asks / user sees) | required data | deterministic success criterion`. The numbers are deterministic-checkable; only Group 4/5 narration involves the LLM, and even then the **figure** is checked against a tool result.

### Group 1 — User-facing cost transparency (in profile)
| capability | user sees | required data | success criterion |
|---|---|---|---|
| Usage meter | "12 of 50 AI helps this week" + bar | per-user window counter | meter value == the counter the gate reads, to the unit |
| Remaining | "38 left" | limit − consumed | `remaining = max(0, limit − consumed)`, never negative |
| Reset/relief copy | "frees up in ~3h" | `earliestReliefAt` | derived from real oldest in-window row; copy never says "calendar reset" |
| Approaching-limit nudge | banner at 80%, wall message at 100% | used/limit ratio | fires at ≥80% / ≥100%, once per window |
| Fair-use message | "used this week's helps — upgrade for more" | gate decision | shown **iff** the request was actually blocked |
| Unit hiding | tokens never shown as integers | `displayHint.tokensPerUnit` | no raw token integer rendered to the end user |

### Group 2 — Admin cost dashboard (deterministic, no LLM)
| capability | admin asks | required data | success criterion |
|---|---|---|---|
| Per-user cost | "cost for user-X this month" | `AICallLog.estimatedCost` per user | = Σ persisted `estimatedCost` for that user/window, to the cent |
| Top-N spenders | "5 most expensive users" | per-user cost agg | 5 ranked desc; ties → `userId` asc |
| Per-provider/model/surface | "tokens by model" | summed usage by dim | dimension totals sum to the global total (no unattributed leakage) |
| Token mix | input/output split | summed token fields | buckets sum to total; (cache split deferred — Gemini, not Claude) |
| Avg cost / call | "average chat-turn cost" | cost ÷ count | = total_cost / count over window |
| Burn-rate / projection | "projected month spend" | daily spend series | run-rate × days-remaining, **labeled estimate** |
| Honesty badge | every cost card | `costStatus` tri-state | `real` / `awaiting_pilot` / `awaiting_rates` shown; never a bare number |

### Group 3 — Cost anomaly / abuse (deterministic alerts) — [DEFER to post-dashboard]
| capability | admin sees | required data | success criterion |
|---|---|---|---|
| Per-user $-cap alert | "user-X over threshold / 24h" | rolling per-user cost | fires iff cumulative cost in window > threshold; one alert per breach |
| Spike vs baseline | "cost 2.4× the 7-day baseline" | trailing same-hour cost | fires when ratio > 2× (configurable) |
| Quota gate (preventive) | request blocked at limit | live counter (`checkAllWindows`) | blocks the (N+1)th; no over-serve — **already enforced today** |
| Failed/refused tracking | refusal/error rate per user | `usageSource`/status rows | counts blocked/errored calls, not dropped |

### Group 4 — NL analytics (LLM maps → deterministic computes → LLM narrates) — [LAST]
| capability | admin asks | required data | success criterion |
|---|---|---|---|
| English→governed metric | "how many cooked this week?" | registry `list()` | maps to a defined tool or returns "not defined"; never freehand SQL |
| Number-with-narration | "1,240 weekly cooks, up 8%" | tool `AnalyticsResult` | stated number == `value`, byte-for-byte |
| Param extraction | "…last 30 days, vegan users" | Zod param schema | extracted params applied + echoed back |
| Refusal on undefined | "LTV by acquisition channel?" | (metric absent) | explicit "I can't answer that yet"; **no number** |
| Audit trail | every answer | question→tool→params→rows | reproducible from the logged tool call; 100% logged |

### Group 5 — Proactive auto-insights (deterministic detection, LLM summarizes)
| capability | admin sees | required data | success criterion |
|---|---|---|---|
| **Search-gaps / unmet demand** (lead) | "rising zero-result: 'seitan'" | `search_unmet` events | every gap traces to logged events; ranked by frequency; raw text absent |
| Most-popular dishes | "Top cooked: Tahdig, Ghormeh Sabzi" | `cook_complete` events | ranked by **completed cooks**, not views |
| Most-asked intents | "Top intents: substitution, during-cook" | `payload.intent` groupBy | counts reproducible from logged turns |
| Trends / movers | "Tahdig cooks +35% WoW" | two-window series | delta sign + magnitude exact |
| Cohort retention / drop-off | "week-4 retention 22%; drop at first-cook" | activity by signup cohort | retention = active/cohort-size; funnel steps sum |
| Allergy/diet distribution | "31% halal, 12% vegan" | observances (consented) | shares sum to 100% over consented base; segments n<5 suppressed |

### Group 6 — Governance & privacy (cross-cuts Groups 4–5)
| capability | example | success criterion |
|---|---|---|
| LLM-never-fabricates | all numeric answers | every figure traceable to a tool result; reject otherwise |
| Read-only default | analytics AI can't mutate | zero write/action paths reachable from the brain |
| Supervised-autonomy gate | "pause user-X?" → confirm | no action without explicit human confirm; all logged (**deferred**) |
| PII-free aggregates | counts/rates/distributions only | no identifiable row returned; cohort floor n≥5 |
| Consent-scoped | excludes withdrawn users | analytics over consented base; withdrawal removes from aggregates |

---

## 5. Eval cases

`id | input → expected deterministic answer | invariant`. All deterministic-checkable; the NL cases check tool-selection + number-fidelity (no LLM-judge needed for the figures). These are the gates a phase must pass before it ships.

**Pillar A — usage readout**
1. **A-USAGE-EXACT** — User U: 12,000 real-provider tokens in the daily window (limit 200k). `GET /me/ai-usage` → `daily.consumedTokens=12000, remainingTokens=188000, fractionUsed=0.06`. Invariant: `remaining = limit − consumed`, never negative.
2. **A-METER-EQUALS-GATE** — U at 199,500/200k daily. `daily.remainingTokens` (500) MUST equal what `checkAllWindows` allows before blocking (a ≤500-token call passes, 600 blocks). Invariant: **meter == gate**, same aggregate (the #1 trust failure).
3. **A-ROLLING-RELIEF** — U at cap in 5h; oldest in-window row at T. `earliestReliefAt == T + 5h`, `resetModel:'rolling'`. Invariant: relief from the real oldest row; copy never says "calendar reset."
4. **A-STUB-EXCLUDED** — U: 50k `provider='stub-model'` + 3k real. `consumedTokens=3000`. Invariant: the free deterministic path never consumes budget.

**Cost-per-user**
5. **A-COST-REAL** — U: rows `gemini/gemini-3.1-flash-lite` (in=1000,out=1000) + (in=2000,out=500). Expected `costUsd = (1000·0.25+1000·1.5)/1e6 + (2000·0.25+500·1.5)/1e6 = 0.00175 + 0.00125 = 0.003`. `/admin/ai/usage/user/U` → `costUsd=0.003`, `costStatus:'real'`. Invariant: matches `estimateCostUsdFromCatalog` to 1e-6, read from persisted `estimatedCost`.
6. **A-COST-WRONG-MODEL-NULL** — U's rows are `gemini/gemini-3.5-flash` (inactive rate). `costUsd=null`, `costStatus:'awaiting_rates'`. Invariant: honest-null on unmatched model id — the env-mismatch trap surfaces, not faked.
7. **A-TOPN-DETERMINISTIC** — A($0.30), B($0.30), C($0.10). `topSpenders` (N=2) → `[A,B]`, A/B ordered by `userId` asc on the tie. Invariant: deterministic tiebreak.

**Zero PII leak**
8. **A-NO-PII-USER** — `GET /me/ai-usage` JSON has no email/name/raw prompt/`ChatMessage.content` — only tokens/limits/timestamps. Invariant: regex finds zero `@`-emails, zero free-text fields.
9. **B-NO-PII-ADMIN-AGG** — `allergy_diet_distribution` with a 3-user segment → that bucket renders `'<5 suppressed'`. Invariant: K=5 floor enforced centrally; no segment n<5 emitted.

**Pillar B — question → deterministic answer**
10. **B-POPULAR-REAL-COOKS** — Ghormeh Sabzi `cook_complete`×40 / view×500; Tahdig `cook_complete`×55 / view×300. `most_popular_dishes` (by cooks) → Tahdig #1, Ghormeh Sabzi #2. Invariant: ranked by completed cooks, NOT views.
11. **B-SEARCH-GAP-PERSISTS** — Emit 7 `search_unmet` for token "seitan", **restart the process**, run `search_gaps` → "seitan" count 7. Invariant: survives restart (proves the in-memory→`UserEvent` fix); every gap traces to logged events; raw text absent.
12. **B-NL-NUMBER-FIDELITY + REFUSE** — (a) "how many cooked this week?" → brain calls `active_cooks`, result 1,240; narration states exactly "1,240" (post-check passes). (b) "LTV by acquisition channel?" → no governed metric → "I can't answer that yet," **no number**. Invariant: every figure traces to a tool result; undefined → explicit refusal.

---

## 6. Phased roadmap (what ships first, each gated by eval, PII-free)

Each phase is independently shippable and independently demoable. **Gate = the listed evals pass.** Effort tags are [حدسی] order-of-magnitude, not commitments.

### Phase 0 — Trust the ledger (precondition, ~1 hr, do before any UI)
- Verify deployed `GEMINI_MODEL == gemini-3.1-flash-lite` (env check, 5 min — the single silent "$ always null" trap; if it's `gemini-3.5-flash`, that row is `isActive:false`).
- Turn on one live chat turn; confirm a `provider='gemini'` row lands with non-null `estimatedCost`.
- **Gate:** a real Gemini row exists with non-null cost. **Until this passes, do not show $ anywhere.**
- **Why first:** dashboards on a blind ledger are false confidence (the task #21 caveat).

### Phase 1 — Per-user cost transparency (the quickest concrete win, ~2–3 days, ZERO schema)
- Add `getUsageSummary(userId)` (§3.2A). Expose `GET /me/ai-usage` (self-only) + `GET /admin/ai/usage` (+ `/user/:userId`, audited).
- FE: usage meter / remaining / "frees up in" / 80% nudge in the profile, tokens hidden behind `displayHint`.
- **Gate:** evals A-USAGE-EXACT, A-METER-EQUALS-GATE, A-ROLLING-RELIEF, A-STUB-EXCLUDED, A-COST-REAL, A-COST-WRONG-MODEL-NULL, A-TOPN-DETERMINISTIC, A-NO-PII-USER.
- **Why this first:** the substrate is 100% ready; it's pure read-wiring; it directly satisfies both halves of ask 1a; it's the most visible "this is real" demo for the lowest cost. **This is the recommended first ship.**

### Phase 2 — Persist the search-gap + analytics cards (~3–5 days, one tiny table)
- **2a (do at the very start, ~30 min):** emit `search_unmet` (§3.5). Highest leverage-to-cost ratio in the whole pillar; without it the most valuable signal is lost on every deploy.
- **2b:** build the analytics tool registry (§3.3) — wrap existing engines, add `allergy_diet_distribution` + `search_gaps` + `most_asked_intents`, centralize the K=5 floor.
- **2c:** auto-insights job → `AdminInsightSnapshot` → `GET /admin/analytics/insights`. **Lead card = search-gaps**, then most-popular (real cooks), intents, trends, cohorts, allergy/diet, cost-per-user.
- **Gate:** B-POPULAR-REAL-COOKS, B-SEARCH-GAP-PERSISTS, B-NO-PII-ADMIN-AGG; honesty badge present on every card.
- **Why second:** delivers ask 1b's "most-asked / most-popular / trends / +more" deterministically, zero hallucination risk, and feeds the content roadmap.

### Phase 3 — Cost anomaly feed (~2–3 days, optional, [DEFER if time-boxed])
- Deterministic alerts (Group 3): per-user $-cap, 2×-spike-vs-baseline, failed/refused tracking. The preventive quota gate **already exists** (`checkAllWindows`); this adds the **detective** half.
- **Gate:** alert fires iff threshold crossed; one alert per breach.
- **Why here:** valuable for ops once there's real spend, but lower founder-visibility than the dashboard; safe to defer past launch.

### Phase 4 — The NL analytics brain (LAST, ~1 week, gated hard)
- Build `admin-nl-query.service.ts` (§3.6): tools-only LLM through the orchestrator, number-fidelity post-check, refusal-on-undefined, full audit. Read-only.
- **Gate:** B-NL-NUMBER-FIDELITY + REFUSE; the post-check rejects any untraceable numeric token; zero write paths reachable.
- **Why last, and I'll defend this:** it's a demo magnet but the **riskiest, lowest-ROI** piece to build first. Without the Phase-2 registry it would confidently fabricate your own KPIs to you. The registry is reused by all of Groups 4–5, so it must exist first regardless.

### Explicitly deferred (not in this build)
- **Supervised-autonomy / actions** (L2b "~200 params"): pause user, edit corpus, change settings. Separate module, human-confirm gate. Defer until the read brain is trusted.
- **Claude cache-token pricing** (`cache_creation` ~1.25×, `cache_read` ~0.1×): the live model is **Gemini**, not Claude. `AICallLog` already has `cacheTokens`/`cacheHit` columns to extend later. Building Claude-specific cache pricing for a Gemini deployment is speculative — **[احتمالاً] defer until an Anthropic model goes live**, then add `cacheWriteRateUsdPer1M`/`cacheReadRateUsdPer1M` to `AiModelRate` and extend `estimateCostUsdFromCatalog`.
- **Verbatim "most-asked questions"** (raw user text mining): lawyer-gated privacy decision. "Most-asked" means **structured intents** until then.
- **Promoting `payload.intent` to an indexed column / `AiTurnDecision` table:** only when pilot volume makes JSON-path extraction slow. Premature at zero volume.

---

## 7. Honest scope statement

[قطعی] **What's real today:** the ledger, the active cost catalog, the per-window aggregates, two honesty-tagged analytics engines, and the full event taxonomy (including a `search_unmet` enum nobody emits yet). The math and schema are genuinely strong.

[قطعی] **What's actually ~0% shipped:** every user- or admin-**facing** surface for this pillar. There is no usage endpoint, no per-user cost endpoint, no search-gap persistence, no tool registry, no NL brain. "Substrate ready" ≠ "feature done." A founder should read this as: **the hard data engineering is behind us; the remaining work is read-wiring + UI + one tiny table + one event emit** — which is exactly why Phase 1 ships in days, not months.

[احتمالاً] **The one thing that could embarrass a demo:** showing per-user $ before confirming a real Gemini row with non-null cost exists (Phase 0). Live chat is OFF by default; the historical rows are stub-model with null cost. Do Phase 0 first, full stop.

**The one thing not to do:** don't build the NL "ask anything" brain before the deterministic registry — it will confidently lie about your own KPIs, the worst failure mode for an admin tool. And don't build Claude cache-pricing for a Gemini deployment.

---

## 8. نتیجهٔ عملی (what to do now, in order)

1. **[اولویت ۱ — Phase 0]** Verify `GEMINI_MODEL == gemini-3.1-flash-lite`; run one live turn; confirm a `provider='gemini'` row with non-null `estimatedCost`. **Until this passes, $ stays hidden.** (~1 hr)
2. **[اولویت ۱ — Phase 1]** Add `getUsageSummary(userId)` to `persisted-daily-budget.service.ts` (all 4 windows + cost-today, rolling-relief copy). Ship `GET /me/ai-usage` (self-only) + `GET /admin/ai/usage` (+ `/user/:userId`, audited). **Zero schema. Ships per-user transparency — the recommended first concrete win.** (~2–3 days)
3. **[اولویت ۱ — Phase 2a]** Emit `EventType.SEARCH_UNMET` (redacted tokens) from `recipe-search.service.ts:120`. Highest leverage, ~30 min — without it the best analytics signal dies on every deploy.
4. **[اولویت ۲ — Phase 2b/2c]** Build the analytics tool registry (delegate to existing engines, centralize K=5) + auto-insights job → `AdminInsightSnapshot` → `/admin/analytics/insights`. **Lead with the search-gap card.**
5. **[اولویت ۳ — Phase 4]** NL admin brain **last**: tools-only LLM through the orchestrator, number-fidelity post-check, refusal-on-undefined, full audit, read-only.

**Key files** — new: `src/ai/usage/ai-usage.controller.ts`, `src/admin/ai-usage-admin.controller.ts`, `src/analytics/admin-brain/{analytics-tool-registry.service.ts, auto-insights.service.ts, tools/*, nl/admin-nl-query.service.ts}`. Modified: `src/ai/cost/persisted-daily-budget.service.ts` (+`getUsageSummary`), `src/recipes/search/recipe-search.service.ts` (emit `search_unmet`), `src/admin/admin.controller.ts` (+routes). Reused as-is: `src/ai/cost/ai-cost-rate-catalog.ts`, `src/ai/logging/ai-call-log.service.ts`, `src/analytics/intelligence/ops-intelligence.service.ts`, `src/analytics/intelligence/analytics-intelligence.service.ts`, `src/analytics/analytics.service.ts` (`trackEvent`), `src/analytics/event-taxonomy.ts` (`SEARCH_UNMET`).
