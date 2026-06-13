# DOCS / README Source-of-Truth Cleanup (after E47) — Report

**Date:** 2026-06-13 · **Task:** `DOCS-README-SOURCE-OF-TRUTH-CLEANUP-AFTER-E47` · **Scope:** documentation only.

> New project rule applied: *major-phase acceptance requires the related README/status docs to be current.*
> This pass audited all README/status docs (esp. under `data/`) and removed stale/conflicting content.

---

## 1. README inventory
| Path | Purpose | State (before) | Classification | Action taken |
|------|---------|----------------|----------------|--------------|
| `README.md` (root) | Developer overview + execution source-of-truth + setup/env/security + status legend | Current but **missing a status snapshot** (no E47 / UI-freeze / data status) | **Canonical** (project overview) | **Updated** — added "Current status snapshot" + explicit doc-roles line |
| `docs/README.md` | (was) a vision/marketing strategy doc ("AI-Native Nutrition OS", "Gemini deeply integrated", health framing) | **Stale + conflicting + over-claiming** (duplicated strategy; contradicts safety reality + Constitution) | **Canonical (index) — was misused** | **Replaced** with a clean documentation **index** (links only) |
| `data/README.md` | Data-layer layout / import policy | **Stale** — named the **archived** 1000 dictionary as the import source; missing recipe/nutrition/DB-reimport status | **Canonical** (data-layer source of truth) | **Rewritten** with current facts |
| `data/ingredients/phase-one-final/README.md` | Describes the Recipe-Resolver Alias Patch 00 package | Current/accurate to the patch | **Package-local** (limited scope) | **Kept as-is**; classified package-local in this report |
| `data/ingredients/phase-one-final/archive/previous-before-recipe-resolver-alias-patch-00/README.md` | Old (1000 closeout) package readme | Historical | **Archive** | **Kept** (do not delete) |
| `apps/server/README.md` | NestJS CLI default boilerplate | Generic framework template | **Accidental / framework-default** | **Kept** (not in scope; recommend trimming later) |

## 2. Does `data/docs/README.md` exist?
**No.** There is no `data/docs/` directory and no `data/docs/README.md`. Nothing to deprecate/relocate. (Only `data/README.md` exists at the data root.)

## 3. Stale / conflicting docs found
- **`docs/README.md`** — a 326-line vision/marketing doc claiming "Google Gemini powered assistant deeply integrated across the app" and an "AI-native nutrition operating system" with health framing. This **conflicts** with the safety-sanitized reality (live Gemini **not** enabled; AI Core **not** complete; no health/medical claims) and duplicated strategy that belongs to the Constitution. → replaced with an index.
- **`data/README.md`** — pointed imports at the **archived** file `…resolver_ready_1000_only_closeout_patch_02_1.json` (the active source is now the **1008** alias-patch file). Also lacked recipe/nutrition/DB-reimport status. → rewritten.

## 4. What was updated
- **`data/README.md`** — current facts: 1008 verified ingredients (no new IDs); active 1008 alias-patch import path; alias patch accepted-by-report (no new IDs / no nutrition changes); 122 recipes (v0.5.4 `final_import_candidate_not_imported`); seq19/khoresh-kangar removed; water/warm-water/soda-water = process liquids (not searchable); `productionNutritionLock = false` / not a final verified dataset; **DB re-import deferred**; no medical/diet claims; AI Core changes don't touch data.
- **`docs/README.md`** — clean **index** linking Constitution, Risk Register, Decision Log, Weekly Review, UI Migration Status, all phase/AI reports, design docs, ADR-0001, security docs, AI QA results, and the data README.
- **`README.md` (root)** — added "Current status snapshot" (UI frozen after 4A; E47 A1–A7 gates; **live Gemini not enabled**; data 1008/122 + nutrition not source-locked + DB re-import deferred; E1 history purge + R16/E39 erasure open) and an explicit doc-roles line.
- **`docs/execution/WEEKLY_EXECUTION_REVIEW.md`** — added the **phase-documentation rule** + canonical doc-role definitions.

## 5. What was NOT touched
- No application/backend/frontend code, **no UI**, no Prisma schema/migrations, no recipe/ingredient data, no imports, no `.env`, no AI/Gemini behavior, no tests. The package-local and archive READMEs were left intact (provenance preserved).

## 6. Verification (checks)
- Links in the new index/data README are **relative** and point to files confirmed to exist (execution/, design/, adr/, security/, qa/ai/, qa/phase4a/, ../data/README.md, ../docs/...).
- **No secrets / no raw env values** in any doc. No claim that live Gemini is enabled, that AI Core is complete, that UI migration is complete, that the nutrition dataset is final/clinical, or that DB re-import was done.
- Recipe/ingredient facts were verified against the repo (importer asserts 122 recipes; dictionary is 1008; wrapper meta `version: v0.5.4`, status `final_import_candidate_not_imported`; `kangar`/`seq19` absent from the active file).

## 7. Confirmation
README/status docs now reflect **E47-A7** and current data status: UI frozen (post-4A), AI Core A1–A7 as **safe gates** with **live Gemini not enabled**, data 1008 ingredients / 122 recipes v0.5.4 with **nutrition not source-locked** and **DB re-import deferred**, and E1 history-purge + R16/E39 erasure still open. Root `README.md`, `docs/README.md`, and `data/README.md` each have a **clear, non-conflicting role**.

## 8. Remaining docs risks
- `apps/server/README.md` is still NestJS boilerplate (harmless; recommend trimming to a short server note in a future docs pass — out of this scope).
- The data team's recipe provenance (v0.5.4 candidate, seq19/kangar removal) lives in the dataset wrapper meta, not a dedicated recipe-dataset report; a short `docs/execution` recipe-dataset note could formalize it later.
- `docs/DATA_CONSTITUTION.md` (GDC v2.1) and the root README both describe data scope; the data README now points to the GDC as canonical to avoid drift — keep them in sync on future data phases.

**Status:** documentation cleanup COMPLETE. Stopping after this report.
