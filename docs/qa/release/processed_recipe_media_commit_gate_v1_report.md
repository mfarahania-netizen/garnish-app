# Processed Recipe Media Commit Gate v1

## Verdict

FAIL

This branch safely adds the currently processed recipe cover media, and the specific broken samples from the previous Recipe UX smoke now render real images. However, the full API/media contract is still incomplete: the local/dev API reports 569 recipes with `imageUrl`, while only 134 matching processed `cover.webp` files are available in this pack. 435 API image paths still have no static file in this fresh worktree.

The branch is safe for review as a partial processed-media commit, but it is not enough to mark recipe media launch-ready.

## Base

- Base master hash: `4f2c470f`
- Branch: `release/processed-recipe-media-v1`
- Source worktree for processed assets: `C:\dev\garnish-app`
- Fresh validation worktree: `C:\dev\garnish-media-processed-v1`

## Included Media

- Included files: 134
- Included type: `apps/web/public/data/media/recipes/<slug>/cover.webp`
- Total size: 28.81 MB
- Optional `thumb.webp`: 0
- Non-WebP files: 0
- Hidden/system files: 0
- Tiny files under 5 KB: 0
- Files over 1 MB: 0
- Dimensions: all sampled/parsed files are valid VP8 WebP, `1448x1086`

## Largest Files

| File | Bytes |
| --- | ---: |
| `chicken-pesto-pizza/cover.webp` | 489688 |
| `bacon-pizza/cover.webp` | 483774 |
| `pizza-margherita/cover.webp` | 482446 |
| `steak-pizza/cover.webp` | 446904 |
| `mahi-shekam-por/cover.webp` | 407464 |
| `indonesian-salad/cover.webp` | 395248 |
| `saffron-chicken-stew/cover.webp` | 385114 |
| `vegetable-noodles/cover.webp` | 349122 |
| `kashk-bademjan/cover.webp` | 344306 |
| `torsh-shami-gilani/cover.webp` | 343798 |
| `tahchin-goosht-bademjan/cover.webp` | 341634 |
| `morgh-torsh-gilani/cover.webp` | 324466 |
| `khoresh-kadoo/cover.webp` | 318704 |
| `kalam-polo-shirazi/cover.webp` | 317606 |
| `dandeh-kabab-kermanshahi/cover.webp` | 314746 |
| `sosis-bandari/cover.webp` | 312540 |
| `gamaj-kabab/cover.webp` | 311466 |
| `sabzi-polo-ba-mahi/cover.webp` | 303838 |
| `tahandaz-morgh/cover.webp` | 289742 |
| `gheimeh-nesar/cover.webp` | 287678 |

## Forbidden Files Excluded

- `food pic-gbt/**`: not copied
- raw source images/videos: not copied
- `apps/server/scripts/recipes/apply-food-pic-gbt-images.js`: not copied
- `docs/qa/media/**`: not copied
- `docs/qa/launch/**`: not copied
- recipe/ingredient data files: not changed
- code files: not changed
- real `.env` files: not copied

## Path Shape Validation

All staged/untracked media paths match:

```text
apps/web/public/data/media/recipes/<slug>/cover.webp
```

No copied media path violates the allowed shape.

## Static Serving Validation

Local Vite server: `http://127.0.0.1:5184`

Required checks:

| Path | Result |
| --- | --- |
| `/data/media/recipes/gheymeh-sibzamini/cover.webp` | HTTP 200, `image/webp`, 265790 bytes |
| `/data/media/recipes/gamaj-kabab/cover.webp` | HTTP 200, `image/webp`, 311466 bytes |

Random sample checks also returned HTTP 200 with `image/webp`:

- `/data/media/recipes/omelet-gojeh-farangi/cover.webp`
- `/data/media/recipes/kalleh-gonjeshki/cover.webp`
- `/data/media/recipes/indonesian-salad/cover.webp`
- `/data/media/recipes/akbar-joojeh/cover.webp`
- `/data/media/recipes/shir-berenj/cover.webp`
- `/data/media/recipes/reshteh-polo-shirazi/cover.webp`
- `/data/media/recipes/fereni/cover.webp`
- `/data/media/recipes/anar-polo-shirazi/cover.webp`
- `/data/media/recipes/burger-sauce/cover.webp`
- `/data/media/recipes/kashk-bademjan/cover.webp`

## API Contract Comparison

Local/dev API endpoint checked:

```text
GET http://localhost:3004/recipes?page=1&limit=1000
```

Results:

- API total recipes: 639
- fetched recipes: 639
- recipes with `imageUrl`: 569
- copied media files referenced by API: 134
- extra copied media folders not referenced by API: 0
- missing API image files: 435

Missing image samples:

