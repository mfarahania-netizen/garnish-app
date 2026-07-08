# Post-Merge Master Health Gate v1

Verdict: PASS_WITH_BROWSER_TIMING_LIMITATION

## Tested Master

- Tested branch: fresh `origin/master`
- Tested hash: `1631dc5d`
- QA branch: `qa/post-merge-master-health-v1`

Recent master history:

- `1631dc5d` docs: add home shell performance master merge report
- `acfbffad` merge: home app shell performance and drawer polish
- `8b1e54cf` fix: improve home favorites loading and drawer visual readiness
- `438498f1` fix: polish home app shell navigation and loading UX
- `0bd36895` docs: add processed recipe media master merge report
- `1e55a7ac` merge: add partial processed recipe cover media pack
- `6b27815e` feat: add processed recipe cover media for launch
- `4f2c470f` docs: add auth onboarding master merge gate report

## Build Results

- `pnpm install --frozen-lockfile`: PASS
- `pnpm --dir apps/server exec prisma generate --schema=prisma/schema.prisma`: PASS
- `pnpm --dir apps/server build`: PASS
- `pnpm --dir apps/web build`: PASS

## Test Results

Backend:

- `pnpm --dir apps/server exec jest auth/auth.service.spec.ts --runInBand`: PASS, 14 tests
- `pnpm --dir apps/server exec jest src/common/phone-normalization.spec.ts --runInBand`: PASS, 5 tests

Frontend:

- `pnpm --dir apps/web exec vitest run src/components/auth/AuthForm.test.jsx src/context/AuthContext.test.jsx src/app/onboarding/useOnboarding.test.jsx src/shell/RequireAuth.test.jsx src/shell/NavDrawer.test.jsx`: PASS, 5 files / 25 tests
- `pnpm --dir apps/web exec vitest run src/app/home/home.smoke.test.jsx src/app/discover/discover.smoke.test.jsx src/app/favorites/favorites.smoke.test.jsx src/app/recipes/recipes.smoke.test.jsx src/components/ges/RecipeCard.dismiss.test.jsx`: PASS, 5 files / 23 tests

## Local Authenticated Smoke

Local/dev only.

- Server: `http://localhost:3007`
- Web: `http://127.0.0.1:5189`
- Mobile viewport: about `390px`
- OTP env:
  - `SMS_PROVIDER=disabled`
  - `SMS_DEV_LOG_OTP=true`
  - `MELIPAYAMAK_ENABLED=false`
  - `OTP_TTL_SECONDS=180`
  - `OTP_RESEND_COOLDOWN_SECONDS=180`
- Login method: normal OTP UI
- Test user: masked local/dev user `0936***08`

Auth smoke:

- `/login` opens: PASS
- OTP request works: PASS
- OTP verify works: PASS
- completed user enters `/`: PASS
- drawer logout returns to `/login`: PASS
- visiting `/favorites` after logout redirects to `/login`: PASS
- runtime `/auth/guest` request: not observed; log only showed startup route mapping for `/auth/guest`

Home/App Shell:

- `/` reachable after login: PASS
- meaningful content visible: PASS
- real images render where media exists: PASS
- no horizontal overflow: PASS

Recipes:

- `/recipes` reachable: PASS
- pagination visible: PASS (`صفحهٔ ۱ از ۲۷`)
- gheymeh-sibzamini image renders: PASS (`/data/media/recipes/gheymeh-sibzamini/cover.webp`)
- gamaj-kabab image renders: PASS (`/data/media/recipes/gamaj-kabab/cover.webp`)
- recipe detail page opens: PASS (`/recipe/garnish_recipe_fa_2054_be491f02`)
- detail hero image renders: PASS (`/data/media/recipes/gheymeh-sibzamini/cover.webp`)
- detail ingredients/steps visible: PASS

Favorites/Discover:

- `/favorites` reachable: PASS
- `/favorites` empty/recommended state readable: PASS
- `/favorites` no horizontal overflow: PASS
- `/discover` reachable: PASS
- `/discover` category/filter content visible: PASS
- `/discover` no horizontal overflow: PASS

Drawer:

- drawer opens inside 390px viewport: PASS
- drawer content visible: PASS
- drawer no horizontal overflow: PASS
- drawer link `/profile`: PASS
- drawer link `/plan`: PASS
- drawer link `/shopping-list`: PASS
- drawer logout: PASS

## Route Timings

Direct local web HTTP checks:

- `/`: `200`, about `175ms`
- `/recipes`: `200`, about `21ms`
- `/favorites`: `200`, about `14ms`
- `/discover`: `200`, about `19ms`

Browser timing note:

- The in-app browser bridge intermittently stalled during `tab.goto` / evaluate cycles, especially on route timing reads.
- Page state after reconnect showed the expected route and content.
- Therefore this report treats visual/functionality smoke as PASS, but does not claim precise browser timing.

## Media Contract Snapshot

- Committed `cover.webp` count under `apps/web/public/data/media/recipes`: `134`
- Total committed cover size: about `28.81 MB`
- Status: partial processed media pack only
- Full media contract is not complete and must not be claimed complete from this gate.

## OTP Config / Copy Status

Smoke backend env:

- `OTP_TTL_SECONDS=180`
- `OTP_RESEND_COOLDOWN_SECONDS=180`

Observed UI copy:

- Code validity text: `کد تا ۲ دقیقه معتبر است`
- Resend text: `ارسال دوباره · ۱۷۹ ثانیه`

Status:

- Resend cooldown matches 3-minute behavior: PASS
- TTL copy mismatch remains: backend TTL was 180 seconds, UI copy says 2 minutes

Recommendation:

- Run a focused auth config/copy gate to align code validity text and configured `OTP_TTL_SECONDS`.
- Either set TTL to 120 seconds to match the current text, or update the UI copy to 3 minutes if product wants 180 seconds.

## Production Untouched Confirmation

- No production deploy
- No production DB mutation
- No migration
- No recipe/ingredient data change
- No media/raw commit
- No code change in this gate
- No cleanup/deletion
- No master push

## Next Recommended Gate

Priority 1:

- Auth OTP config/copy alignment gate.

Priority 2:

- Full media contract completion for the remaining recipes without committed covers.

Priority 3:

- Browser-performance smoke with a more reliable automation channel or production-like Lighthouse/Playwright run.
