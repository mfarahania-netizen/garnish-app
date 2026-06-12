# E1 — Secret Rotation & Git History Purge Runbook

> **Status:** prep done by Coding Assistant. The destructive steps below are **Founder-gated**
> (Constitution A1.1 rule 3, RACI `R*`). Do **not** run sections 3–5 without explicit Founder approval.
> Never print/paste a real secret into a terminal log, PR, or chat.

## What was already done (reversible, CA)
- `apps/server/.env` **untracked** from git (`git rm --cached`); working copy kept on disk.
- `.gitignore` already ignores `.env`, `dist/`, `.turbo/`, `*.log` (verified).
- `.env.example` refreshed with all keys as placeholders + rotation note.
- Fail-fast env validation added (`apps/server/src/config/env.validation.ts`, wired in `main.ts`).
- `gitleaks` pre-commit hook + `.gitleaks.toml`; hooks enabled via `git config core.hooksPath .githooks`.

> ⚠️ Untracking stops *future* commits from including `.env`, but the secrets **still exist in past
> history**. They must be treated as compromised and rotated (section 1), and history purged (section 3+).

---

## 1) Rotate the leaked secrets — DO THIS FIRST (Founder)
The keys committed in history must be assumed public.

- **GEMINI_API_KEY** — revoke in Google AI Studio, issue a new key, put it in local `apps/server/.env`.
- **JWT_SECRET** — generate a new one: `openssl rand -base64 64`. Rotating invalidates existing sessions (expected).
- **DATABASE_URL** — if the DB password was ever in a committed `.env`, rotate the DB password too.

Record the rotation (date, which keys) in `docs/execution/DECISION_LOG.md`.

## 2) Full backup before any history rewrite (Founder)
```bash
# Run from repo root; write the bundle OUTSIDE the repo.
git bundle create ../garnish-pre-purge.bundle --all
git tag pre-purge-backup            # extra safety ref
```
Verify: `git bundle verify ../garnish-pre-purge.bundle`.

## 3) Purge `.env` from all history (Founder-approved)
Requires `git-filter-repo` (https://github.com/newren/git-filter-repo).
```bash
# Removes apps/server/.env from every commit. Rewrites history → new commit hashes.
git filter-repo --invert-paths --path apps/server/.env --force
```
(If multiple env paths leaked, add more `--path` flags.)

## 4) Re-scan to confirm zero secrets
```bash
gitleaks detect --redact --config .gitleaks.toml
trufflehog git file://. --only-verified
git log --all -- apps/server/.env        # must print nothing
```
Both scanners must report **0** verified secrets.

## 5) Coordinate the force-push (Founder + all collaborators)
History rewrite changes every hash after the purge point. Before pushing:
1. Make sure every collaborator has pushed/backed up their work.
2. `git filter-repo` drops the `origin` remote by design — re-add it:
   ```bash
   git remote add origin <REPO_URL>
   git push --force --all
   git push --force --tags
   ```
3. Every collaborator must then **re-clone** (do not `git pull` onto old history).

## Rollback
- Restore from the bundle: `git clone ../garnish-pre-purge.bundle restored-garnish`.
- Old keys cannot be "un-rotated" — rotation is one-way by design.

## Acceptance (E1 done)
- [ ] Gemini + JWT rotated, service boots green with new keys (env validation passes).
- [ ] `git log --all -- apps/server/.env` is empty after purge.
- [ ] gitleaks **and** trufflehog = 0 verified secrets.
- [ ] Force-push coordinated; collaborators re-cloned.
- [ ] Rotation + purge logged in DECISION_LOG.md.
