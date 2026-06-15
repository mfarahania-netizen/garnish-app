# DECISION LOG

> Execution artifact per **Constitution v1.0.1 — A1.5**. Append-only record of consequential decisions.
> Each `Revisit Trigger` points to the gate (Part 2 / Part 8) that may reopen the decision.

| Decision ID | Date | Decision | Options Considered | Final Choice | Reason | Owner | Revisit Trigger |
|-------------|------|----------|--------------------|--------------|--------|-------|-----------------|
| D1 | 2026-06-13 | Iran market posture | Real market vs. technical/behavioral sandbox | Iran = sandbox, **not** a market | Honest separation of "product quality" from "market demand"; operational/legal risk | F | New legal opinion (E49) |
| D2 | 2026-06-13 | Europe launch posture | Persian/MENA-first vs. universal-first | Europe = universal-first (English-first, universal ICPs) | Market size + founder fit; Persian/MENA = hidden strength, not identity | F | G2 outcome |
| D3 | 2026-06-13 | Public chat / DM | Build public chat vs. not | Public chat **not built** (ever in core) | Real-time harassment/moderation liability, no value evidence | F | Never (core) |
| D4 | 2026-06-13 | Public feed | Algorithmic feed vs. none | Public feed **not built** by default | ED/DSA/moderation risk; anti "no-feed" principle | F+ADV | Year 3 w/ full evidence |
| D5 | 2026-06-13 | AI Core architecture | Multi-agent vs. single Orchestrator | AI Core v1 = single Orchestrator + Tool Registry | Anthropic "simple patterns", anti agent-washing, MAST | AA | Proven need Orchestrator can't meet |
| D6 | 2026-06-13 | B2B scope | Direct sales vs. governance-only | B2B = governance only (B0) until Year 2 | Slow cycle, Fleming doubt, focus | F | 2 real LOI (B1 entry) |
| D7 | 2026-06-13 | WAT scope | Autonomous agents vs. W0 hooks only | WAT = W0 only now, W1 conditional | Gartner ~40% cancellation, MAST, Anthropic simplicity | EL | Time-log evidence (W1) |
| D8 | 2026-06-13 | Health Mode | Build now vs. delay | Delay to Year 3 | Legal/safety boundary (Art.9) | F+ADV | Legal opinion + Art.9 controls |
| D9 | 2026-06-13 | Family layer | Build now vs. delay | Delay to Year 2–3, schema-ready only | No fabricated demand | F | ≥8% EU waitlist + stable revenue |
| D10 | 2026-06-13 | Native mobile | Native now vs. PWA-first | PWA-OS now; Expo/RN decision months 6–12 | mobile-first founder, API-first ready | EL | Spike + PWA retention evidence |
| D11 | 2026-06-15 | **Constitution Amendment 2 (PROPOSED — pending founder ratification)** | Continue building recommendation A-layers vs. freeze + raise quality bar + correct drift | **Proposed:** (A2.1) adopt an **L4 quality bar** (technical pass ≠ acceptance; visual/product bar governs UI); (A2.2) **freeze the recommendation stack at A14** (no new `runtime-shadow` A-layer; default-OFF; no live ranking/response change); (A2.3) **remove fake/junk** (fake voice input, localStorage "personalization"); (A2.4) the **approved visual direction is the UI unblock**. Re-aligns work onto the Constitution W1–W26 plan. | Drift: an over-built internal recommendation experimentation stack vs. the ~6-month launch plan; honesty + L4 quality | F | **Founder ratification** (then supersede this row with the ratified Amendment 2 doc in `docs/execution/`) |

| D12 | 2026-06-15 | Coverage gate is standing release discipline | (a) keep coverage manual/ad-hoc; (b) generated-from-code matrix + **blocking** CI gate; (c) generate but non-blocking | **(b)** generated backend↔frontend↔design coverage matrix + **blocking** `pnpm coverage:check` in CI (UNREGISTERED + UNMAPPED fail). **Every future feature sprint must end with `pnpm coverage:check` green** — moving entries from `must-render`/`deferred:` → `frontend:<ref>` as they get surfaced. | Humans can't track 91 endpoints × 37 Recipe fields; the audit proved capabilities get silently dropped (`recipe.author`/`categories`/`videoUrl`). Generated-from-code + blocking makes drift impossible to merge silently. | EL/F | Gate proves noisy/brittle (false blocks) → revisit thresholds, not the principle (GARNISH-COVERAGE-03) |

## How to use
- Append a new row for any decision that closes a real fork; never edit a decided row — supersede it with a new dated row referencing the old `Decision ID`.
- Operational/security events (e.g. key rotation date for E1) are logged here too.
- File-Closing Rule: requests outside the 5 allowed triggers are rejected and recorded here.

## Change history
- 2026-06-15 — **D12 added (GARNISH-COVERAGE-03):** the backend↔frontend↔design coverage gate is a standing, blocking release discipline; every future feature sprint must end with `pnpm coverage:check` green. See `docs/execution/GARNISH_COVERAGE_03_REPORT.md`.
- 2026-06-13 — Seeded with 10 initial decisions per A1.5.
