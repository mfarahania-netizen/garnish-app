# Garnish Household OS — Product Advisory, Architecture & Phased Implementation Program v1

## Final program verdict

`DESIGN_COMPLETE_IMPLEMENTATION_BLOCKED_BY_PREREQUISITE`

**Confidence: certain.** Stage A is complete and evidence-backed. Stage B is prohibited on this base because multiple independent prerequisites fail. No product code, schema, migration, production system, or database was changed.

## Program identity

| Item | Value |
|---|---|
| Date | 2026-07-13 |
| Current `origin/master` | `1631dc5dbf0f0d5b9699399ed8f50ebef4b053ab` |
| Program branch | `program/household-os-v1` |
| Program worktree | `C:\Users\mfara\.codex\worktrees\5464\garnish-app` |
| Base | clean isolated worktree at fetched `origin/master` |
| Master touched | no |
| Production touched | no |
| Database/migration/seed touched | no |
| Product code changed | no |
| Commit/push status | Stage A commit `7b25a9ba` pushed to `origin/program/household-os-v1`; report-closeout commit is the final branch HEAD |

## Phase completion

| Phase | Verdict | Evidence |
|---|---|---|
| 0 — repo/prerequisite reality gate | COMPLETE / PREREQUISITE FAIL | clean base, fetched refs, P0-A status, build/test/source audit in `00_program_context.md` |
| 1 — competitive/product research | PASS | 11 products, 33 current official-source records, no comparison blogs |
| 2 — current Garnish gap audit | PASS | explicit 20-system end-to-end trace and capability matrix |
| 3 — product consultancy/decisions | PASS | 63-row matrix; every founder input/exclusion/new proposal scored and decided |
| 4 — final product definition | PASS DESIGN | 32-section PRD, JTBD, user stories, non-goals |
| 5 — UX specification | PASS DESIGN | 26 A–Z flows, 14 required states, Persian copy, mobile/RTL/accessibility specs |
| 6 — domain/data architecture | PASS DESIGN / HUMAN GATES OPEN | domain, 49-rule permission matrix, realtime/offline and notification ADRs, migration plan |
| 7 — security/privacy | PASS DESIGN / HUMAN GATES OPEN | 40-threat model, security review, 37-scope privacy matrix |
| H1–H6 — implementation | BLOCKED / NOT STARTED | prerequisite gate failed before code authorization |

## Prerequisite verdict

| # | Gate | Verdict | Evidence |
|---:|---|---|---|
| 1 | P0-A merged or equivalent proven | FAIL | P0-A branch still points to the base and its separate worktree has extensive uncommitted changes. |
| 2 | Account A → logout → Account B isolation | FAIL / UNPROVEN | Current logout does not purge Workbox private API cache, TanStack cache, or all user-scoped stores; no browser proof. |
| 3 | Consent/default-off | FAIL | Required fixes overlap unmerged P0-A; current base cannot prove independent optional consent/default-off. |
| 4 | Private PWA/API cache isolation | FAIL | Workbox caches `/api/**` with shared `NetworkFirst` `api-cache`; no account partition/purge. |
| 5 | Current master builds | PASS | `pnpm.cmd build` passed server and web/PWA builds. |
| 6 | Relevant tests pass or blockers documented | PARTIAL | 89 relevant server + 27 relevant web tests passed; full suite has four documented existing frontend smoke failures. |
| 7 | Household data isolated by membership | FAIL | No household/membership/capability model exists in product code. |
| 8 | Disposable local/dev DB separated | UNPROVEN | localhost examples exist, but no `.env`/disposable harness was verified; no DB command run. |
| 9 | Dirty P0-A worktree not used | PASS | program branch was created in the clean Codex worktree from fetched master. |

Independent failures 1, 2, 3, 4, and 7 are sufficient to block implementation; build PASS does not override them.

## Product advisory verdict

`APPROVE_DIRECTION_WITH_STRICT_SCOPE_REDUCTION`

The defensible product is not a shared list, family chat, calendar, or generic notification center. The improved concept is a **private household food decision loop**:

`Meal Board → explainable needs/contributions → Shopping Session → unavailable/substitution decision → acknowledged purchase/cook → bounded household memory`

The strongest wedge is structured resolution of an in-store problem—`unavailable → bounded alternatives/photo when safe → household decision → canonical outcome`—connected to plan provenance and list impact. Current competitors cover shared lists and meal planning; the differentiation is closing the coordination decision without generic chat or surveillance.

### MVP and phased priority

