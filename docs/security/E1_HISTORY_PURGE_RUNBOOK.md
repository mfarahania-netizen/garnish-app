# E1 — Secret History Purge + Key Rotation RUNBOOK (FOUNDER-EXECUTED)

> **Status:** prep complete (gitleaks-in-CI live; `.env*` gitignored; no real `.env` tracked).
> **The steps below are FOUNDER-EXECUTED — they rewrite shared git history and rotate live credentials.**
> An automated agent must NOT run them (history rewrite + force-push + key rotation are irreversible and
> coordinated). GARNISH-SEC-PRELAUNCH-19 added only the automatable guards (this runbook + the gitleaks CI gate).
> Companion: `docs/security/E1_HISTORY_PURGE_PLAN.md` (plan) · `docs/security/E1_SECRET_INCIDENT_STATUS.md` (status).

## What this fixes (R1 / E1)
Dead-but-historical secrets (Gemini API key, JWT secret, DB creds) committed to early history in
`apps/server/.env` (commits `e715471`, `a65ec03`). Keys were already rotated/revoked once and the repo is
private, but the secret blobs remain reachable in history — they must be purged before the repo is made public
/ before external diligence / before adding collaborators.

## Already done (automated, this sprint — verify, don't redo)
- **gitleaks runs in CI** as a blocking `secret-scan` job (`.github/workflows/ci.yml` → `gitleaks/gitleaks-action@v2`, config `.gitleaks.toml`). A new committed secret fails CI.
- **`.env*` is gitignored** (`.gitignore`: `.env`, `.env.local`, `.env.production`); only safe `*.env.example` files are tracked. Verify: `git ls-files | grep -E '\.env'` → only `*.env.example`.

---

## FOUNDER STEPS (run in order; coordinate with the whole team)

### 0. Pre-flight
- Announce a short freeze; ensure no open PRs you can't re-base. Take a full backup bundle:
  `git bundle create ../garnish-backup-$(date +%Y%m%d).bundle --all`

### 1. Rotate the live credentials FIRST (so purge can't matter even if a copy leaked)
- **Gemini / AI provider key:** revoke the old key in Google AI Studio / Vertex; issue a new one; update it in
  the deploy secret store + local `apps/server/.env` (untracked). Do NOT commit it.
- **JWT secret:** generate a new strong secret (`openssl rand -base64 48`); update the deploy env; this
  invalidates existing sessions (expected).
- **Database credentials:** rotate the DB password/connection string; update the deploy env.
- Confirm the app boots with the new values (server build + a smoke login).

### 2. Purge the secrets from git history (choose ONE tool)
Requires real Python 3 + one of `git-filter-repo` (preferred) or BFG. Run on a FRESH clone.

**git-filter-repo (preferred):**
```
git clone --mirror git@github.com:<org>/garnish-app.git garnish-purge && cd garnish-purge
# remove the file path from ALL history:
git filter-repo --path apps/server/.env --invert-paths
# (optional) also scrub any other leaked path:
# git filter-repo --path <other/secret/file> --invert-paths
```
**BFG alternative:**
```
git clone --mirror git@github.com:<org>/garnish-app.git
bfg --delete-files .env garnish-app.git
cd garnish-app.git && git reflog expire --expire=now --all && git gc --prune=now --aggressive
```

### 3. Verify the history is clean
```
gitleaks detect --source . --no-banner            # 0 findings
git log --all --full-history -- apps/server/.env  # no results
```

### 4. Force-push the rewritten history (COORDINATED)
```
git push --force --mirror   # from the mirror clone
```
- This rewrites every ref. Tell the team to STOP pushing until done.

### 5. Team re-clone (everyone)
- After the force-push, every collaborator must **re-clone** (old clones contain the old history and will
  conflict). Do not `git pull` an old clone — re-clone fresh.
```
rm -rf garnish-app && git clone git@github.com:<org>/garnish-app.git
```

### 6. Post-purge
- Rotate any other secret that was ever in history (audit `.gitleaks.toml` findings).
- Re-enable normal pushes; close R1/E1 in the risk register with the dated completion note.

---

## ⚠️ FOUNDER ACTION REQUIRED (before launch)
**Rotate the Gemini key + JWT secret (and DB creds) at the provider, then run the history purge per the steps
above and force-push.** This sprint cannot and must not do it (irreversible, coordinated, credential-bearing).
Until then, keep the repo private and do not add external collaborators.
