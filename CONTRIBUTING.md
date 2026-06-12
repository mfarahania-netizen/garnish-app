# Contributing to Garnish OS

This repo is governed by the **Master Execution Constitution v1.0.1**
(`docs/execution/GARNISH_OS_MASTER_EXECUTION_CONSTITUTION_v1.0.1.md`). Read it before
contributing. The Coding Assistant and human contributors implement tasks derived from the
Constitution and approved Part 11 task templates — they do **not** redefine product strategy,
design language, AI policy, market positioning, or roadmap scope.

## Package manager — pnpm ONLY

This is a pnpm + Turborepo monorepo. **Do not run `npm install` or `yarn`** — they generate a
competing lockfile and corrupt the dependency graph.

```bash
# install (respects the committed lockfile)
pnpm install --frozen-lockfile

# run everything
pnpm dev            # turbo dev across apps
pnpm build          # turbo build across apps
pnpm lint           # eslint
pnpm test           # unit/integration tests
```

- The only lockfile is **`pnpm-lock.yaml`**. `package-lock.json` is removed and git-ignored.
- Use `pnpm --filter @garnish/server <script>` / `pnpm --filter @garnish/web <script>` to target one app.

## Repo hygiene rules (E5)

- **Never commit** build artifacts (`dist/`, `.turbo/`), logs (`*.log`), archives (`*.rar`, `*.zip`),
  or local databases (`*.db`). These are git-ignored; if one slips in, `git rm --cached` it.
- **Never commit secrets.** `apps/server/.env` is ignored — use `apps/server/.env.example` as the
  template. See the **Security** section below.
- One-off / experimental scripts live under **`scripts/dev/`**, never in an app's source root.
- After a build, `git status --porcelain` must be **empty**.

## Security

- **Never commit `.env`** or any real key/secret. If a secret is exposed, treat it as compromised:
  rotate it immediately and record the rotation in `docs/execution/DECISION_LOG.md`.
- A `gitleaks` pre-commit hook and CI scan guard against accidental secret commits.
- Auth/user API responses must pass through the user serializer — **no `password`/hash field may ever
  leave the server** (see `apps/server/src/common/serializers/user.serializer.ts`).
- Analytics must not fire before explicit user consent, and must not put PII in event metadata.

## Coding Assistant boundaries (Part 10.1 / Part 11)

The Coding Assistant may implement, refactor, write tests/docs/migrations, and generate code **per an
added spec** — it decides nothing. Every epic starts from a Part 11 task template approved by the
A-role; every irreversible action (history rewrite, data erasure, force-push) requires explicit human
approval. Do-not-cross boundaries: no hardcoded hex (use `tokens.css`), no PII in event metadata,
no medical claims, no dark patterns, no bypassing consent, and never build anything on the WAT
forbidden list.

## Branch & commit

- Branch off `master`; never push directly to it.
- Reference the Epic/Task ID in the commit subject, e.g. `feat(E22): Food DNA step 3`.
- Open a PR; CI (lint, build, tests, gitleaks) must be green before merge.
