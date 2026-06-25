# 🛡️ GUARDIAN PROTOCOL — tiered, cheap, model-agnostic (replaces the per-piece swarm)

> **Why this exists.** The per-piece full multi-agent swarm caught real, ship-blocking bugs (the Persian
> allergy fail-open) — but it burned tokens **super-linearly**: `N agents × full-context re-read × convergence
> rounds`. Running 16–24 agents on a mechanical fix is waste. This is the proportionate replacement: **same-or-
> higher quality at a fraction of the cost.**
>
> **Core principle:** every bug found ONCE becomes a **deterministic test**, so an agent never has to re-find it.
> Token spent re-discovering is token that should have been a test. Quality and cost are NOT in tension here.

---

## ⚙️ CURRENT POLICY (set by founder, 2026-06-24): the swarm is OFF by default
The per-piece multi-agent swarm burned too many tokens. Standing policy until the founder says otherwise:
- **Per piece:** Tier 0 (deterministic tests/build) + Tier 1 (Claude reads the diff itself, **NO agents**). That is the entire check.
- **The multi-agent swarm runs ONLY at the END of a full DIMENSION** (every phase of that dimension done): a complete, precise audit of that one dimension, **≤5 agents + Claude**, find-cheap/verify-strong, **one pass** (no loop-to-zero).
- No per-piece swarm. The 14-dimension spec is a reference, not a per-run checklist.

---

## Tier 0 — deterministic, $0, ALWAYS (no LLM)
- `tsc --noEmit` + the full test suite (server + web).
- The **protected-invariant tests**: the allergy-gate intersection (`recipe-allergen-corpus.spec`), the cross-dimension acceptance capstone (`cross-dimension.acceptance.spec`), the write-boundary allowlist, the fail-closed checks. **These ARE the guardian for everything already discovered.**
- **Rule:** when any review finds a NEW bug class, add a Tier-0 test for it, then retire the agent check. The agent layer shrinks over time.

## Tier 1 — single-agent, diff-scoped, only on risky diffs
- One reviewer reads `git diff` (**not the repo**), only when the diff touches safety/correctness.
- Cheap model (Sonnet / Haiku). **Single pass.** Output: findings as `file:line` + confidence tag.

## Tier 2 — multi-agent adversarial, RARE (section / milestone boundary only)
- **3–5 agents (not 16–24), 1–2 rounds (not loop-to-zero)**, scoped to the milestone's diff + the **1–3 dimensions it actually touches** (NOT all 14).
- **find with a cheap model; verify/adjudicate the safety-critical findings with the strong model (Opus).** This split is the single biggest cost lever — never run the strong model on a wide field of finders.
- Stop at **substantive** convergence; chasing literal-zero is diminishing returns (round 5 is usually framing-polish).

## Cost rules (the levers that prevent the blow-up)
1. **Scope to the diff, never the whole repo.** Agents reading whole files was the original killer.
2. **find cheap / verify strong.**
3. **Don't re-run the whole sweep after each fix** — re-check only the fixed item.
4. **The 14-dimension spec is a REFERENCE, not a per-run checklist.** Map each change to its 1–3 dimensions.
5. **Encode-then-retire** — grow Tier 0, shrink Tiers 1–2.

## Model-agnostic manual review (paste into ANY model — Codex, Claude, etc.)
```
Review ONLY this diff against this checklist — nothing else:
(1) Is the hard allergy/safety gate weakened or made fail-open?
(2) Is any fact / quantity / temperature / ratio produced WITHOUT a deterministic source?
(3) Any failing or weakened test?
(4) Any public recipe read missing the published filter?
Report each finding as file:line + [قطعی/احتمالاً/حدسی] + why. One pass, no loop.
```