- **P0 / H1–H3:** private household foundation, identity-bound invite, fixed capability presets, shared shopping, explicit Shopping Session, text-first unavailable/substitution decision, server-authoritative in-app notification preferences, idempotency/versioning, realtime delivery and bounded offline recovery.
- **P1 / H4:** Meal Board, member proposals/reactions/attendance, slot-level guest count, deterministic plan-to-shopping diff; private alternative photos only after protected attachment pipeline.
- **P2/P3 / H5:** scoped view/review shares, expiry/revocation and advisor proposals only after usage evidence and privacy/legal gate.
- **H6 later/validation:** verified cook feedback and serving transform only with unit invariants; voice, receipt OCR, social/video import and discovery interaction require evidence/provider/privacy/rights review.

### Decision matrix summary

| Decision | Count |
|---|---:|
| IMPLEMENT_IN_FOUNDATION | 10 |
| MODIFY | 19 |
| KEEP_AS_PROPOSED | 3 |
| IMPLEMENT_LATER | 8 |
| VALIDATE_BEFORE_BUILD | 2 |
| LEGAL_REVIEW_REQUIRED | 2 |
| MERGE_WITH_ANOTHER_FEATURE | 1 |
| REJECT | 18 |
| **Total** | **63** |

Explicitly rejected/not built: standalone timer, generic chat, shared credentials, continuous GPS, autonomous purchasing, public household/social/recipe community, independent child accounts, marketplaces, complex voting, blanket household visibility, medical positioning, client-authoritative shared state, public/default attachments, fake AI, and unbound transferable MVP invites.

## Architecture decision

- PostgreSQL remains authoritative; commands are authenticated HTTP mutations.
- Realtime uses authenticated `fetch` streaming with SSE framing, durable per-household event sequence/outbox, and Redis Pub/Sub only as an accelerator.
- Independent consumer work/checkpoints prevent notification projection from blocking realtime.
- Every mutation uses membership serialization, capability checks, entity version/CAS, and principal-bound idempotency.
- Offline commands expire at seven days; full idempotent result remains at least 30 days and a non-executable tombstone through day 90.
- `ShoppingItemContribution` preserves multiple requesters/meal sources and safe plan-diff removal.
- Invite target binding is mandatory and versioned-HMAC protected; share/invite fragments are copied to memory then immediately scrubbed with `history.replaceState`.
- `NotificationIntent` is separate from the legacy visible inbox so muted/push-only intents cannot leak on rollback.
- CRDT, WebSocket mutation protocol, Redis-only durability, generic chat, and automatic purchasing are rejected for v1.

Human Decision Gates remain for retention/lawful basis, managed-child policy, auth token hardening, and actual deployed proxy/object-storage/push topology.

## Implementation phase results

| Phase | Result | Reason |
|---|---|---|
| H1 household foundation | BLOCKED / NOT IMPLEMENTED | P0-A, account/cache/consent and baseline tenant prerequisites fail. |
| H2 shared shopping | BLOCKED / NOT IMPLEMENTED | H1 absent; no safe tenant, semantic identity, realtime or offline command base. |
| H3 notifications | BLOCKED / NOT IMPLEMENTED | server preferences/delivery model absent; current local toggles not authoritative; push deferred. |
| H4 Meal Board | BLOCKED / NOT IMPLEMENTED | H1/H2 absent; current MealSlot uniqueness still unsafe. |
| H5 secure sharing | DEFERRED AND BLOCKED | demand unvalidated; requires stable household boundary and legal/privacy gates. |
| H6 competitive cooking | DEFERRED AND BLOCKED | decision-matrix gates not met; no H6 code authorized. |

No H1–H6 branch or integration branch was created because that would imply implementation authorization that the gate explicitly denied.

## Build and test evidence

- Frozen dependency install: PASS.
- `pnpm.cmd build`: PASS; server Prisma/Nest and web Vite/PWA completed in 75.777s.
- Largest web chunks before gzip: 979.09KB, 656.95KB, 260.77KB. Performance is unmeasured and not PASS.
- Relevant server: PASS, 15 suites / 89 tests.
- Relevant web: PASS_WITH_WARNINGS, 5 files / 27 tests; jsdom localStorage and one React `act(...)` warning.
- Full `pnpm.cmd test`: FAIL after 345.098s due four existing Food DNA/onboarding smoke assertions.
- Failure confirmation: 2 affected files, 4 failed / 15 passed.
- Two-account, household IDOR, realtime/offline, push, migration, accessibility visual, and performance tests: NOT RUN because implementation/prerequisites are absent; no false PASS is claimed.

Structured evidence: `docs/qa/household/test_results.json`.

## Domain-specific final results

