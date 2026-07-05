# Batch 01 Iranian Recipe Trust Final Report

- generatedAt: 2026-07-04T18:24:40Z
- production touched: no
- local/dev DB guard: PASS
- total recipe count: 639 -> 639
- active/public count: 504 -> 521
- draft/private/review count: 135 -> 118
- ingredient count: 1084 -> 1084
- restored public as-is: 17
- patched and restored: 0
- renamed/reframed and restored: 0
- still reviewOnly: 3
- public unresolved blockers in batch: 0
- deleted recipes: 0
- new ingredients: 0
- Meze public: 0
- Gamaj Kabab regression: PASS
- Qeymeh Rizeh Esfahani regression: PASS
- AI residue CRITICAL/HIGH: 0/0
- server build: PASS (`apps/server/node_modules/.bin/nest.CMD build`)
- API/search smoke: PASS
- forbidden Recipe/Ingredient create/upsert/delete scan: PASS

## Restored Public

| # | Recipe | Slug | Final State |
|---:|---|---|---|
| 1 | آبگوشت قنبید قم | abgoosht-ghanbid | RESTORE_PUBLIC_AS_IS |
| 2 | آبگوشت متنجنه کرمانی | abgoosht-matanjaneh-kermani | RESTORE_PUBLIC_AS_IS |
| 3 | آبگوشت کشک | abgoosht-kashk | RESTORE_PUBLIC_AS_IS |
| 4 | آش انار | ash-e-anar | RESTORE_PUBLIC_AS_IS |
| 5 | آش جو | ash-e-jo | RESTORE_PUBLIC_AS_IS |
| 6 | آش دوغ اردبیلی | ash-doogh | RESTORE_PUBLIC_AS_IS |
| 7 | آش شله قلمکار | ash-sholeh-ghalamkar | RESTORE_PUBLIC_AS_IS |
| 8 | آلبالو پلو با مرغ یا گوشت | albaloo-polo-ba-morgh | RESTORE_PUBLIC_AS_IS |
| 9 | انارپلو شیرازی | anar-polo-shirazi | RESTORE_PUBLIC_AS_IS |
| 10 | باقالی پلو با گوشت | baghali-polo-ba-goosht | RESTORE_PUBLIC_AS_IS |
| 11 | بزقرمه کرمانی | boz-ghormeh-kermani | RESTORE_PUBLIC_AS_IS |
| 12 | تاس‌کباب | tas-kabab | RESTORE_PUBLIC_AS_IS |
| 13 | جوجه کباب زعفرانی | saffron-joojeh-kabab | RESTORE_PUBLIC_AS_IS |
| 14 | خورش آلو | khoresh-aloo | RESTORE_PUBLIC_AS_IS |
| 15 | خورش مرغ قیسی | khoresh-morgh-qeysi | RESTORE_PUBLIC_AS_IS |
| 16 | خورشت بادمجان | khoresh-bademjan | RESTORE_PUBLIC_AS_IS |
| 17 | خورشت ریواس | khoresh-rivas | RESTORE_PUBLIC_AS_IS |

## Still ReviewOnly

| # | Recipe | Slug | Exact Blocker |
|---:|---|---|---|
| 1 | آش دندونی | ash-dandooni | طبق baseline باید ترکیب چندغله/چندحبوبه شامل گندم، جو، برنج، نخود، لوبیا و عدس داشته باشد؛ DB نشانه برنج را پاس نکرد. |
| 2 | آش سبزی شیرازی | ash-sabzi-shirazi | طبق baseline باید گوشت، برنج، حبوبات، تره و ترخون داشته باشد؛ DB نشانه گوشت و ترخون را پاس نکرد. |
| 3 | خورشت هویج تبریزی | khoresh-havij-tabrizi | طبق baseline باید هویج، گوشت/مرغ، آلو، زعفران و هویت ملس تبریزی داشته باشد؛ DB نشانه زعفران را پاس نکرد. |

## Notes

- No content patch was applied in this pass. The 17 restored recipes already matched the user-provided Batch 01 baseline according to the DB/GRIS/step/search scan.
- The 3 unresolved recipes remain reviewOnly, so no unresolved Batch 01 recipe is public.
- Rollback snapshot is available in `batch01_rollback.json`.

Final verdict: PASS.
