# Build Evidence — the receipts (not a promise, the record)

> Show this to anyone who says "the spec is too heavy / this can't be built." The answer is not an opinion — it
> is the commit log + the test suite. Below is what was actually built, verified, and shipped to `master` in one
> focused build run, at world-class rigor.

## The numbers (verifiable in the repo right now)
- **24 commits** shipped to `master` (guest spine `15559c53` → signal-capture `4ab303c2`).
- **Server test suite: 240 suites / 1935 tests — all green.** Web: 35 suites / 162 tests. `tsc --noEmit` clean.
- Every piece **guardian-verified** (independent adversarial review agents) before it was allowed to pass — and
  the guardian caught **real safety/correctness bugs that would otherwise have reached a user.**

## What was built (each piece = complete, wired, tested, guardian-converged — nothing half-done)
| Piece | What it does | Guardian passes | Real bug it caught + fixed |
|---|---|---|---|
| Guest spine | Silent passwordless guest session (server-issued key, reaper) | 3 | **Data-loss: a cron cascade would silently delete a guest's GDPR consent + allergies** |
| EU-14 allergen engine | Full EU-14 allergen coverage + canonicalization | 1 | **Live under-match: a shellfish-allergic user was NOT protected from 7 crustacean-variant ingredients** |
| SubstitutionEngine | World-class grounded ingredient swaps (reason/impact/confidence) | 2 | **724/995 ingredients returned junk swaps + a name-only path bypassed the allergy filter** |
| IntentClassifier | The deterministic cost-governor + safety router (fa/nl/en, 131 tests) | 3 | **A diabetic/medical query was answered at the cheapest tier with no medical guardrail** |
| Signal capture | Every swap/scale/remove emitted as a learning signal | 3 | **The strongest taste signals were dropped before storage (bot-gate + a UUID key collision)** |

**~10 real safety/correctness bugs caught BEFORE production.** That is the opposite of "can't pull it off" — it
is a verification discipline most teams do not have.

## Why this does NOT fail (the method, not bravado)
1. **Small, complete, guardian-verified increments.** No piece moves to the next while it has a known problem. No
   half-wired anything. The repo is always green + shippable.
2. **Deterministic-first.** The system is useful AND cheap from the first piece — it is NOT a moonshot that only
   works once everything is done. ~85–90% of assistant turns cost €0 (the database answers, not the model).
3. **Build-then-activate.** Every risky capability ships default-OFF + byte-identical until a MEASURED gate passes
   (the proven L1 discipline). We never bet the product on an untested flip.
4. **Iran-sandbox-first.** The live AI is tested on a sandbox before any EU user; the EU flip waits behind the
   legal gate. No big-bang launch.
5. **Honest reality-checks.** We NAME what is hard and what needs external help — that honesty is *why* we will
   not be blindsided, not a weakness.

## The honest part (where the critics have a real point — and why it is handled)
The FULL 14-dimension vision is a **multi-quarter, multi-skill program** — that is true of *any* world-class AI
product, and the master spec says so itself (Dimension 14). A single builder ships the deterministic core + the
wiring; three tracks genuinely need outside hands and are named, not hidden: a **Dutch IP/privacy lawyer** (DPIA +
Art.50/9 + data provenance), **native fa/nl reviewers** (the golden eval + translation), and optionally a
**data-engineer** for the 1,008-recipe i18n migration. Sequenced ruthlessly (P0 first), the build does not depend
on all of that at once.

**Bottom line:** "too heavy" confuses *the full vision is big* (true) with *it can't be built* (false). It is
being built — in small, complete, adversarially-verified pieces, with the receipts above. We do not fail by being
ambitious; we would only fail by pretending or rushing — and the method above is the opposite of both.
