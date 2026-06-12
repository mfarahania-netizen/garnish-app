# Garnish OS — Structure & Design Audit (evidence)

> **What this is:** a read-only, multi-agent engineering+design audit (7 area lenses + synthesis +
> a skeptical verification pass). It is **evidence**, not a set of decisions. It feeds the W5
> `COMPONENT_MIGRATION_MAP.md` and an engineering cleanup register. CA gathers evidence; UX owns the
> design language, EL owns architecture decisions, ADV owns compliance calls.
> Generated 2026-06-13 on branch `exec/w1-security-foundation`.

## ⚠️ Read this first — corrections from the verification pass
The synthesis below is faithful, but the skeptical pass (bottom section) **downgraded several
"CRITICAL" items**. Do not act on these without re-checking:

- **"PostHog key leaked in version control" → overstated.** `apps/web/.env` is **gitignored and not
  tracked** (confirmed). The real exposure was the *hardcoded fallback key in `main.jsx`* — already
  removed in **E4** (key now env-only). Action: confirm the key was never committed on any branch; rotate
  only if it actually leaked. Not a history-purge item.
- **"~700KB of `*.log` committed" → overstated.** Root `*.log` files are **not tracked** (gitignored).
- **`MealPlannerContext` missing → not build-breaking.** Its barrel (`features/meal-planner/index.js`) is
  imported nowhere. **But `RecipeContext` is real and verified** — 4 live files import a non-existent
  `context/RecipeContext`; those components **will throw when mounted**.
