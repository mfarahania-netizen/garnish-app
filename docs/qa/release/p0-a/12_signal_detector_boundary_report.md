# P0-A v2 SignalDetector boundary report

Status: **PASS — ADV-P0A-003 closed in focused validation**

Phase reached: the scheduler now checks both required runtime switches before logging, user discovery, consent reads, optional-table access, snapshot/vector work, feature-store calls, or downstream signal processing.

The disabled contract is explicit:

```json
{
  "status": "disabled",
  "reason": "optional_processing_disabled",
  "usersDiscovered": 0
}
```

Two parameterized tests cover analytics OFF and personalization OFF. They assert zero calls to `user.findMany`, consent epoch reads, UserEvent, SignalObservation, UserFeature, UserBehaviorSignal, MealPlan, signal calculator, snapshot builder, and feature store.

Focused command:

```text
CI=true NODE_OPTIONS=--max-old-space-size=8192
pnpm.cmd --dir apps/server exec jest src/behavior-engine/signals/signal-detector.service.spec.ts --runInBand
```

Result: exit 0; 1/1 suite and 6/6 tests passed; Jest 40.709s; wall 55.296s. No snapshot or tracked QA artifact was written.

Remaining integration condition: the final focused lane, server build, full server runs, and independent re-review must stay green after the shared transaction boundary lands.

## Final integration addendum

Those integration conditions were rechecked after the final server change:

- comprehensive focused server lane: 46/46 suites, 360/360 tests PASS;
- full server run 1: 300 executed suites and 2,593 executed tests PASS, zero failures;
- full server run 2: identical membership and counts, zero failures;
- TypeScript compile: PASS;
- server build: PASS.

ADV-P0A-003 remains closed. This report does not convert the browser gate to PASS.
