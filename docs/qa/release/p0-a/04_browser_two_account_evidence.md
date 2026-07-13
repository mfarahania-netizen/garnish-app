# P0-A browser, PWA, and two-account evidence

Date: 2026-07-13 (Asia/Tehran)

Verdict: **CHANGES_REQUIRED**

The browser evidence supports the core account-isolation, logout propagation, legacy-cache purge, and sequential withdrawal guarantees. It does not justify a Hard PASS because the exact refresh-during-withdrawal race was not reproduced in the browser, TanStack Query internals were not directly enumerated, and the server still has a narrow non-transactional consent-check-to-write race documented by the adversarial lane.

## Safety and environment

- Browser: Codex in-app browser, production Vite preview, generated service worker active.
- API: local Nest build on `127.0.0.1:3000`.
- Web origins: `127.0.0.1:4173` for legacy-worker migration and `127.0.0.1:4174` for the isolated continuation run.
- Database: dedicated local PostgreSQL database `garnish_p0a_qa` only.
- Database setup: 52 existing migrations applied; no migration created. The existing seed produced 124 recipes. Twelve recipes were made active/public only inside the disposable QA database so favorites, plans, and recommendations could be exercised.
- External providers: AI live calls off, SMS delivered only to local dev logs, Google auth off, real INE send off.
- Cleanup: API and both preview processes were stopped. `garnish_p0a_qa` was verified by exact name, disconnected, dropped, and then verified absent (`0` matching databases).
- Production, shared databases, source recipe data, and master were not accessed or mutated.

## Accounts and distinct state

| Surface | Account A | Account B | Result |
|---|---|---|---|
| Phone | `09120009991` | `09120009992` | Distinct |
| Display name | `QA Account A` | `QA Account B` | Distinct |
| Diet | vegan | omnivore | Distinct |
| Safety flag | nut | dairy | Distinct |
| Favorite | اسموتی هندوانه | خورشت آلو اسفناج | Distinct |
| Planned recipe | خورشت آلو اسفناج | a different seeded recipe | Distinct |
| Shopping item | `QA-A عدس قرمز` | `QA-B برنج باسماتی` | Distinct |

Account A was verified on profile, settings, favorites, plan/home, shopping list, and recommendation surfaces. Account B was verified on profile, settings, favorites, shopping list, and recommendation-capable home state.

## Scenario results

| Scenario | Evidence | Result |
|---|---|---|
| Account A login and private routes | Real OTP UI; profile showed `QA Account A`, vegan, and one nut safety flag; favorite/plan/list markers were present only for A. | PASS |
| Account A API-down private route | After the API stopped, `/profile` eventually redirected to `/login`; no A private content remained visible. This is fail-closed, not offline availability. | PASS |
| Same-origin two-tab logout | Both tabs initially showed A. Clicking the unique `خروج از حساب` button in tab 1 moved both tabs to `/login`; tab 2 contained no `QA Account A`. | PASS |
| Account switch without browser restart | B logged in after A logout in the same browser profile. B profile showed dairy/omnivore and no A name/nut marker. | PASS |
| B favorites/list isolation | B favorites contained خورشت آلو اسفناج and not اسموتی هندوانه. B shopping list contained `QA-B` and no `QA-A`. | PASS |
| Back/forward after switch | Back landed on B settings; forward landed on B favorites. Neither snapshot contained `QA Account A`; forward retained B's favorite. | PASS |
| B API/network failure | With the API stopped, `/profile` first rendered no private DOM and then redirected to `/login`; neither A nor B private data remained visible. | PASS |
| False anonymous claim | Logged-in pages displayed the actual account name; failed-private access redirected to login rather than presenting cached private state as anonymous. | PASS |
| Refresh during withdrawal | Withdrawal and a post-withdrawal direct impression were exercised sequentially, but a refresh concurrent with the in-flight withdrawal was not captured. | NOT COMPLETE |
| TanStack Query internal enumeration | User-visible query-backed state and cross-tab purge were verified, but the QueryClient cache keys/values were not directly enumerated in the final browser evidence. | NOT COMPLETE |

## Legacy service-worker and storage evidence

