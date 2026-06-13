# Recipes — data layer

Canonical recipe datasets for Garnish Phase One. See [`../README.md`](../README.md) for the overall data-layer source of truth.

## Layout
- `active/` — the active import pointers consumed by the importers.
  - `recipes.fa.phase-one.200.json` (+ `…200.wrapper.json`) — **current active dataset: v0.6.1, 200 recipes** (dev-imported).
  - `recipes.fa.phase-one.json` (+ `…wrapper.json`) — previous 122 (v0.5.4) pointer, **kept** (legacy `data:import:phase-one` still reads this path).
- `phase-one/v0.6.1/` — the staged v0.6.1 package (dataset + wrapper + all validation/audit reports + `import_report_v0.6.1.json`). See [`phase-one/v0.6.1/README.md`](phase-one/v0.6.1/README.md).
- `archive/` — preserved prior datasets for rollback. `recipes.fa.phase-one.122.v0.5.4.json` (+ wrapper) = the previous 122. **Never deleted.**
- `drafts/` — work-in-progress datasets (not imported).

## Current status
- **v0.6.1 (200 recipes)** imported to the **local/dev** `garnish_db` (2026-06-13). Dev/preview only — **not** final production data.
- Import is idempotent upsert (no deletions); user interactions are never touched. Commands & report: see the v0.6.1 README.

## Nutrition / claims policy
- `estimated_not_medical`; **no** medical, strict-diet-planning, or health-outcome claims. `finalVerifiedNutrition = false`.
