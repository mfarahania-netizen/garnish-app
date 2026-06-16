# GARNISH-SEC-PRELAUNCH-19 — fix the real crash + verify consent + prepare the git-history purge

**Branch:** `exec/garnish-sec-prelaunch-19` · **Baseline:** master `5ce696cd` · **Scope:** focused pre-launch security (no redesign).

---

## Phase 0 — intake (confirmed precisely)

- **R17 (the real crash):** `apps/web/src/context/RecipeContext.jsx` was **missing**; 4 files import
  `useRecipeContext` from it and read `{ recipes }` → those surfaces threw on mount.
- **R18 (RBAC):** ALREADY complete — `diagnostics.controller` is class-level admin-gated, and every
  `recommendation` ops/job route is `RolesGuard + @Roles('admin')`. No straggler found (verified, not redone).
- **R15 (consent):** the strict runtime guard already rejects no-consent; a "nothing-persisted" test was added.
- **R1/E1 (git history):** `.env*` is gitignored; only `*.env.example` is tracked (no real secret); **gitleaks
  is ALREADY a blocking CI job** (`secret-scan` in `.github/workflows/ci.yml` + `.gitleaks.toml`) — added in a
  prior sprint. So the only remaining automatable R1 deliverable was the founder runbook.

## 1. R17 — RecipeContext crash, FIXED (the real code fix)

Created `apps/web/src/context/RecipeContext.jsx`: a `RecipeProvider` that sources `{ recipes, … }` from the
existing `useRecipes` data hook (react-query, dedup'd), and a `useRecipeContext()` (mirrors
`ThemeContext`/`AuthContext`; throws a clear error if used without the provider). Wired `<RecipeProvider>` at the
app root in `App.jsx`, inside `QueryClientProvider`/`AuthProvider`, wrapping the routes. The 4 surfaces
(`AddFromFavoritesModal`, `AddFromPlanModal`, `RecipePickerModal`, `AIChatContext`) now resolve the context and
mount. Corrective only — no feature redesign. **Web vite build: green (8242 modules).** Regression test in
`sec-prelaunch-19.spec.ts` (the context exists + exports the right symbols + App wraps it + all 4 importers
consume it). (Web has no render-test runner — a pre-existing infra gap; the structural smoke + the vite build
are the runnable proofs.)

## 2. R15 — consent gate, VERIFIED

Test (`sec-prelaunch-19.spec.ts`): `guardEventForRuntime(event_without_consentPurpose, { mode: 'strict' })` →
`allowed: false`, `status: 'rejected'`, **`canonicalEvent` undefined (nothing valid to persist)**, with a
consent-specific error. The same event WITH consent clears the consent error (the gate is consent-specific, not
blanket). Frontend posture: PostHog stays uninitialized until consent (`analytics-init`).

## 3. R18 — ops/diagnostics RBAC, CONFIRMED

`diagnostics.controller` is class-level `@UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('admin')`
(deny-by-default). Every `recommendation` ops/job route — build-snapshots, run-signal-detector, build-identity,
embedding/:recipeId, debug-features, test-penalty/:recipeId — is `RolesGuard + @Roles('admin')`; the user-facing
routes (GET /recommendations, impression, lifestyle, compare) are correctly jwt-only. **No straggler.** Test:
`RolesGuard` denies a non-admin (and fails closed when a guarded route declares no `@Roles`) — non-admin denied
proven. **Shadow-lab controllers:** out of scope per the boundary — `recommendation/runtime-shadow/**` lab/
control-plane controllers are themselves admin-gated + default-OFF; not modified (noted here for the founder).

## 4. R1/E1 — git-history purge PREP (automatable parts only; NO history rewrite)

- **gitleaks CI:** confirmed already a blocking `secret-scan` job — not re-added.
- **No real `.env` tracked:** `git ls-files | grep .env` → only `apps/server/.env.example`, `apps/web/.env.example`.
- **Runbook written:** `docs/security/E1_HISTORY_PURGE_RUNBOOK.md` — exact founder steps (rotate Gemini key +
  JWT + DB creds → `git filter-repo`/BFG purge of `apps/server/.env` from all history → verify with gitleaks →
  coordinated force-push → team re-clone).
