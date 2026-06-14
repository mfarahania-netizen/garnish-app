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
- Analytics / Event foundation (E43):
  [E43 Event Envelope (W6 code contract)](execution/E43_EVENT_ENVELOPE_CODE_CONTRACT_REPORT.md) ·
  [E43-A1 Event Envelope code contract + ingest gate](execution/E43_A1_CANONICAL_EVENT_ENVELOPE_CODE_CONTRACT_AND_INGEST_GATE_REPORT.md) ·
  [E43-A2 taxonomy-bound producer migration + shadow runtime integration](execution/E43_A2_TAXONOMY_BOUND_EVENT_PRODUCER_MIGRATION_AND_SHADOW_RUNTIME_INTEGRATION_REPORT.md) ·
  [E43-A2 producer migration map](analytics/E43_A2_EVENT_PRODUCER_MIGRATION_MAP.md) — Event Envelope is **code-backed**; runtime producer migration is **staged** (one shadow integration; BIP v1 **not** complete, analytics **not** fully migrated)
- Behavioral intelligence (E43):
  [E43-A3 SignalObservation Engine + Signal Registry v1](execution/E43_A3_SIGNAL_OBSERVATION_ENGINE_AND_SIGNAL_REGISTRY_V1_REPORT.md) ·
  [E43-A3 Signal Registry v1](behavior/E43_A3_SIGNAL_REGISTRY_V1.md) — SignalObservation Engine v1 is **code-backed** (pure, deterministic, 44 signals); does **not** complete BIP v1, no UserFoodIdentityGraph, no recommendation/notification/AI-personalization change
- AI Core (E47):
  [E43 Event Envelope](execution/E43_EVENT_ENVELOPE_CODE_CONTRACT_REPORT.md) ·
  [A1 skeleton](execution/E47_A1_AI_CORE_SKELETON_REPORT.md) ·
  [A2 persistence](execution/E47_A2_AI_CORE_PERSISTENCE_SCHEMA_REPORT.md) ·
  [A3 chat routing](execution/E47_A3_LEGACY_CHAT_ORCHESTRATOR_REPORT.md) ·
  [A4 read-only tools](execution/E47_A4_REAL_READONLY_TOOL_HANDLERS_REPORT.md) ·
  [A5 Gemini provider](execution/E47_A5_GEMINI_PROVIDER_ORCHESTRATOR_REPORT.md) ·
  [A6 eval gate](execution/E47_A6_AI_EVAL_SUITE_GATE_REPORT.md) ·
  [A6.1 guard hardening](execution/E47_A6_1_GUARD_HARDENING_EVAL_GAPS_REPORT.md) ·
  [A7 live smoke gate](execution/E47_A7_CONTROLLED_LIVE_GEMINI_SMOKE_GATE_REPORT.md) ·
  [A7 live smoke execution (PASS)](execution/E47_A7_LIVE_GEMINI_SMOKE_EXECUTION_REPORT.md) ·
  [A8 controlled live chat adapter](execution/E47_A8_CONTROLLED_LIVE_CHAT_ADAPTER_REPORT.md) ·
  [A9 runtime boundary & product-safety gate](execution/E47_A9_AI_RUNTIME_BOUNDARY_AND_PRODUCT_SAFETY_GATE_REPORT.md) ·
  [A10A persisted AI cost ledger (R3 mitigation)](execution/E47_A10A_PERSISTED_AI_COST_LEDGER_REPORT.md) ·
  [A10B persisted daily user budget (R3 mitigation)](execution/E47_A10B_PERSISTED_DAILY_USER_BUDGET_REPORT.md) ·
  [A10C cost-rate catalog & spend alerting (R3 mitigation)](execution/E47_A10C_AI_COST_RATE_CATALOG_AND_SPEND_ALERTING_REPORT.md) ·
  [A11A output safety/quality eval harness (R4 mitigation)](execution/E47_A11A_LIVE_OUTPUT_SAFETY_QUALITY_EVAL_HARNESS_REPORT.md) ·
  [A11B regression corpus & continuous eval gate (R4 mitigation)](execution/E47_A11B_LARGER_REGRESSION_CORPUS_AND_CONTINUOUS_EVAL_GATE_REPORT.md) ·
  [A12 AI internal pilot-readiness failure-injection gate](execution/E47_A12_AI_INTERNAL_PILOT_READINESS_FAILURE_INJECTION_GATE_REPORT.md)
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
- **E39 / R16 GDPR privacy track** (erasure / export / retention):
  [Final Privacy Gate](security/E39_FINAL_PRIVACY_GATE_REPORT.md) (**R16 BASELINE_CLOSED for dev/beta** — controlled prune deferred) ·
  [R16 Coverage Audit](security/E39_R16_ERASURE_COVERAGE_AUDIT.md) (original FAIL snapshot, now remediated) ·
  [E39-1C Transactional Erasure](security/E39_1C_TRANSACTIONAL_ERASURE_SERVICE_REPORT.md) ·
  [E39-1C Disposable-DB Verify](security/E39_1C_DISPOSABLE_DB_ERASURE_VERIFY_REPORT.md) ·
  [E39-1D GDPR Export Endpoint](security/E39_1D_GDPR_USER_EXPORT_ENDPOINT_REPORT.md) ·
  [E39-1E Retention Cron Policy](security/E39_1E_RETENTION_CRON_POLICY_REPORT.md)

## QA reports
- AI eval results: [e47_a6_eval_results.json](qa/ai/e47_a6_eval_results.json) ·
  AI live-smoke results: [e47_a7_live_smoke_results.json](qa/ai/e47_a7_live_smoke_results.json)
- Analytics — Event Envelope contract gate: [e43_a1_event_envelope_contract_results.json](qa/analytics/e43_a1_event_envelope_contract_results.json) ·
  Event producer migration gate: [e43_a2_event_producer_migration_results.json](qa/analytics/e43_a2_event_producer_migration_results.json)
- Behavior — Signal observation gate: [e43_a3_signal_observation_results.json](qa/behavior/e43_a3_signal_observation_results.json)
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
