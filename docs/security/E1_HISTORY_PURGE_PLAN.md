# E1 — Git History Secret Purge Plan (R-E1-HISTORY-DEAD-SECRETS)

**Date:** 2026-06-15 · **Owner:** Founder / EL · **Epic:** E1 (P0) · **Status:** PLAN READY — history rewrite is **HUMAN-GATED** (founder runs the force-push).
**Related:** `E1_SECRET_INCIDENT_STATUS.md`, `E1_secret_purge_runbook.md`. **No secret values appear in this document.**

> ⚠️ **The Coding Assistant does NOT execute the history rewrite or any force-push.** This file is a
> reviewable plan + exact command set for a human to run on a machine that has the required tooling.

## 1. What must be purged (paths / patterns)
- **Path:** `apps/server/.env` — the only file that ever carried real secrets (Gemini API key, `JWT_SECRET`, `DATABASE_URL`).
- **History locations:** present in **2 commits** — `e715471` ("fresh start" root) and `a65ec03` (the commit that untracked it). These are in the pushed (private) GitHub history.
- **Current tip:** `apps/server/.env` is **NOT tracked** (only `*.env.example` placeholder templates are tracked). No additional secret-bearing paths were found in history beyond `apps/server/.env`.
- **Pattern note:** purge is **by path** (`--invert-paths --path apps/server/.env`), which removes the file and all its historical contents (every secret it ever held) in one pass — this is the canonical, complete removal, not a "weaker" content-pattern scrub.

## 2. Current-tree status (already safe)
- **Active exposure MITIGATED:** Gemini key revoked/replaced, `JWT_SECRET` rotated, `DATABASE_URL` rotated/replaced, repo made **private** (all founder-done). The values still in history are **dead/unexploitable**.
- **Working-tree secret scan (2026-06-15, this sprint):** gitleaks/trufflehog binaries are **not installed in this environment**, so a documented ripgrep pattern scan was run over the tracked working tree (`.gitignore`-respecting, so `apps/server/.env` + `node_modules` excluded). **Result: 0 real secrets.** All 15 pattern hits are placeholders (`username:password`, `u:p`), redacted values (`postgresql://garnish:***@…`), or deliberate denylist/eval/test fixtures (e.g. the output-safety regression corpus's fake `AIzaSy…1234567890`). No real Gemini key / JWT / DB password / private key is present on the tip.
- `apps/server/.env` is git-ignored and untracked; backup bundle `../garnish-pre-purge.bundle` was previously created + verified.

## 3. Required tooling (run on a capable machine / CI)
The purge could not run here (no functional Python 3, no `git-filter-repo`, no `gitleaks`/`trufflehog`). Run on a machine that has **all** of:
- Real **Python 3** (3.5+)
- **git-filter-repo** (`pip install git-filter-repo`)
- **gitleaks** and **trufflehog** (post-purge verification)

## 4. Backup / rollback FIRST (mandatory, non-destructive)
```bash
# 1. Full mirror backup (every ref) BEFORE touching history — rollback source if anything goes wrong.
git clone --mirror https://github.com/mfarahania-netizen/garnish-app.git garnish-mirror-backup.git
# 2. Local bundle backup (already exists; re-verify or recreate).
git bundle create ../garnish-pre-purge.bundle --all && git bundle verify ../garnish-pre-purge.bundle
```
**Rollback:** if the rewrite is wrong, restore from the mirror (`git push --mirror` from `garnish-mirror-backup.git`) or re-clone the bundle. Do not delete the backups until the purge is confirmed good.

## 5. Purge command set (HUMAN-GATED)
```bash
# Run from a fresh clone of the repo on the capable machine.
git filter-repo --invert-paths --path apps/server/.env --force
git log --all --oneline -- apps/server/.env          # MUST be EMPTY (no commits touch the file)
git remote add origin https://github.com/mfarahania-netizen/garnish-app.git   # filter-repo drops origin
gitleaks detect --source . --no-banner               # expect 0
trufflehog git file://. --only-verified              # expect 0
pnpm i && pnpm build                                 # expect green (both apps)
```

## 6. Force-push (HUMAN-GATED — the irreversible step)
```bash
git push --force --all origin
git push --force --tags origin
```
**Consequences (must be understood before running):**
- **Every commit hash changes.** All branches/tags are rewritten.
- Open PRs against old hashes break; CI caches keyed on old SHAs invalidate.
- **GitHub-side caches and any forks** can retain old objects even after the force-push — GitHub Support may need to clear cached views; any fork must be deleted/re-created.

## 7. Collaborator re-clone (mandatory after force-push)
History rewrite changes every hash. **Every collaborator must re-clone** (do **not** `git pull` onto the old history):
```bash
# each collaborator, after the founder force-pushes:
cd .. && rm -rf garnish-app && git clone https://github.com/mfarahania-netizen/garnish-app.git
```
Coordinate timing so no one loses unpushed work (have everyone push/stash first).

## 8. Acceptance (this sprint vs. closeout)
- **This sprint (RESET-01):** plan file complete ✅ · working-tree secret scan = 0 ✅ · RISK_REGISTER updated to "purge plan ready, history rewrite pending founder execution" ✅.
- **R-E1 closeout (future, human-run):** §5 shows `git log --all -- apps/server/.env` EMPTY, gitleaks + trufflehog = 0 post-rewrite, build green, force-push done, all collaborators re-cloned.

## 9. Treat the purge as required before
External due diligence · adding new collaborators · making the repo public · G1 security closeout.
