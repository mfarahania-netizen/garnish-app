# B2B Governance — B0 (E52)

- **Status:** B0 (governance + the consent `purpose` hook only — no B2B product, no data export).
- **Date:** 2026-06-13 · **Owner:** F (Accountable), ADV (Responsible), EL (Responsible — schema hook).
- **Source:** Constitution Part 1 (B2B), Part 2.2/2.3, Part 3 Layer 13, Part 4 (consentPurpose), v4§5.

> B0 establishes the **rules and the consent `purpose` column** so that no B2B data path can ever be
> built ad-hoc. **Nothing is sold, exported, or aggregated at B0.** B1 (aggregate reports) is Year 2 and
> gated; B2 (API) is Year 2–3; B3 (enterprise) is partnership-only and not a default.

## Hard rules (permanent)
- **Never** sell or share personal data. **Never** give an employer access to an individual's behavior.
- All future B2B output is **aggregate only**, with **K-anonymity ≥ 100** — no cohort below 100 users.
- Only events with `consentPurpose = b2b_aggregate` **and** `privacyClass ≤ P1-pseudonymous` may ever
  enter the aggregation line (per ADR-0001).
- `P2-sensitive` data (allergy / health-goal) never enters B2B aggregation.
- Every future export emits a `b2b_export_logged` event with a hash of the output (audit-long).

## B-stage gates
| Stage | Scope | Entry gate |
|-------|-------|------------|
| **B0** | governance + `purpose` consent hook (this file) | now |
| B1 | 2 design-partner aggregate reports (€5–15K/yr ASSUMPTION) | Year 2: G3-EU retention + **2 real LOI** + K≥100 line + DPIA template |
| B2 | Insights API | Year 2–3: B1 validated |
| B3 | Enterprise partnership | Year 3+: inbound traction; never a sales commitment pre-B1 |

## The consent `purpose` hook (the only B0 build-touch)
- `ConsentLog` gains an additive, nullable **`purpose`** column. Allowed values mirror the envelope's
  `consentPurpose`: `core` | `analytics` | `personalization` | `b2b_aggregate` | `community`.
- Semantics: `purpose` records *what processing the user consented to*; it is the set the envelope's
  `consentPurpose` must be a subset of (ADR-0001 consent rule). The legacy `type`
  (DATA_COLLECTION / MARKETING / COOKIES) is the UI consent category and is unchanged.
- B0 ships **only** the column (additive migration). No aggregation, export, or B2B endpoint is built.

## Kill / revert
- Any B-stage without the required LOI/DPIA/gate → reverts to Research Track.
- Any individual-data or employer-access request → rejected and logged in DECISION_LOG.