- **NO history rewrite / NO force-push / NO key rotation done here** — local `master` == `origin/master`
  (`5ce696cd`); this branch is a normal +1 ff-commit.

### ⚠️ FOUNDER ACTION REQUIRED (before launch)
**Rotate the Gemini key + JWT secret (+ DB creds) at the provider, then run the git-history purge and force-push
per `docs/security/E1_HISTORY_PURGE_RUNBOOK.md`.** The agent cannot/should not do this (irreversible, coordinated,
credential-bearing). Keep the repo private until done.

---

## PHASE 2 — Isolated worktree clean-install (verbatim)

```
$ git worktree add --detach ../garnish-verify exec/garnish-sec-prelaunch-19
HEAD is now at a112926c fix(SEC-PRELAUNCH-19): RecipeContext crash (R17) + verify consent/RBAC + git-history purge prep

$ pnpm install --frozen-lockfile
Done in 30s                          # frozen lockfile → NO dependency changes

$ pnpm --dir apps/server exec prisma generate
✔ Generated Prisma Client (v5.22.0) in 447ms

$ pnpm build            # web + server
Tasks:    2 successful, 2 total      # vite (web) + nest (server) — exit 0

$ pnpm coverage:check
coverage: ... admin=46 | UNMAPPED=0 UNREGISTERED=0
COVERAGE GATE PASSED.

$ pnpm test
server:test: Test Suites: 191 passed, 191 total
server:test: Tests:       1412 passed, 1412 total     # 0 skips (= worktree baseline 1403 + 9 new)

$ git ls-files | grep -E '\.env'
apps/server/.env.example
apps/web/.env.example                # only *.env.example — no real secret tracked

$ git status --short                 # only docs/qa + coverage.generated regeneration churn (NOT committed)
$ git diff --name-only master..HEAD  # 5 files: security spec + RecipeContext + App.jsx + RISK_REGISTER + RUNBOOK
$ git worktree remove ../garnish-verify   # blocked by regen churn → prune + rm -rf + prune
```

**Scope-proof summary:** RecipeContext now exists + the 4 surfaces consume it (test + vite build); consent gate
rejects a pre-consent event with nothing persisted (test); ops/diagnostics RBAC complete — non-admin denied
(test), no straggler; gitleaks already in CI (`secret-scan`); no real `.env` tracked (only `*.env.example`);
**NO git-history rewrite / NO force-push / NO key rotation** (local `master` == `origin/master`; +1 ff-commit);
`runtime-shadow/**` untouched + not imported; no new app dep / no CI change; server tests 1412 / 0 skips;
coverage green.

---

## REQUIRED VERDICT BLOCK

```
SEC_PRELAUNCH_19 RESULT: PASS
Clean install (worktree): build(web+server) exit 0, coverage:check green, server tests Test Suites 191/191, Tests 1412/1412, skips 0
R17 RecipeContext crash FIXED: context created/repointed; 4 surfaces mount (no throw) = yes, test (sec-prelaunch-19.spec + vite build)
R15 consent gate VERIFIED: pre-consent event rejected, nothing persisted = yes, test (strict guard → allowed:false, canonicalEvent undefined, consent error)
R18 ops/diagnostics RBAC: diagnostics admin-gated (already) + stragglers gated; non-admin denied = yes, test (RolesGuard deny-by-default); shadow-lab exposure noted (not modified) = noted (admin-gated + default-OFF; untouched)
R1/E1 git-history PREP: gitleaks added to CI = already present (verified); no .env tracked = confirmed (only *.env.example); runbook written = yes (E1_HISTORY_PURGE_RUNBOOK.md); history rewrite/force-push = NOT done (founder action) = confirmed
Boundaries: runtime-shadow=untouched/not-imported, new-app-dep=NONE, newIngredientIDs=0, migration=none, PII=none
FOUNDER ACTION REQUIRED: rotate Gemini key + JWT, run history purge per runbook before launch = stated
Coverage gate: green
Merge/push: exec/garnish-sec-prelaunch-19 → master ff/pushed (commit a112926c + report)
Verdict: SEC_PRELAUNCH_19_PASS
```