- **"24% / 9-of-37 services tested" → recount before quoting** (the report's own numbers are inconsistent).
- **DATA_CONSTITUTION-mandated schema gaps** (UserRecipeInteraction, nutrition per-100g, RecipeStep
  difficulty/risk, intentTags) assume that doc is normative-for-Phase-1. Confirm its status before
  treating these as compliance failures vs. backlog.

**The single most important verified-real finding:** **GDPR user-deletion is structurally broken** —
behavioral/feature/outcome models have **no `@relation` to User** and `UserSession`/`UserEvent`/
`UserPreference` use `RESTRICT`, so `prisma.user.delete()` will throw and/or orphan rows. This is both
real and legally consequential; it sets the true remediation priority (above the overstated key issue).
→ logged as **R16** in RISK_REGISTER; directly relevant to **E39** (Erasure/Export/Retention, W-D/W12).

---

## Executive Summary

Garnish OS is a NestJS + Prisma backend paired with a React 19 / Mantine 9 / Vite PWA, targeting an
ambitious 17-layer architecture. The foundation is real: clean controller→service→Prisma boundaries,
recently hardened environment validation (W1/E1–E4), GDPR-conscious consent gating, sound JWT/CORS/
rate-limiting, and a transactional/idempotent ingredient import pipeline. But the system carries
significant structural debt that blocks scale and the planned GES design-system migration. Dominant
themes: **no design token system** (347+ hardcoded inline color styles), **no CI/CD pipeline** with low
backend coverage and zero frontend tests, **critical data-integrity gaps** (missing FK constraints on
feature-store/behavioral models that break GDPR erasure), and several **god-services and dead/duplicate
files** from incomplete refactors (including a missing context file that throws at runtime). Healthy
enough to build on, but the next two sprints should prioritize compliance/data-integrity and CI before
feature work.

| Area | Score | One-line Verdict |
|---|---|---|
| Backend Architecture | 6/10 | Clean boundaries undermined by god-services, cross-module coupling, missing observability. |
| Frontend & Design System | 5/10 | Good feature coverage; blocked by zero design tokens and minimal accessibility. |
| Data Layer | 6/10 | Solid core, but missing FKs and DELETE-policy inconsistencies create deletion hazards. |
| Dead Code & Cleanup | 5/10 | Duplicate services and a missing context file (runtime error) from incomplete refactors. |
| Security & Compliance | 5/10 | Recent hardening is real, but broken erasure cascades are critical. |
| Tests & CI | 3/10 | No CI pipeline, low coverage, zero frontend tests, ~4 failing specs. |
| Dependencies & Build | 6/10 | Decent monorepo; version drift, unused deps, loose TS strictness. |

---

## Backend Architecture (6/10)

**Keep (GOOD)** — clean module structure (14 feature + 2 infra modules; controller→service→Prisma maps
to ~9–10 of the 17 target layers); env validation solid (W1-hardened); DTOs exist for major endpoints.

**Change**
- **[HIGH]** `AdminService` is a monolithic god-service (280+ lines, 20+ methods across analytics/support/
  curation/users) → split into `AnalyticsAggregator`/`SupportAdminService`/`RecipeModeration`/
  `UserAnalyticsService`. `admin/admin.service.ts:6-339`.
- **[HIGH]** `RecommendationModule`↔`AnalyticsModule`↔`BehaviorEngineModule` coupling cycle.
  `recommendation.module.ts:22`, `analytics.module.ts:6`.
- **[MED]** `BehaviorEngineService.processEventsForUser()` hand-calculates 156 lines while
  `SignalCalculatorService` sits unused. `behavior-engine.service.ts:9-156`.
- **[MED]** `AiService.handlePrompt()` 363 lines mixing NLU/extraction/ranking/Gemini. `ai.service.ts:14-363`.
- **[MED]** `console.log` instead of injectable Logger (19 occurrences / 8 services).
- **[LOW]** thin DTO validation; `PrismaService` pass-through (no instrumentation); Recipe JSON-as-String
  fields; `RecipesModule` doesn't export `RecipesService`; `@Roles`/`RolesGuard` exist but unused;
  `EventEnrichmentService.enrichEvent()` fire-and-forget without await/catch.

**Delete** — duplicated recipe-filtering across `AiService.buildWhereClause()`,
`PersonalizationService.getUserRules()`, `RecommendationService.getRecommendations()` → one
`RecipeFilterService`.

**Add** — wire-or-remove `OutcomesModule` (services never imported, idle `@Cron`); global `ExceptionFilter`
in `main.ts` (`{status,code,message,traceId}`); input sanitization pipe for user text.

---

## Frontend & Design System (5/10)

**Keep (GOOD)** — global `RecipeCard` well-built; all 12 GES areas have rough implementations; lazy-loaded
pages with Suspense; clean `ThemeContext` dark-mode; sensible `app/` vs `features/` separation.

**Change**
- **[HIGH]** Mantine theme inline with hardcoded hex (`App.jsx:42-72`); no `src/theme/` constants.
- **[MED]** RTL inconsistent (only ~2 `dir` attrs; `DirectionalIcon` underused); state fragmented across
  useState/react-query/localStorage/unused contexts; dark-mode colors recomputed per component (no
  `useThemedColors()`).

**Delete** — empty 0-byte `features/ai-chat/components/RecipeCard.jsx` (import-confusion).

**Add**
- **[CRITICAL]** Design token system — `apps/web/src/styles/tokens.css` does not exist; **347+ inline color
  styles**. Blocks all GES migration. *(This is exactly the W4/E29–30 work.)*
- **[HIGH]** Accessibility — ~1 `aria-label` codebase-wide; missing alt/roles/aria-live/form labels.
- **[MED]** shared `FormInput`/`useForm` abstraction.

---

## Data Layer (6/10)

**Keep (GOOD)** — 46 models across all 17 layers; ingredient import transactional + idempotent (upsert,
120s timeout); CASCADE sound for user-owned data (Recipe, MealPlan, ShoppingList, Favorites).

**Change**
- **[CRITICAL]** Missing FK constraints on feature-store/behavioral models — `UserFeatureVector`,
  `UserFeature`, `UserOutcome`, `UserIdentityDimension`, `UserBehaviorTimeline`, snapshot models lack
  `@relation` to User → orphaned rows, broken cascading deletion. `schema.prisma:442-457,462-475,479-499,599-639`.
- **[HIGH]** Inconsistent DELETE policies — `UserSession`/`UserEvent` `RESTRICT` (block user deletion) vs
  audit/consent `CASCADE`. `UserPreference` also `RESTRICT` (should CASCADE).
- **[HIGH]** Nutrition model incomplete (missing per-100g, sugar/sodium, serving context — DATA_CONSTITUTION §1.5).
- **[MED]** `RecipeStep` missing timeMinutes/difficulty/risk (§1.8); diet free-text duplicated; missing
  indexes (`featureKey`, `SignalObservation.userId`); recipe seeding not idempotent on partial failure;
  `RecipeIngredient.ingredientId` nullable (`SetNull`) → orphan risk.
- **[LOW]** notes-as-JSON blob; snapshot version-migration never exercised; hardcoded dictionary path.

**Add** — `UserRecipeInteraction` model (DATA_CONSTITUTION §3); `intentTags`/`experienceTags` on Recipe (§1.3).
*(Verify DATA_CONSTITUTION is normative for Phase 1 first.)*

---

## Dead Code & Cleanup (5/10)

- **[CRITICAL — real]** Missing `RecipeContext` — `useRecipeContext` imported by 4 live files but
  `context/RecipeContext.jsx` does not exist → **runtime errors** when those components mount
  (`ai-chat/context/AIChatContext.jsx:4`, shopping `AddFromFavoritesModal`/`AddFromPlanModal`,
  meal-planner `RecipePickerModal`).
- **[overstated]** Missing `MealPlannerContext` barrel — never imported, won't break the build.
- **[LOW]** Three `@ts-ignore` in `experiment-engine.service.ts` (Prisma codegen not in CI); duplicate dev
  test scripts.
- **Delete list** below.

---

## Security & Compliance (5/10)

**Keep (GOOD)** — JWT excludes `isAdmin` from token but includes it in validated context + `SafeUser`;
rate limiting (5/min auth, 200/min global), CORS from `FRONTEND_URL`, global `ValidationPipe`; consent
gating opt-in (default unchecked, PostHog init gated — **E4**); admin routes triple-guarded; avatar upload
MIME/size-limited.

**Change**
- **[CRITICAL — verified]** GDPR erasure broken — `user.delete()` will FAIL on RESTRICT/undeleted children;
  feature/outcome/behavioral tables have no FK → never cleaned. `users.service.ts:157`, `schema.prisma`.
- **[HIGH]** `RolesGuard` allow-by-default (`if (!requiredRoles) return true`) → make deny-by-default,
  wire `@Roles` across admin/moderation. *(This is E3 / E3-0.)* `roles.guard.ts:14-15`.
- **[MED]** erasure doesn't cascade to `DataAccessLog` (`SetNull`); no analytics-payload sanitization
  (PII/log-injection risk); console logging without redaction in signal/retention services.

**Delete / correct**
- **[overstated]** Hardcoded PostHog key — local working `.env` only (untracked). Real fix already done in
  E4 (env-only). Confirm never committed; rotate only if leaked.

**Add** — password reset / account recovery path (none exists).

---

## Tests & CI (3/10)

**Keep (GOOD)** — foundational coverage for recommendation pipeline, evaluation, exposure-tracking,
feature-store, governance-insights, recipes.

**Change** — low backend service coverage (recount the exact ratio); auth had e2e happy-path only
(now + E2 unit/e2e for sanitization); behavior engine ~1/5 tested; ad-hoc e2e; broad jest config without
`coverageThreshold`; Turbo missing a `test` task.

**Delete** — ~4 failing specs (`ranking.service.spec.ts:192`, `recipes.*.spec.ts` DI errors,
`feature-store.service.spec.ts` incomplete mock); shallow "should be defined" specs.

**Add** — **[CRITICAL]** CI/CD (`.github/workflows`) *(this is E6)*; data-import tests *(E9/E10)*; frontend
test harness (vitest + testing-library); RBAC/erasure security tests; AI orchestration tests.

---

## Dependencies & Build (6/10)

**Keep (GOOD)** — Vite `manualChunks` vendor splitting; auth + cache/Redis stacks correctly used.

**Change** — dual ESLint majors (server 9.x vs web 10.x); server TS strictness off
(`noImplicitAny:false`, `strictPropertyInitialization:false`); **no `apps/web/tsconfig.json`** (no client
type-checking); Prettier drift; console.log in prod services; no Turbo `format`/cache.

**Delete** — unused `@google/generative-ai` (0 imports in server src — note: AI uses a different client),
unused `@emotion/react` (web), unused `ts-loader` (server).

**Add** — `noUnusedLocals`/`noUnusedParameters` in both TS configs.

---

## Consolidated DELETE list (re-verify the two ⚠️ items before acting)

| Item | Why | Evidence |
|---|---|---|
| Empty `RecipeCard.jsx` (ai-chat) | 0-byte stub; real card in `components/` | `features/ai-chat/components/RecipeCard.jsx` |
| Empty `ContextPanel.jsx` (ai-chat) | 0 bytes, never imported | `features/ai-chat/components/ContextPanel.jsx` |
| Unused `data/categories.js` | exported, never imported | `apps/web/src/data/categories.js` |
| Duplicate `prisma/prisma.service.ts` + `prisma.module.ts` | active version is `src/prisma/` | `apps/server/prisma/prisma.service.ts` |
| Duplicate `routing/shopping.signal-processor.ts` | active copy in `processors/` | `behavior-engine/routing/shopping.signal-processor.ts` |
| Obsolete `experiment-engine.ts` | module uses `.service.ts` version | `experimentation/experiment-engine.ts` |
| Duplicate `test-exposure.js` | superseded by `test-exposure-final.js` | `scripts/dev/test-exposure.js` |
| Duplicated recipe-filter logic (3 services) | triplicated → `RecipeFilterService` | `ai.service.ts:142-194` etc. |
| Unused `@google/generative-ai` | 0 imports in server src | `apps/server/package.json` |
| Unused `@emotion/react` (web), `ts-loader` (server) | 0 imports | package.json |
| ~4 failing unit tests | broken assumptions/DI/mocks | `ranking.service.spec.ts:192` etc. |
| ⚠️ Root `*.log` | **already gitignored & untracked** — just confirm | root |
| ⚠️ "PostHog key in history" | **untracked**; E4 made it env-only | `apps/web/.env` (local) |

---

## High-priority CHANGES (next 2 sprints) — mapped to Constitution epics

| # | Change | Sev | Epic |
|---|---|---|---|
| 1 | **Fix GDPR erasure**: add FK + `onDelete: Cascade` to behavioral/feature/outcome/snapshot tables; flip `UserSession`/`UserEvent`/`UserPreference` RESTRICT→CASCADE; verify `DELETE /users/me` end-to-end | CRITICAL | **E39** (W-D/W12) + Part 4 lifecycle |
| 2 | Stand up CI/CD (lint+test+Prisma codegen on PR; add `test`/`format` to `turbo.json`) | CRITICAL | **E6** (W-B) |
| 3 | Create design token system (`styles/tokens.css` + `theme/` constants); replace inline `App.jsx` theme | CRITICAL | **E29/E30** (W-B/W4) |
| 4 | Create missing `RecipeContext` (runtime crash today) | CRITICAL | bugfix (pre-W2) |
| 5 | `RolesGuard` deny-by-default; wire `@Roles` across admin/moderation | HIGH | **E3 / E3-0** (W2) |
| 6 | Confirm PostHog key never committed; rotate if leaked | HIGH (was CRIT) | E1/E4 follow-up |
| 7 | Add `UserRecipeInteraction`; complete Nutrition (per-100g/sugar/sodium/serving) *(verify DATA_CONSTITUTION normativity)* | HIGH | E12/E43 data |
| 8 | Fix ~4 failing tests; auth+AI unit tests; frontend test harness | HIGH | E6/test foundation |
| 9 | Decompose `AdminService`; consolidate recipe filtering | HIGH | backend hygiene |
| 10 | Break Recommendation↔Analytics↔BehaviorEngine cycle | HIGH | backend hygiene |
| 11 | Server TS strict flags + add `apps/web/tsconfig.json` | HIGH | E6/build |
| 12 | Global `ExceptionFilter` + structured Logger (replace console.log) | MED | **E7** (W-B) |
| 13 | Accessibility pass (aria/alt/labels) | HIGH | **E33** (W-D) |
| 14 | Sanitize analytics payloads; await/catch `enrichEvent` | MED | E4/E43 |

---

## COMPONENT_MIGRATION_MAP seed (for W5)

| Current Area | Current Issue | Target GES Pattern | Files to Inspect | Priority |
|---|---|---|---|---|
| Home / Command Center | inline `textColor`/`cardBg` recomputed | token surfaces + `useThemedColors()` | `app/home/page.jsx:113-114,225-231` | P0 |
| RecipeCard (global) | type→hex gradients hardcoded | tokenized type-color scale + badge tokens | `components/RecipeCard.jsx` | P1 |
| Recipe Detail | local `cardBg` | accordion + surface tokens | `app/recipe/[id]/page.jsx:85-87` | P1 |
| AI Chat | no explicit empty state; dead local `RecipeCard` | standard empty/loading/error; delete empties | `features/ai-chat/...` | P1 |
| Food DNA Onboarding | **not found — to be built** | new GES onboarding + `FormInput` | (none yet) | P0 |
| Meal Planner | no error boundary; broken barrel | token grid + context + error boundary | `app/plan/page.jsx`, `features/meal-planner/index.js` | P0 |
| Shopping List | relies on **missing `RecipeContext`**; flex w/o RTL | tokenized checklist + RTL-safe | `app/shopping-list/page.jsx`, `components/shopping/*` | P0 |
| Profile / Preferences | local `cardBg`; inline inputs; no avatar alt | surface tokens + `FormInput` + a11y | `features/profile/pages/ProfilePage.jsx` | P1 |
| Bottom Navigation | glass-nav colors hardcoded; flex w/o dir | nav tokens + RTL-aware flex | `layouts/MainLayout.jsx:150,252-269` | P2 |
| Notifications | unreviewed; minimal a11y | tokenized list + aria-live | `features/notifications/*` | P2 |
| Empty/Loading/Error | ~70% coverage, inconsistent, no retry | unified GES state components + retry | `app/home/page.jsx:248-268` | P1 |
| Admin Dashboard | 13 tabs, no tokens, outside `MainLayout` | tokenized admin shell + RBAC tabs | `app/admin/page.jsx` | P2 |

> Shared prerequisite for every row: ship `styles/tokens.css` + `theme/` constants + `useThemedColors()` +
> `DirectionalIcon` adoption + `FormInput` wrapper before per-area migration. (= W4–W5 deliverables.)

---

## Cross-cutting Risks
- **No design tokens + no client type-safety** compound: every GES migration touches nearly every
  component, with no compiler safety net.
- **Compliance is structurally broken, not just incomplete** — missing FKs + RESTRICT + naive
  `user.delete()` mean GDPR erasure cannot succeed today.
- **No CI safety net for a half-untested system** — broken code can land undetected.
- **Incomplete refactors left landmines** — missing `RecipeContext`, duplicate Prisma/processor/engine
  files, idle `OutcomesModule`.
- **God-services + module cycles block testability** — the same isolation the test gaps need.
- **Observability absent** — console.log, no global exception filter, fire-and-forget enrichment.

---

## Audit critique & gaps (skeptical verification pass)

**(a) Not covered / under-covered**
- **DevOps & deployment runtime** — Dockerfiles, docker-compose, Redis required-at-boot vs optional, how
  migrations run in prod. The "no CI" finding only half-touches this.
- **API surface / cross-boundary contract** — no endpoint inventory, no check that frontend calls match
  backend routes, no review of the web API client (base URL, auth header, error handling).
- **PWA layer** — service worker, manifest, offline/caching, install flow explicitly *not reviewed*, yet
  the product is framed as offline-first PWA.
- **package engines / pnpm version / lockfile integrity / Node pinning** — untouched.
- **Scheduler/cron concurrency** — multiple `@Cron` jobs; whether the "dead" `OutcomesModule` `@Cron`
  actually fires if the module is imported (the dead-code claim and a registered `@Cron` contradict).

**(b) Overstated / unverified — double-check before acting**
- **PostHog key "in version control" — overstated.** `apps/web/.env` is gitignored and not tracked. Real
  action: confirm never committed; rotate only if leaked. Not a history purge.
- **"~700KB logs committed" — overstated.** Not tracked.
- **`MealPlannerContext` "module-resolution error" — overstated** (barrel imported nowhere). **But
  `RecipeContext` is real and will throw** (4 live importers). The two CRITICALs are not equivalent.
- **"24% / 9-of-37 services" — internally inconsistent;** recount before quoting.
- **Server TS "silent type errors" — partly speculative;** treat as hygiene, not a proven defect.
- **DATA_CONSTITUTION-mandated gaps** hinge on that doc being normative-for-Phase-1; one item is even
  flagged "intentionally missing." Confirm status before calling them compliance failures.

**(c) Single most important thing to investigate next**
**GDPR user-deletion at runtime.** Schema claim verified real: `UserFeatureVector`, `UserFeature`,
`UserOutcome`, `UserIdentityDimension`, `UserBehaviorTimeline` have **no `@relation` to User**, and
`UserSession`/`UserEvent` use RESTRICT. Execute `DELETE /users/me` against a seeded user with behavioral
history and confirm whether `prisma.user.delete()` throws and whether orphan rows persist. This is the one
finding that is both verified-real and legally consequential — it determines the true remediation order
(above the overstated leaked-key item).
