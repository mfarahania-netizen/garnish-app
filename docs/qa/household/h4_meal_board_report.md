# H4 — Collaborative Meal Board Report

- Verdict: `DESIGN_COMPLETE_IMPLEMENTATION_BLOCKED_BY_PREREQUISITE`
- Branch/base: `program/household-os-v1` / `1631dc5dbf0f0d5b9699399ed8f50ebef4b053ab`
- Product/schema code changed: no
- Tests implemented/run: no H4 tests; current meal-plan baseline is included in the 89 relevant server and 27 relevant web tests
- Production/database touched: no

## Approved design scope

Versioned Meal Board lifecycle including `SUGGESTIONS`, member proposals/reactions/self-attendance, manager-only managed attendance, one slot-level bounded guest count, Owner/Adult draft edit/confirm, deterministic contribution-based shopping diff, and explicit apply/undo.

## Blockers

H1/H2 are absent; current `MealSlot` lacks database uniqueness; no versioned household board or plan-diff model exists.

## Hard PASS evidence absent

No duplicate-slot prevention, concurrent proposal/confirm, attendance/guest serving invariant, deterministic diff, rollback, stale-client, realtime convergence, or PostgreSQL race evidence exists. PASS is forbidden.

## Next action

Treat H4 as P1; start only after repeated H2 use and H1/H2 Hard PASS.