| Area | Result |
|---|---|
| Realtime/offline | DESIGN COMPLETE; NOT IMPLEMENTED/TESTED |
| Two-account isolation | FAIL / UNPROVEN ON CURRENT BASE |
| Notification enforcement | CURRENT BASE FAIL; TARGET DESIGN COMPLETE |
| Meal Board | DESIGN COMPLETE; NOT IMPLEMENTED/TESTED |
| Secure sharing | DESIGN COMPLETE; DEFERRED/NOT IMPLEMENTED |
| Competitive cooking | DECIDED/BOUNDED; NOT IMPLEMENTED |
| Accessibility/RTL | SPEC COMPLETE; IMPLEMENTATION TEST NOT RUN |
| Migration | EXPAND-COMPATIBLE PLAN COMPLETE; NO MIGRATION CREATED/APPLIED |

## Adversarial review

The independent adversarial reviewer found and drove corrections for role drift, membership-removal TOCTOU, multi-source shopping provenance, idempotency horizon, notification rollback/cutover, invite target/HMAC/fragment handling, item and Meal Board state machines, guest-count ownership, managed-profile privacy, migration duplication, phased scope, and the 20-system trace contract.

Final adversarial recheck: **APPROVED FOR STAGE A DESIGN** with zero open document P0/P1/P2 findings. Verdict: `DESIGN_COMPLETE_IMPLEMENTATION_BLOCKED_BY_PREREQUISITE`. This is not Program PASS or `GO_IMPLEMENTATION`; implementation remains prohibited.

## Commands run

```text
git fetch --all --prune
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse origin/master
git log --oneline -15 origin/master
git worktree list
git branch --no-merged origin/master
git branch -r --no-merged origin/master
git switch -c program/household-os-v1 origin/master
pnpm.cmd install --frozen-lockfile --reporter=append-only
pnpm.cmd build
pnpm.cmd test
pnpm.cmd --dir apps/server exec jest src/auth src/consent src/shopping-list src/meal-plans src/notifications/ine --runInBand
pnpm.cmd --dir apps/web exec vitest run src/context/AuthContext.test.jsx src/app/settings/settings.smoke.test.jsx src/app/shopping-list/shoppinglist.smoke.test.jsx src/app/plan/plan.smoke.test.jsx src/app/notifications/notifications.smoke.test.jsx --reporter=dot
pnpm.cmd --dir apps/web exec vitest run src/app/food-dna/food-dna.smoke.test.jsx src/app/onboarding/onboarding.smoke.test.jsx --reporter=dot
```

Read-only source searches, file reads, JSON/CSV validation, report size checks, git diff/status checks, and independent agent reviews are additionally recorded by the generated documents and progress ledger. One unrelated QA artifact modified by a test side effect was restored exactly to HEAD and is not part of this change.

## Files changed

Only new Stage A documentation/report files under these paths:

- `docs/product/household-v1/`
- `docs/architecture/household-v1/`
- `docs/security/household-v1/`
- `docs/qa/household/`

Exact files are listed in `docs/qa/household/changed_files.csv`.

## Commit and push evidence

- Stage A documentation commit: `7b25a9ba` (`docs: design household OS v1 program`).
- Initial branch push: PASS; `origin/program/household-os-v1` created and set as upstream.
- Report closeout: this updated report/progress/test evidence is committed as the final branch HEAD after the Stage A commit and pushed to the same branch.
- `origin/master` remains `1631dc5d`; master was not checked out, committed, or pushed.
- Commit hook warning: `gitleaks` was not installed, so that hook scan did not run. A targeted scan for common API/private-key token patterns over the 34 changed files returned no matches; this is narrower than gitleaks and is not represented as a full secret-audit PASS.

## Open risks

The machine-readable register is `docs/qa/household/open_risks.json`. Critical open risks are unmerged P0-A, cross-account private-cache leakage, absent household authorization, and unproven consent/default-off behavior. Full baseline tests are also not green.

## Reports

- Main: `docs/qa/household/garnish_household_os_program_v1_report.md`
- Progress: `docs/qa/household/PROGRAM_PROGRESS.md`
- Phase reports: `docs/qa/household/h1_household_foundation_report.md` through `h6_competitive_cooking_report.md`
- Structured: decision matrix, tests, changed files, and open risks in the same directory.

## Exact next action

Finish P0-A in its existing isolated branch, reduce the dirty worktree to reviewed changes, pass its targeted tests/build and two-account browser proof, commit/push it, and merge it through review into `origin/master`. Then create a fresh worktree from the new `origin/master` and rerun all nine prerequisite checks; only a documented `GO_IMPLEMENTATION` may create H1.
