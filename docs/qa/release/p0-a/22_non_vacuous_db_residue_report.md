# P0-A v3.4 non-vacuous database audit

## Verdict

**PASS**; fresh independent review: `APPROVE`. Database: `garnish_p0a_v34_browser_20260713_235611`; 52/52 existing migrations.

| Table | Rows |
|---|---:|
| User | 2 |
| UserConsent | 10 |
| ConsentLog | 6 |
| UserEvent | 4 |
| RecommendationExposure | 0 |
| FeatureContributionLog | 12 |
| RecommendationServedItem | 2 |
| RecommendationAttributionEvent | 0 |
| SignalObservation | 0 |
| UserFeature | 33 |
| UserOutcome | 0 |
| UserBehaviorTimeline | 0 |
| ExperimentAssignment | 0 |
| EventOutbox | 3 |
| UserAuditLog | 1 |

Required assertions passed: two distinct QA accounts; consent history; valid pre-withdrawal event; committed withdrawal epoch; optional writes after withdrawal zero across audited tables; dropped-event residue zero; re-consent replay zero; Account-A rows linked to B zero; cross-account joins zero; operational audit in UserAuditLog; raw OTP/JWT/cookie/token metadata matches zero.

The audit was non-vacuous: final count-only cleanup snapshot recorded 28 non-empty application tables and 113 rows. Evidence was copied before the exact DB was dropped; exact catalog and prefix counts then became zero and QA listeners were zero.

Evidence reuse: Scenarios 1–7 v3.3. New evidence: Scenarios 8–13, DB audit, QueryClient/PWA, and 24/24 viewports via Playwright 1.61.1/system Chrome 150. v3.4 source/test changes: none; tests/build/lint not rerun; inherited baseline is 2 FoodDNA failures and 5 lint errors. Reviewer `APPROVE`; report commit `PENDING_AT_REPORT_FREEZE`; push PENDING; master untouched. Exact next action: allowlisted branch commit and push.
