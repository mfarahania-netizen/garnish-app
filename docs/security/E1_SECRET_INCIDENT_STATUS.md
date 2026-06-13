# E1 — Secret Incident Status

**Date:** 2026-06-13 · **Owner:** Founder / EL · **Related:** `E1_secret_purge_runbook.md`, RISK `R-E1-HISTORY-DEAD-SECRETS`.

## Summary
The original `apps/server/.env` (Gemini API key, JWT secret, database URL) was committed to git history.
**Active exposure is MITIGATED.** The remaining work — removing the file from git *history* — is
**deferred** because the required tooling is not available in the current environment. No secret values
appear in this document.

## Active risk — MITIGATED ✅
- **Repository made PRIVATE** (Founder).
- **Gemini API key revoked and replaced** (Founder) → the exposed key is now dead.
- **JWT_SECRET rotated** (Founder) → old token signing secret is dead (existing sessions invalidated, expected).
- **DATABASE_URL / database password rotated or replaced** (Founder, local-only disposable) → old value dead.
- **New values exist only in local `apps/server/.env`** (never committed).
- `apps/server/.env` is **not tracked on the current tip** (only `*.env.example` placeholder templates are tracked).
- **Backup bundle** `../garnish-pre-purge.bundle` created and verified (`git bundle verify` = "records a complete history").

Net effect: the secret values still present in history are **revoked/dead and unexploitable**, and the repo
is private. There is **no active, exploitable exposure**.

## Open item — history purge DEFERRED ⏳
- `apps/server/.env` still exists in git **history**: 2 commits — `e715471` ("fresh start" root) and
  `a65ec03` (the commit that untracked it). It is therefore present in the pushed (private) GitHub history.
- **Why deferred:** the purge tool could not run in the working environment:
  - no functional **Python 3** (only the Windows Store stub; `python` does not execute code),
  - **`git-filter-repo` not installed** and not installable here (no `pip`),
  - **`gitleaks`** and **`trufflehog`** not installed (cannot verify post-purge).
- Per policy: **no `git filter-branch`, no weaker tool, no force-push** was used.

## Required tooling/machine to finish the purge (future)
Run on a machine (or CI) that has all of:
- **Real Python 3** (3.5+),
- **git-filter-repo** (`pip install git-filter-repo`),
- **gitleaks** and **trufflehog** (post-purge verification).

Canonical command (git-filter-repo has **no** `--sensitive-data-removal` flag in any release; `--invert-paths
--path` is the complete, canonical file-from-history removal — not "weaker"):
```bash
git bundle create ../garnish-pre-purge.bundle --all && git bundle verify ../garnish-pre-purge.bundle
git filter-repo --invert-paths --path apps/server/.env --force
git log --all --oneline -- apps/server/.env        # must be EMPTY
git remote add origin https://github.com/mfarahania-netizen/garnish-app.git   # filter-repo drops origin
gitleaks detect --source . --no-banner             # expect 0
trufflehog git file://. --only-verified            # expect 0
pnpm build                                          # expect green
git push --force --all origin && git push --force --tags origin
```
Full step-by-step: `docs/security/E1_secret_purge_runbook.md`.

## After a future purge — collaborator requirement
History rewrite changes every commit hash. **Every collaborator must re-clone** the repo after the
force-push (do **not** `git pull` onto the old history). Coordinate the force-push so no one loses work.

## Residual risk (low, but real until purge)
- The dead secret values remain in the **private** repo's git history.
- **GitHub-side caches and any forks** can retain old objects even after a future purge; GitHub Support may
  need to be asked to clear cached views, and any fork must be deleted/re-created.
- Treat the purge as required **before**: external due diligence, adding new collaborators, making the repo
  public, or G1 security closeout.

## Status line
**E1 active exposure: MITIGATED. History purge: PENDING (tooling). E1: OPEN for final security closeout.**
