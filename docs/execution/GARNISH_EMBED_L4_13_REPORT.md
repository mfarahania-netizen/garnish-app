# GARNISH-EMBED-L4-13 — Recipe Content Representation + Feature Store (content-side, immediately useful)

**Track:** 3 · Sprint 3.1 (opener) · **Branch:** `exec/garnish-embed-l4-13` · **Baseline:** master `a82e9dc6`
**Scope:** content-side recommendation foundation — deterministic, local, wired to visible features now. No migration.

---

## Mission outcome

Built the **retrieval/representation half** of the recommender as content-side capability that improves
already-shipped, user-visible features **today** — not dormant infrastructure. The naive 48-dim feature-hash
embedding stub is replaced by a principled, deterministic content representation, served from one content
feature store, and wired into search, "similar recipes", and the live candidate-generator. The user-behavior
learning half is **explicitly deferred + logged** to Track 7 (so it can never be forgotten or left half-done).
No second shadow/experimentation tower — `runtime-shadow/**` stays frozen and is never imported.

## What shipped (A–D), each wired to a visible improvement

| Part | Deliverable | Visible value (now) |
|---|---|---|
| **A. Content representation** | `recipes/search/recipe-content.ts` (pure): `buildContentDoc` (canonical weighted text + facets — ONE source of truth), `buildContentVector` (principled 64-dim **interpretable** vector: explicit facet block + weighted content-token bag, L2-normalized, deterministic) replacing the 48-dim hash; `extractFacets`, `facetSimilarity`, `blendSimilarity`, `cosineDense`. | Upgrades search relevance + similar quality + candidate quality from ONE consistent, explainable representation. |
| **B. Content feature store** | `recipes/search/recipe-content-feature-store.service.ts`: owns a single cached TF-IDF index over canonical content docs + per-recipe facets/vectors; contract `getContentFeatures` / `getVector` / `neighbors`; TTL caching (one DB read per window). | Search + similar now read **one** consistent content source instead of ad-hoc per-call text assembly. |
| **C. Better "similar recipes"** | `RecipeSearchService.similar` now delegates to the store's **facet-blended** neighbors (TF-IDF term cosine boosted when cuisine/meal-type/effort align), with an explainable "similar because shared ingredients / same cuisine / comparable effort". | Directly better + explainable `GET /recipes/:id/similar` today. |
| **D. Content-based candidate quality** | `RecipeEmbeddingService` now produces the principled vector. The LIVE candidate-generator's existing embedding bucket (`getEmbeddingSimilarRecipes`) and `ranking.service` consume it unchanged → better content candidates, additively, behind the live path. | Better content candidates in the live pipeline (cold-start **ranking** proper remains S10, as specified). |

## Why no external dep / vector DB / second shadow

The representation is deterministic local math (TF-IDF reuse + interpretable facets + stable FNV hash) — no
LLM, no embedding API, no vector DB, no new dependency (`pnpm install --frozen-lockfile` succeeded; no
`package.json`/lockfile change). It is content-side only: the new files **never import** `runtime-shadow/**`
(QA-gate enforced), and the frozen shadow's own feature paths and the user-side `FeatureStoreService` are
untouched. The `git diff` is confined to `embeddings/` + `recipes/search/` + the two logs + the QA artifact.

## Anti-second-shadow / determinism QA gate

`recipes/search/embed-l4-13-qa-gate.spec.ts` — **7/7 checks pass, 0 failed**
(artifact: `docs/qa/embeddings/garnish_embed_l4_13_content_side_results.json`):
`no_runtime_shadow_import`, `no_randomness` (0 `Math.random`), `no_external_or_vectordb_dep`,
`deterministic_vector`, `principled_ranking` (related content ranks above unrelated), `search_reads_store`,
`embedding_uses_principled_vector`.

## Deferred (LOGGED, not half-built): user-side learning → Track 7

