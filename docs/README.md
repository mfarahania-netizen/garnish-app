# Garnish OS — Documentation Index

> This is the **documentation index** for Garnish OS (links only — not a strategy/marketing doc).
> The product/execution **source of truth** is the Master Execution Constitution (below). The
> developer overview + current status snapshot live in the repo‑root [`../README.md`](../README.md);
> the data-layer source of truth is [`../data/README.md`](../data/README.md).
>
> Note: this index replaced an earlier vision/marketing draft that over-claimed (e.g. "Gemini deeply
> integrated"); live Gemini product behavior is **not** enabled and AI Core is **not** complete.

## Execution (source of truth)
- [Master Execution Constitution v1.0.1](execution/GARNISH_OS_MASTER_EXECUTION_CONSTITUTION_v1.0.1.md)
- [Risk Register](execution/RISK_REGISTER.md)
- [Decision Log](execution/DECISION_LOG.md)
- [Weekly Execution Review](execution/WEEKLY_EXECUTION_REVIEW.md)
- [Gate Review Template](execution/GATE_REVIEW_TEMPLATE.md)
- [UI Migration Status](execution/UI_MIGRATION_STATUS.md)

## Phase & task reports
- Shell/Nav: [Phase 3](execution/PHASE_3_SHELL_NAV_REPORT.md) · [Phase 3.1](execution/PHASE_3_1_MICRO_CLEANUP_REPORT.md)
- Home (technical pass, **visual rejected**): [Phase 4A report](execution/PHASE_4A_HOME_COMMAND_CENTER_REPORT.md) · [Phase 4A visual QA](qa/phase4a/PHASE_4A_VISUAL_QA_REPORT.md)
- Data: [Ingredient Dictionary — Recipe Resolver Alias Patch 00](execution/INGREDIENT_DICTIONARY_RECIPE_RESOLVER_ALIAS_PATCH_00_REPORT.md)
- AI Core (E47):
  [E43 Event Envelope](execution/E43_EVENT_ENVELOPE_CODE_CONTRACT_REPORT.md) ·
  [A1 skeleton](execution/E47_A1_AI_CORE_SKELETON_REPORT.md) ·
  [A2 persistence](execution/E47_A2_AI_CORE_PERSISTENCE_SCHEMA_REPORT.md) ·
  [A3 chat routing](execution/E47_A3_LEGACY_CHAT_ORCHESTRATOR_REPORT.md) ·
  [A4 read-only tools](execution/E47_A4_REAL_READONLY_TOOL_HANDLERS_REPORT.md) ·
  [A5 Gemini provider](execution/E47_A5_GEMINI_PROVIDER_ORCHESTRATOR_REPORT.md) ·
  [A6 eval gate](execution/E47_A6_AI_EVAL_SUITE_GATE_REPORT.md) ·
  [A6.1 guard hardening](execution/E47_A6_1_GUARD_HARDENING_EVAL_GAPS_REPORT.md) ·
  [A7 live smoke gate](execution/E47_A7_CONTROLLED_LIVE_GEMINI_SMOKE_GATE_REPORT.md)
- Docs: [README source-of-truth cleanup](execution/DOCS_README_SOURCE_OF_TRUTH_REPORT.md)

## Design system (GES)
- [Garnish Experience System v1](design/GARNISH_EXPERIENCE_SYSTEM_v1.md) ·
  [Implementation Guide](design/DESIGN_IMPLEMENTATION_GUIDE.md) ·
  [QA Checklist](design/DESIGN_QA_CHECKLIST.md) ·
  [Component Migration Map](design/COMPONENT_MIGRATION_MAP.md) ·
  [Pattern Library v1](design/COMPONENT_PATTERN_LIBRARY_v1.md)

## ADR
- [ADR-0001 — Canonical Event Envelope](adr/ADR-0001-canonical-event-envelope.md)

## Security
- [RBAC Route Matrix](security/RBAC_ROUTE_MATRIX.md) ·
  [E1 Secret Incident Status](security/E1_SECRET_INCIDENT_STATUS.md) ·
  [E1 Secret Purge Runbook](security/E1_secret_purge_runbook.md)

## QA reports
- AI eval results: [e47_a6_eval_results.json](qa/ai/e47_a6_eval_results.json) ·
  AI live-smoke results: [e47_a7_live_smoke_results.json](qa/ai/e47_a7_live_smoke_results.json)
- Phase 4A screenshots + report: [qa/phase4a/](qa/phase4a/)

## Data
- [Data layer README (source of truth)](../data/README.md) ·
  [Data Constitution v2.1](DATA_CONSTITUTION.md)

## Other governance
- [Structure & Design Audit](audit/STRUCTURE_AND_DESIGN_AUDIT.md) ·
  [B2B Governance B0](b2b/B2B_GOVERNANCE_B0.md) ·
  [Community C0 Policy](community/COMMUNITY_C0_POLICY.md) ·
  [WAT W0 Workflow Spec](ops/WAT_W0_WORKFLOW_SPEC.md) ·
  [Visa facilitator docs](visa/)
