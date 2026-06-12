# Community C0 — Foundational Policy (E51-C0)

- **Status:** C0 (docs only — no community features built now).
- **Date:** 2026-06-13 · **Owner:** F (Accountable), CM (Responsible), ADV (consulted).
- **Source:** Constitution Part 1 (Community), Part 2.2/2.3, Part 5 E51, v4§2–4.

> C0 is **documentation and guardrails only**. No community UI, feed, chat, posting, or moderation is
> built at this stage. This policy exists so that later stages cannot be built ad-hoc and so that the
> anti-duplication hooks (visibility model) are agreed up front.

## Stage gates (C0 → C6)
| Stage | What it is | Entry gate |
|-------|-----------|------------|
| **C0** | Policy + docs (this file) + visibility hook in the event envelope | now |
| C1 | Private "cooked" share (share token, revocable) | EU window, G2 + E39 green + ≥10% share intent in alpha |
| C2–C3 | Circles ≤25 people + Report/Block/Mute + ModerationAction | D30 ≥12% stable 2 months in EU |
| C4 | Recipe UGC (submission → AI pre-screen → human review → publish) | Year 2; 15-gate Safety System + SLA ≤72h + DSA review |
| C5 | Public comments / curated gallery | **F+ADV written decision only; default NO** |
| C6 | Creator/Expert | Year 2–3; ≥10 inbound + verification/contract |

## Never built (permanent defaults — Part 2.3)
- **Algorithmic public feed** — earliest reconsideration Year 3 with full C2–C4 evidence + DSA readiness
  + written F+ADV decision; even then a **curated gallery, not an algorithmic feed**.
- **Public chat / 1:1 DM** — never in core. Communication only inside Circles (≤25) with Report/Block/Freeze.
- **Public comments** — only with C5 (F+ADV decision).
- **Public individual leaderboards** — never (anti GES-5.19; only aggregated team progress at C3).

## Safety principles (apply from C1 onward)
- Default visibility is **private**. `circle`/`public` visibility exists only at C1+.
- Every shareable artifact has a revocable share token.
- Moderation actions are **audit-long**, append-only, with a DSA statement-of-reasons.
- Eating-disorder (ED) safety, DSA notice-and-action, and harassment controls are entry gates for any
  social surface — not afterthoughts.

## Visibility hook (the only C0 build-touch)
The canonical event envelope (ADR-0001) reserves `visibility: private | circle | public` (default
`private`) and a future `shareToken`. No code beyond that reservation ships at C0. This prevents a
later ad-hoc visibility model.

## Kill / revert
- Any social stage that produces harassment > 1%/month → freeze capability (v4§2).
- Any ED or DSA incident → halt the surface and review with ADV.