The matching user-side representation (learning a taste vector from real pilot behaviour to complete the
two-tower + proper cold-start ranking) is intentionally NOT built — it needs pilot data that doesn't exist
pre-launch. It is logged as **RISK_REGISTER `R-T7-USERSIDE-EMBEDDING`** + **DECISION_LOG `D13`**, with the
Track-7 trigger, so it is never forgotten. The content-side foundation is complete and live.

---

## PHASE 2 — Isolated worktree clean-install (verbatim)

```
$ git worktree add --detach ../garnish-verify exec/garnish-embed-l4-13
HEAD is now at 996f69e2 feat(EMBED-L4-13): deterministic recipe content representation + content feature store (content-side)

$ pnpm install --frozen-lockfile
Done in 28s                          # frozen lockfile → NO dependency changes (no vector DB / external SDK)

$ pnpm --dir apps/server exec prisma generate
✔ Generated Prisma Client (v5.22.0) in 497ms

$ pnpm build
Tasks:    2 successful, 2 total      # server (nest) + web (vite) — exit 0

$ pnpm coverage:check
coverage: ... deferred=14 | UNMAPPED=0 UNREGISTERED=0
COVERAGE GATE PASSED.

$ pnpm test
server:test: Test Suites: 179 passed, 179 total
server:test: Tests:       1335 passed, 1335 total     # 0 skips (= worktree baseline 1313 + 22 new)

$ git status --short                 # only docs/qa + coverage.generated regeneration churn (NOT committed)
$ git diff --name-only master..HEAD  # 14 files, confined to embeddings/ + recipes/search/ + 2 logs + qa artifact
$ git worktree remove ../garnish-verify   # blocked by regen churn → prune + rm -rf + prune
```

**Scope-proof summary:** changes confined to `embeddings/` + `recipes/search/` (+ `recipes.module` + logs +
qa artifact) — **NO `runtime-shadow/**` change, NO recommendation/pipeline rebuild**; **no `package.json`/
lockfile change** (no heavy dep, no vector DB, no external API SDK); representation is deterministic (grep: 0
`Math.random` usage, no live-model call); each capability is wired to a visible feature (search / similar /
candidate-generator embedding bucket); the Track-7 deferral is logged (RISK_REGISTER `R-T7-USERSIDE-EMBEDDING`
+ DECISION_LOG `D13`); no new ingredient IDs; coverage green.

---

## REQUIRED VERDICT BLOCK

```
EMBED_L4_13 RESULT: PASS
Clean install (worktree): build exit 0, coverage:check green, tests Test Suites 179/179, Tests 1335/1335, skips 0
Content representation: deterministic, no external dep/vectorDB = yes (TF-IDF reuse + interpretable facet block + stable FNV hash, L2-normalized); replaces 48-dim stub = yes
Feature store: contract + caching = ok (RecipeContentFeatureStore: getContentFeatures/getVector/neighbors, TTL-cached); read NOW by = search, similar, + candidate-generator embedding path (via the principled vector)
Visible value shipped THIS sprint: search=better (one consistent representation), similar=better+explainable (facet-blended neighbors), content-candidates=available+used (live embedding bucket + ranking)
No second shadow/experimentation system: proven — git diff confined to embeddings/ + recipes/search/; runtime-shadow untouched + never imported (QA gate)
Deferred (LOGGED, not half-built): user-side learning → Track 7 pilot = RISK_REGISTER R-T7-USERSIDE-EMBEDDING + DECISION_LOG D13 added
Boundaries: live-AI=NONE, external-API=NONE, vectorDB=NONE, new-heavy-dep=NONE, newIngredientIDs=0, migration=none
Reuse-proof: extends S4 TF-IDF (one shared index) + getLivingUserProfile (search personalize); no parallel recommender; allergen hard-filter preserved in personalized search
Coverage gate: green (endpoints registered=0 new — improvements wired into existing search/similar/candidate paths)
Merge/push: exec/garnish-embed-l4-13 → master ff/pushed (commit 996f69e2 + report)
Verdict: EMBED_L4_13_PASS
```