Before upgrade, a disposable legacy worker cached cross-origin private API GETs in `api-cache`. Visible inspector evidence included private URLs such as `/users/me`, `/users/consent`, `/profile`, `/users/preferences`, `/recipes`, `/gamification/me`, and `/shopping-list`.

The generated P0-A service worker was then restored and activated. Activation loaded `sw-private-cache-cleanup.js`, deleted the legacy `api-cache`, claimed clients, and forced existing windows to navigate. The forced navigation interrupted the automation connection twice, which is consistent with the intended worker migration behavior and was not counted as a product PASS by itself.

Post-upgrade inspector evidence on the original `4173` origin showed:

- active controller `http://127.0.0.1:4173/sw.js`;
- exactly the Workbox precache containing public build assets;
- no `api-cache` or `asset-cache`;
- no private API request in Cache Storage;
- no IndexedDB database;
- empty `sessionStorage`;
- only named cookie evidence (`g_state`), with no cookie value exposed;
- token presence reported only as masked length.

The continuation origin at `4174` independently showed only the Workbox public-asset precache and no private API cache. A disposable visible QA fixture was placed under ignored generated `dist` output only; it was never added to source or scope.

## Withdrawal and database evidence

Account B granted analytics and personalization, then withdrew both using the visible Settings switches.

Withdrawal rows:

- analytics withdrawn at `2026-07-12 21:44:07.926Z`;
- personalization withdrawn at `2026-07-12 21:44:08.650Z`.

After withdrawal, a visible QA button sent a qualifying `POST /recommendations/impression` with `viewportMs=1200` and `visibleRatio=0.8`. The server returned HTTP 201 with:

```json
{
  "accepted": false,
  "learned": false,
  "reason": "consent_not_granted",
  "trackedRecipeIds": []
}
```

Direct database counts at or after the earliest withdrawal timestamp were all zero:

| Table | Post-withdrawal rows |
|---|---:|
| UserEvent | 0 |
| RecommendationExposure | 0 |
| FeatureContributionLog | 0 |
| RecommendationServedItem | 0 |
| RecommendationAttributionEvent | 0 |
| SignalObservation | 0 |
| UserFeature | 0 |
| UserOutcome | 0 |
| UserBehaviorTimeline | 0 |
| ExperimentAssignment | 0 |

Both optional purposes were then re-granted from Settings. After waiting without a fresh qualifying impression, `UserEvent`, `RecommendationExposure`, `RecommendationAttributionEvent`, and `SignalObservation` remained at zero after the new grant epoch. This supports “re-consent resumes future events only; it does not replay the dropped impression.”

The UI and API rows were keyed to separate authenticated users and exposed only each account's distinct favorite/allergy/list state. A final direct cross-account join audit was not captured before the disposable database was dropped, so the DB-isolation subclaim relies on the authenticated API/UI evidence rather than a saved join result. No admin action was generated in this browser run; canonical `UserAuditLog` behavior is covered by focused server tests, not by a browser-generated audit row.

## Responsive screenshots

- `evidence/20260713-0114-account-b-settings-360-viewport.png`
- `evidence/20260713-0115-account-b-favorites-390-viewport.png`
- `evidence/20260713-0113-account-b-profile-430-viewport.png`
- `evidence/20260713-0112-account-b-shopping-480-viewport.png`
- `evidence/20260713-0116-withdrawal-denied-360-viewport.png`
- `evidence/20260713-0118-legacy-cache-cleaned-default-viewport.png`

All retained screenshots are viewport captures. Earlier full-page captures were visually blank due to the browser capture path and were deleted rather than presented as evidence.

The browser viewport capability was explicitly requested at 360, 390, 430, and 480 CSS px before the named captures. The retained PNGs were emitted by the browser backend at scaled/cropped widths (345 or 360 pixels), so the files do not independently prove exact 1:1 output width. Responsive rendering was visually checked, but exact-width screenshot evidence remains non-conclusive and is another reason this report withholds Hard PASS.

## Browser gate conclusion

The exercised browser scenarios show no A-to-B UI leak, no private API Cache Storage entries after migration, fail-closed API-down behavior, cross-tab logout propagation, no post-withdrawal optional row, and no queued replay after re-consent.

Hard browser/PWA PASS is withheld until the refresh-during-withdrawal race and direct QueryClient enumeration are captured, and until the server-side check-to-write race has a transactional or database-enforced solution.
