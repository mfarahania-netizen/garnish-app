# Batch 01 Fix3 + Batch 02 Audit Before Apply

- generatedAt: 2026-07-04T19:40:51.448Z
- Scope A restore-ready before patch: 0
- Scope A needs patch/review: 3
- Scope B restore-ready as-is: 18
- Scope B keep reviewOnly: 2
- Gamaj Kabab regression: PASS
- Qeymeh Rizeh regression: PASS

| # | Scope | State | Title | Slug | Blocker |
|---:|---|---|---|---|---|
| 1 | A | KEEP_REVIEWONLY_WITH_EXACT_REASON | آش دندونی | ash-dandooni | آش دندونی باید مخلوط غله و حبوبات شامل گندم، جو، برنج، نخود، لوبیا، عدس و پیاز داشته باشد. Missing signals: rice / برنج |
| 2 | A | KEEP_REVIEWONLY_WITH_EXACT_REASON | آش سبزی شیرازی | ash-sabzi-shirazi | آش سبزی شیرازی باید گوشت، برنج، حبوبات، تره، ترخون و پیاز داشته باشد. Missing signals: lamb / meat / گوشت ; rice / برنج ; tarragon / ترخون |
| 3 | A | KEEP_REVIEWONLY_WITH_EXACT_REASON | خورشت هویج تبریزی | khoresh-havij-tabrizi | خورشت هویج تبریزی باید هویج، گوشت/مرغ، آلو، زعفران، پیاز، رب گوجه و تعادل ملس داشته باشد. Missing signals: saffron / زعفران |
| 4 | B | RESTORE_PUBLIC_AS_IS | دمپختک (ماش‌پلو تهرانی) | dampokhtak-mash-polo | - |
| 5 | B | RESTORE_PUBLIC_AS_IS | رشته‌پلو شیرازی | reshteh-polo-shirazi | - |
| 6 | B | RESTORE_PUBLIC_AS_IS | زیره‌پلو کرمانی | zireh-polo-kermani | - |
| 7 | B | RESTORE_PUBLIC_AS_IS | شامی کباب لرستانی | shami-kabab-lorestan | - |
| 8 | B | RESTORE_PUBLIC_AS_IS | شله مشهدی | sholeh-mashhadi | - |
| 9 | B | RESTORE_PUBLIC_AS_IS | شیرین‌پلو (مرصع‌پلو) | shirin-polo | - |
| 10 | B | RESTORE_PUBLIC_AS_IS | عدس‌پلو با گوشت | adas-polo-ba-goosht | - |
| 11 | B | KEEP_REVIEWONLY_WITH_EXACT_REASON | قنبرپلو شیرازی | ghanbar-polo-shirazi | قنبرپلو باید گوشت قلقلی/چرخ‌کرده، گردو، کشمش، رب انار و هویت شیرازی داشته باشد. Missing signals: walnut / گردو ; pomegranate_paste / رب انار |
| 12 | B | RESTORE_PUBLIC_AS_IS | قیمه نثار | gheymeh-nesar | - |
| 13 | B | RESTORE_PUBLIC_AS_IS | لوبیا پلو با گوشت چرخ‌کرده | loobia-polo-ba-goosht | - |
| 14 | B | RESTORE_PUBLIC_AS_IS | مرغ ترش گیلانی | morgh-torsh-gilani | - |
| 15 | B | RESTORE_PUBLIC_AS_IS | کباب بناب | kabab-bonab | - |
| 16 | B | RESTORE_PUBLIC_AS_IS | کباب تابه‌ای مرغ | kabab-tabei-morgh | - |
| 17 | B | RESTORE_PUBLIC_AS_IS | کباب تابه‌ای گوشت | kabab-tabei-goosht | - |
| 18 | B | RESTORE_PUBLIC_AS_IS | کدو پلو مازندرانی | kadoo-polo-mazandarani | - |
| 19 | B | RESTORE_PUBLIC_AS_IS | کوفته برنجی | kufteh-berenji | - |
| 20 | B | RESTORE_PUBLIC_AS_IS | میرزا قاسمی | mirza-ghasemi | - |
| 21 | B | KEEP_REVIEWONLY_WITH_EXACT_REASON | واویشکا | vavishka | واویشکا باید variant روشن گوشت/گوجه/پیاز و هویت شمالی داشته باشد. Missing signals: egg / تخم |
| 22 | B | RESTORE_PUBLIC_AS_IS | کته شمالی | kateh-shomali | - |
| 23 | B | RESTORE_PUBLIC_AS_IS | کاله‌جوش (کله‌جوش) | kaleh-joosh | - |