| Recipe | imageUrl |
| --- | --- |
| `پلوف ازبکی` | `data/media/recipes/uzbek-plov-osh/cover.webp` |
| `پودینگ تافی خرما` | `/data/media/recipes/sticky-toffee-pudding/cover.webp` |
| `سالاد ذرت و لوبیا` | `/data/media/recipes/corn-and-bean-salad/cover.webp` |
| `کاسوله فرانسوی` | `data/media/recipes/french-cassoulet/cover.webp` |
| `روشتی سوئیسی` | `/data/media/recipes/rosti/cover.webp` |
| `چلو کباب کوبیده` | `/data/media/recipes/chelo-kabab-koobideh/cover.webp` |
| `دمپختک (ماش‌پلو تهرانی)` | `/data/media/recipes/dampokhtak-mash-polo/cover.webp` |
| `سیرنیکی` | `/data/media/recipes/syrniki/cover.webp` |
| `آسادوی آرژانتینی با چیمی‌چوری` | `data/media/recipes/argentinian-asado-with-chimichurri/cover.webp` |
| `اسپاگتی کاربونارای رومی` | `data/media/recipes/roman-spaghetti-carbonara/cover.webp` |
| `روپا ویه‌خای کوبایی` | `data/media/recipes/cuban-ropa-vieja/cover.webp` |
| `فته` | `/data/media/recipes/fatteh/cover.webp` |
| `کیمچی کلم چینی` | `data/media/recipes/napa-cabbage-kimchi/cover.webp` |
| `ماست با خیار و گردو (دیپ)` | `/data/media/recipes/cucumber-walnut-yogurt-dip/cover.webp` |
| `موز با عسل و گردو` | `/data/media/recipes/banana-with-honey-and-walnuts/cover.webp` |
| `نیکوجاگا` | `/data/media/recipes/nikujaga/cover.webp` |
| `کراکر با پنیر خامه‌ای و مربا فلفل` | `/data/media/recipes/crackers-with-cream-cheese-and-pepper-jelly/cover.webp` |
| `کشک و گردو با نان (دیپ سرد)` | `/data/media/recipes/cold-kashk-and-walnut-dip-with-bread/cover.webp` |
| `کورنیش پستی` | `/data/media/recipes/cornish-pasty/cover.webp` |
| `املت قهوه‌خانه‌ای` | `/data/media/recipes/omelet-ghahvekhaneh/cover.webp` |

## Build Results

- `pnpm install --frozen-lockfile`: PASS
- `pnpm --dir apps/web build`: PASS
- `pnpm --dir apps/server build`: PASS

## Test Results

- `pnpm --dir apps/web exec vitest run src/components/auth/AuthForm.test.jsx`: PASS, 10 tests
- `pnpm --dir apps/web exec vitest run src/app/recipes/recipes.smoke.test.jsx src/components/ges/RecipeCard.dismiss.test.jsx`: PASS, 9 tests

## Authenticated Visual Smoke

Local/dev only:

- Backend: `http://localhost:3004`
- Web: `http://127.0.0.1:5184`
- Auth: OTP dev-log flow with `SMS_PROVIDER=disabled` and `SMS_DEV_LOG_OTP=true`
- Viewport: 390px mobile

### `/recipes`

- reachable after login: yes
- first page rendered: yes
- pagination rendered: yes, `صفحهٔ ۱ از ۲۶`
- horizontal overflow: no
- `gheymeh-sibzamini` card: real image rendered, `1448x1086`, not fallback
- `gamaj-kabab` card: real image rendered, `1448x1086`, not fallback
- several other copied first-page covers rendered real images
- recipes whose image files are still missing continue to show unresolved/broken image attempts before fallback behavior completes

### Detail

Route checked:

```text
/recipe/garnish_recipe_fa_2054_be491f02
```

- detail hero real image rendered: yes
- hero image source: `/data/media/recipes/gheymeh-sibzamini/cover.webp`
- rendered image dimensions: `1448x1086`
- hero displayed at mobile viewport width without horizontal overflow
- `مواد لازم`: present
- `شروع پخت`: present
- raw/debug/internal text: not observed

### Home Rails

- home content rendered after data load: yes
- `پیشنهادهای بیشتر`: present
- `محبوب‌ها`: present
- remaining issue: some home rail cards still did not render real images even when equivalent media exists elsewhere. This appears to be a home/recommendation payload or mapper issue, not a missing-file issue from this media pack.

## Console / Runtime

- Browser console errors/warnings during final visual check: none observed
- No route crash observed
- No production endpoint touched

## Real Image Rendering Result

Partial pass.

Real images now render for processed assets present in this branch, including the required `gheymeh-sibzamini` and `gamaj-kabab` checks. The full product-level media contract still fails because 435 API image URLs have no static file in this pack.

## Fallback Behavior Result

Fallback remains necessary for the many recipes whose API image paths still have no committed media file. The fallback does not collapse the layout in the checked surfaces, but the app is not yet visually complete.

## Production Untouched Confirmation

- No production deploy
- No production DB mutation
- No migration
- No recipe/ingredient data change
- No auth/admin/home/settings change
- No code change
- No raw media commit
- No master push

## Recommendation

Do not call the full recipe media contract launch-ready yet.

Recommended next step:

1. Review and merge this branch only as a safe partial processed-media pack if the 28.81 MB repo increase is acceptable.
2. Create a second media completion pack for the remaining 435 API `imageUrl` paths, or remove/disable `imageUrl` values that cannot be backed by static/CDN assets before launch.
3. Add a CI/media contract check: every public recipe `imageUrl` must resolve to a committed public file or durable CDN URL.
4. Re-run authenticated Recipe UX visual smoke after the remaining paths are resolved.
