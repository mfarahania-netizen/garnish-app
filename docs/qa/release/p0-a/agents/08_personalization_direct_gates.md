# P0-A agent 08 — personalization direct gates

## Verdict

`PASS` for this bounded lane. Direct personalization signal writes and reads now use the canonical,
current-policy `ConsentService`; stale, withdrawn, absent, and unreadable consent stays cold/fail-closed.

## Changes

- `TasteCorrectionService.correctTastePreference`
  - `like` and `dislike` call `ConsentService.hasPurpose(userId, 'personalization')` before ingredient
    lookup or signal write.
  - absent, withdrawn, or unreadable consent returns `personalization consent required`; no ingredient
    lookup, upsert, or delete is reached.
  - `neutral` remains available after opt-out as a deletion-only privacy control. It deletes the user's
    stored signal without reading consent or resolving the ingredient and cannot create/update data.
- `ProfileReadService.getConsentState`
  - removed the independent legacy `ConsentLog` grant path and the duplicate unversioned `UserConsent`
    reduction.
  - delegates to `ConsentService.grantedPurposes`, so latest-decision and current-policy rules are shared
    with the rest of P0-A. A legacy grant or obsolete policy version cannot activate personalization.
- `BehavioralContextSnapshotService`
  - replaced the historical `userConsent.findFirst(status='granted')` query with canonical
    `ConsentService.hasPurpose`.
  - latest withdrawal, obsolete policy version, and consent read errors produce `{ signals: {} }`,
    `consents: ['core']`, `dataMaturity: 'cold-start'`, and do not query `userBehaviorSignal`.
- Declared allergy registry copy now states that declared allergy/intolerance entries are binary safety
  exclusions and that no intensity level is stored. The former fake “with severity” claim is removed.
- `ProfileModule` and `AiCoreModule` import `ConsentModule` for runtime dependency injection.

## Verification

- Focused Jest:
  - command: `pnpm.cmd --dir apps/server test -- --runInBand` plus the five touched suites
  - result: `5/5` suites passed, `48/48` tests passed.
  - explicit cases cover denied write, latest withdrawal, consent read error, deletion-only neutral,
    legacy grant ignored, stale-policy grant ignored, and snapshot signal reads suppressed.
- Server build: `pnpm.cmd --dir apps/server build` — PASS (`prisma generate` + `nest build`).
- Focused ESLint on 11 touched source/spec/module files — exit `0`, `0 errors`; warnings remain from the
  repository's existing warning-level rules and formatting debt.
- `git diff --check` on all lane files — PASS.
- Source proof:
  - canonical calls are present in all three services.
  - `userConsent.findFirst` and `consentLog.findMany` have no match in the two corrected read services.
  - allergy/severity claim search has no match in `declared-dimension-registry.ts`.

## Scope and safety

- No migration, production database, real analytics mutation, auth rewrite, staging, commit, or push.
- Only the direct gates, their module wiring, focused tests, honest registry copy, and this report changed.
