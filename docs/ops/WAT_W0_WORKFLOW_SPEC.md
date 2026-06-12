# WAT W0 — Workflow Spec & Ops Namespace (E53-W0)

- **Status:** W0 (spec + namespace reservation only — no autonomous execution).
- **Date:** 2026-06-13 · **Owner:** EL (Accountable), AA (Responsible).
- **Source:** Constitution Part 1 (WAT), Part 2.2/2.3, Part 3 Layer 14, Part 5 E53, v4§6–7.

> W0 reserves the namespace and defines the Workflow Spec template. **No workflow runs autonomously at
> W0.** W1 (human-approved tk-workflows) is conditional on time-log evidence (months 6–12). Anything on
> the forbidden list is **permanently** out of scope.

## Ops namespace
- Agent/automated actors use the reserved actor namespace **`ops:*`** (e.g. `actorId: "ops:<workflowId>"`)
  in the canonical event envelope (ADR-0001).
- Every workflow step emits an event with `actorType: agent` + `metadata: { runId, stepId }`.
- Human approval is a **separate** event; without it, W1 may not execute.

## Forbidden list (permanent — never autonomous)
health · legal · money/payments · data deletion · messaging end-users · deploy · changing guardrails.
Any workflow touching these is rejected at spec review.

## Workflow Spec template (required for any future W1 workflow)
```yaml
id: ops:<kebab-id>
title: <one line>
owner: <role>
trigger: <manual | scheduled(cron) — W3+, human-gated only>
inputs: [ ... ]
steps:
  - id: <step-id>
    action: <tool name from the AI Core Tool Registry>
    reversible: true            # MUST be true at W1; irreversible steps are forbidden
    humanApproval: required     # W1 is human-approved per run
outputs: [ ... ]
denyList: [health, legal, money, data-deletion, messaging, deploy, guardrails]
evidence:
  timeLog: <link>               # W1 entry requires documented time saved
  acceptance: <measurable>
rollback: <how to undo this run>
```

## W0 → W1 gate
W1 (single-domain, human-approved workflows, ~6–12 manual steps) is allowed **only** with a documented
time-log showing ≥3 stable opportunities and an approval UI. W2+ (supervisor, scheduler) is Year 2+ and
requires the W1 metrics (≥8h/week saved, error <5%).

## Acceptance (W0)
- This spec exists and the `ops:*` namespace is reserved in ADR-0001. No autonomous execution capability
  is shipped.
