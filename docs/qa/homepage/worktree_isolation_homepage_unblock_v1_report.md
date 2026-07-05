# Worktree Isolation & Homepage Sprint Unblock Gate v1 Report

## 1. Verdict
BLOCKED

[قطعی] Gate متوقف شد. Safety scan یک فایل backup بزرگ و مشکوک پیدا کرد:

- `C:\dev\garnish-app\docs\qa\recipes\global_143_pre_apply_backup_v0_1.json`
- Size: `35,855,656` bytes
- Last write: `2026-07-01 16:39:52`

طبق سند، اگر `backup` / dump / large generated file مشکوک دیده شود، باید STOP کرد و commit/stash انجام نداد. بنابراین هیچ local safety checkpoint، stash، branch یا clean worktree ساخته نشد.

## 2. Original Branch and HEAD
- Branch: `fix/shopping-mealplan-overhaul`
- HEAD: `058a75df`

## 3. Commands Recorded

```bash
git branch --show-current
git rev-parse --short HEAD
git status --short
git diff --stat
git diff --name-only
git ls-files --others --exclude-standard
```

Safety scan:

```bash
git diff --name-only + git ls-files --others --exclude-standard | scan env/secret/token/key/credential/dump/backup/prod/production
git diff | scan env/secret/token/key/credential/dump/backup/prod/production/PRIVATE KEY/DATABASE_URL/OPENAI_API_KEY
find files > 20MB excluding .git and node_modules
```

## 4. Dirty Status Summary

Tracked modified files visible in `git diff --stat`:

- `26 files changed`
- `790 insertions`
- `559 deletions`

Untracked files/folders are extensive and include:

- many recipe repair/import/audit scripts under `apps/server/scripts/recipes/`
- many recipe detail presenter/test files under `apps/web/src/app/recipe/[id]/`
- homepage audit reports under `docs/qa/homepage/`
- recipe QA, authenticity, meze, closeout and content repair reports under `docs/qa/recipes/`

## 5. Change Buckets and Counts

| Bucket | Count | Notes |
|---|---:|---|
| homepage/app-shell related | 2 | `apps/web/src/app/home/lib/reasons.js`, `docs/qa/homepage/` |
| recipe detail / cook related | 31 | recipe detail page, cook page, ingredient presenters/tests, recipe-detail QA docs |
| shopping / meal-plan related | 1 | `apps/web/src/app/shopping-list/useShopping.js` |
| server / API related | 5 | AI substitution tool, recipe controller/service/search files |
| data/import/recipe scripts | 99 | recipe repair/import/audit scripts and recipe QA docs |
| style/design-system related | 3 | `FoodDnaRing`, `ThemeContext`, `tokens.css` |
| QA/report files | 1 | `docs/audits/` |
| unknown/risky | 7 | food-dna page/tests, AISheet/tests, `pnpm-workspace.yaml` |

## 6. Risky File Scan Result

### Filename Pattern Matches
The filename scan matched:

- `apps/web/src/styles/tokens.css`
- `docs/qa/recipes/recipe-trust-closeout/product_decisions_85.json`
- `docs/qa/recipes/recipe-trust-closeout/product_decisions_85.md`
- `docs/qa/recipes/resolve-authenticity-85-no-public-blockers/final_product_decision_public.csv`
- `docs/qa/recipes/resolve-authenticity-85-no-public-blockers/product_decisions_85.json`
- `docs/qa/recipes/resolve-authenticity-85-no-public-blockers/product_decisions_85.md`

[احتمالاً] این‌ها false positive هستند، چون `tokens` و `product` به ترتیب با `token` و `prod` match شده‌اند. با این حال، این‌ها دلیل اصلی توقف نبودند.

### Diff Content Pattern Matches
`git diff` contains occurrences of `token` mostly in recipe search tokenization code and tests:

- `tokenize`
- `qTokens`
- `titleTokens`
- Persian search tests for half-space handling

[احتمالاً] این‌ها secret نیستند و به search tokenizer مربوط‌اند.

### Large / Backup File Blocker
Large-file scan found:

| File | Size | Reason |
|---|---:|---|
| `docs/qa/recipes/global_143_pre_apply_backup_v0_1.json` | `35,855,656` bytes | contains `backup` in filename and is >20MB |

[قطعی] این فایل blocker واقعی است. حتی اگر در `git status` دیده نشود، در workspace وجود دارد و طبق safety rule باید قبل از checkpoint تصمیم‌گیری شود.

## 7. Safety Checkpoint Method
None.

No local commit was created.
No stash was created.

Reason: safety scan is BLOCKED by large backup file.

## 8. New Worktree Path
Not created.

Target path from prompt, if unblocked later:

- `C:\dev\garnish-homepage-launch-v1`

## 9. New Branch
Not created.

Target branch from prompt, if unblocked later:

- `sprint/homepage-launch-redesign-v1`

## 10. New Branch HEAD
Not applicable.

Preferred clean base remains:

- `058a75df`

## 11. Clean Git Status Result
Not applicable. No clean worktree was created.

## 12. Baseline Commands Run
Not run.

Required commands deferred:

```bash
pnpm --dir apps/web build
pnpm --dir apps/server build
```

Optional commands deferred:

```bash
pnpm --dir apps/web test
pnpm --dir apps/server test
```

Reason: the gate stops before checkpoint/worktree creation, so baseline validation on a clean worktree is not possible.

## 13. Whether Homepage Sprint Is Allowed Next
No.

[قطعی] Homepage Launch Redesign Sprint v1 should not run yet. The current workspace must first be made safe by deciding what to do with the large backup file and then creating a clean isolated worktree.

## 14. Exact Next Safe Action

Recommended next action:

1. Decide whether `docs/qa/recipes/global_143_pre_apply_backup_v0_1.json` should be kept outside git/worktree, archived elsewhere, or intentionally tracked via a large-file policy.
2. Do not delete it automatically.
3. After the user confirms the handling of that file, rerun this gate.
4. If safety scan passes, create the local dirty checkpoint and clean homepage worktree from `058a75df`.

Suggested next prompt:

```text
The large backup file docs/qa/recipes/global_143_pre_apply_backup_v0_1.json is allowed to remain uncommitted and excluded from checkpoint. Continue the Worktree Isolation gate by creating a local safety checkpoint of safe git-visible files only, then create the clean homepage worktree from 058a75df.
```

## 15. Final Hard PASS Criteria

| Criterion | Result |
|---|---|
| Dirty work safely checkpointed or stashed | FAIL |
| No risky secret/private/generated file committed | PASS, because nothing was committed |
| New clean branch/worktree created | FAIL |
| New worktree git status clean | NOT RUN |
| Web build passes | NOT RUN |
| Server build passes | NOT RUN |
| Report created | PASS |

## Final Assessment
[قطعی] این gate تا اینجا درست متوقف شد. مشکل از homepage نیست؛ مشکل release hygiene است. ادامه دادن بدون تعیین تکلیف فایل backup بزرگ، checkpoint محلی را آلوده و review/rollback را پرریسک می‌کند.
