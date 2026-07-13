# Web consent race and recommendation attribution closure

## Scope

- `[قطعی]` Analytics events now re-check both the in-memory consent deny switch and the captured auth token at the final boundary immediately before every `/analytics/event` POST.
- `[قطعی]` A withdrawal observed after canonical consent GET and before POST produces zero ingest POSTs; the hook returns `null` and does not retry.
- `[قطعی]` Personalization withdrawal clears `garnish:rec-attribution` synchronously, before the consent acknowledgement is awaited.
- `[قطعی]` While the local personalization runtime mirror is off, attribution recall and writes remain disabled even when analytics is still granted.
- `[قطعی]` Canonical denial, unavailable processing, and failed/unknown personalization writes also clear attribution fail-closed.
- `[قطعی]` Re-consent does not reconstruct erased request IDs; only a newly served recommendation can create a new attribution entry.

## Files

- `apps/web/src/hooks/useAnalytics.js`
- `apps/web/src/hooks/useAnalytics.test.jsx`
- `apps/web/src/lib/recommendationAttribution.js`
- `apps/web/src/lib/recommendationAttribution.test.js`
- `apps/web/src/app/settings/useSettings.js`
- `apps/web/src/app/settings/useSettings.test.jsx`

`apps/web/src/lib/analytics-init.js` was not changed because an explicit synchronous attribution-clear boundary was sufficient.

## Verification

`[قطعی]` Focused Vitest run passed: 3 files, 24 tests.

```text
pnpm.cmd --dir apps/web exec vitest run src/hooks/useAnalytics.test.jsx src/lib/recommendationAttribution.test.js src/app/settings/useSettings.test.jsx
Test Files  3 passed (3)
Tests      24 passed (24)
```

`[قطعی]` Focused ESLint run passed with no output:

```text
pnpm.cmd --dir apps/web exec eslint src/hooks/useAnalytics.js src/hooks/useAnalytics.test.jsx src/lib/recommendationAttribution.js src/lib/recommendationAttribution.test.js src/app/settings/useSettings.js src/app/settings/useSettings.test.jsx
```

## Residual boundary

- `[قطعی]` This lane verifies the client-side last-moment deny boundary; server-side ingest enforcement remains the authoritative protection against requests already in flight.
- `[قطعی]` No server files, production systems, git staging, commits, or pushes were touched by this lane.
