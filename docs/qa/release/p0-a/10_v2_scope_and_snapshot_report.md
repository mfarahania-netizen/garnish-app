# P0-A v2 scope and second snapshot report

Verdict: **PASS_TO_PHASE_1**

## Identity

- Expected/current branch: `fix/p0-a-safety-consent-session-isolation-v1`
- Known base and HEAD: `1631dc5dbf0f0d5b9699399ed8f50ebef4b053ab`
- Fetched `origin/master`: `1631dc5dbf0f0d5b9699399ed8f50ebef4b053ab`
- Local `master`: `d3ffde74b8415843b863799465f8390a408bd48b`; treated as unrelated shared state and not checked out.

`origin/master` did not diverge from the audited base, so `BLOCKED_BY_BASE_DIVERGENCE` does not apply.

## Pre-v2 worktree

- Tracked files changed: 153
- Tracked diff: 8,111 insertions / 1,973 deletions
- Allowed untracked P0-A files: 73
- Old launch files excluded: 35
- `git diff --check`: PASS
- Staged files: 0
- Profile generated QA JSON: clean/restored

## Second external snapshot

- Root: `C:\Users\mfara\.codex\snapshots\garnish-p0-a\20260713-015745-pre-v2`
- Bundle: `C:\Users\mfara\.codex\snapshots\garnish-p0-a\20260713-015745-pre-v2\garnish-p0-a-pre-v2-snapshot.zip`
- Bundle SHA256: `F38A125869FFCB022BF3136D4144697E641CB7287AA86646AE86594A85A6F9C4`
- Binary patch SHA256: `8FA29C73F99A2958B2627185AE16ADC89E23F6E35B3B8FF21CB36E6564748586`
- Untracked archive SHA256: `5F91761AFB1D490091069E52AC0D66482AC0F06D4AA040A9D083CBB023881CE0`
- Status manifest SHA256: `7318C7D758B6A7BA9162683E9CD08C6783114EEB64B2A2008CF3D3E3892FDCD5`
- Binary patch numstat rows: 153
- Bundle entries listed successfully: 7

Excluded from the snapshot: `node_modules`, `dist`, caches, generated Prisma/client output, 35 old `docs/qa/launch/**` files, and the generated profile QA JSON.

## v2 scope decision

Only the shared transaction boundary, its direct integration, SignalDetector runtime-OFF order, the nine known red server suites, recipe-prior fail-neutral decision, browser/query/DB evidence, gap classification, and mandatory reports are authorized. Food DNA, baseline lint, tracked-artifact generator repair, recipe/ingredient data, migrations, production systems, P0-B/P0-C, and Household OS remain excluded.
