# Garnish Authoring & Verification Reference (v1, 2026-06-20)

> The quality backbone for the recipe-enrichment program. Authoring agents read this to get it right;
> verification agents use it as a pass/fail gate. Sourced from authoritative references (USDA FSIS,
> FDA, McGee, López-Alt/Serious Eats, ATK, Cook's Thesaurus, King Arthur, Modernist Cuisine) plus a
> 2024–2026 survey of the best recipe apps. **Every rule here is defensible — do not soften it.**

---

## 1. Substitution validity (fixes the «سیب‌زمینی→سیب‌زمینی شیرین» / «گوشت→nothing» bug)

A swap is **valid** only if it covers the ingredient's **functional role in THIS dish**. Four tests, in order:
1. **Functional-role match** (protein / fat / acid / binder / leavening / structure / aromatic / bulk / color). Same job, or it's irrelevant.
2. **Flavor proximity** — within the right role, pick the closest intensity (beef for lamb > turkey).
3. **Ratio adjustment** — state the quantity change (honey for sugar = ~¾ + cut liquid; dried herb = ⅓ of fresh; tomato paste for fresh = far less).
4. **Dish context overrides generic lists** — the best swap is dish-specific.
5. **Honesty when none exists** — saffron has NO real substitute (unique aroma, not just color). Never suggest fake color/turmeric "as saffron". Say `swaps: []` + a note.

**Authoritative swap table (use these; never invent unjustified swaps):**

| Ingredient | Valid swaps | Dish note |
|---|---|---|
| Lamb / beef / veal (red-meat protein) | each other · goat · ground version · **mushroom** (veg, +umami/fat) | standard in khoresh; never empty |
| Ground meat | ground beef↔lamb↔turkey/chicken · **lentils** (veg) | poultry/lentil drier — add fat/moisture |
| Chicken / turkey | each other · firm tofu/seitan (veg) | turkey drier, adjust time |
| **Potato in gheymeh (قیمه)** | **eggplant (fried) → قیمه بادمجانی** · carrot | eggplant is the canonical variant — NOT another potato |
| Eggplant | zucchini · mushroom · potato | salt eggplant to debitter |
| **Yellow split peas (لپه)** | **chana dal (closest)** · green split peas · toor dal | red lentils are WRONG where shape matters (turn mushy) |
| Onion | shallot · leek · scallion (raw) · onion powder | foundational — rarely omit |
| Tomato paste (رب) | reduced passata/purée (more) · cooked-down fresh tomato | purée thinner, reduce longer |
| **Saffron** | **none truly** (last resort: tiny turmeric for HUE only) | never fake the flavor |
| Turmeric | mild curry powder (small) · pinch saffron+cumin (color) | not 1:1 |
| Dried lime (لیمو عمانی) | fresh lime/lemon juice+zest · tamarind · sumac | fresh lacks fermented depth |
| Barberries (زرشک) | dried cranberries (chopped, less sugar) · sour cherries · currants+lemon | cranberries sweeter |
| Basmati rice | jasmine · aged long-grain | avoid short-grain (no Persian *dane*) |
| Butter | **ghee/roghan (traditional)** · oil (fat only) | oil lacks dairy flavor/browning |
| Vegetable oil | canola/sunflower/grapeseed · ghee · light olive oil | olive oil adds flavor, lower smoke point |
| Yogurt | sour cream · labneh · buttermilk (thinner) · coconut yogurt (veg) | adjust liquid |
| Fenugreek (شنبلیله, in ghormeh sabzi) | dried fenugreek at **⅓** of fresh | do NOT drop it — defines the dish |
| Egg — **binder** | flax/chia egg (1 Tbsp + 3 Tbsp water) · breadcrumbs+liquid · mashed potato | vegan binders set softer |
| Egg — **leavening** | whipped aquafaba · extra baking powder+liquid | not for custards |
| Egg — **structure/set** | hard to replace (extra yolk / silken tofu savory) | be honest — limited |
| All-purpose flour | bread flour (chewier) · 1:1 GF blend (needs binder) · whole wheat (¾) | protein differs |
| Sugar | honey/maple (¾, cut liquid) · brown sugar (1:1, moister) · date syrup | changes moisture/browning |
| Milk | oat milk (closest for baking) · evaporated+water · cream+water | non-dairy lacks fat |
| Walnuts (fesenjan) | pecans (closest) · hazelnuts · almonds | walnuts give body+oil — pecans nearest |

---

## 2. Food-safety thresholds (HARD pass/fail gate — USDA FSIS primary)

USDA prints: **145°F = 62.8°C · 160°F = 71.1°C · 165°F = 73.9°C**.

| Food | Safe minimum internal temp | Note |
|---|---|---|
| **Poultry** (all, incl. ground) | **74°C / 165°F** | no rare option |
| **Ground meats** (beef/lamb/pork/veal) | **71°C / 160°F** | no rare option |
| **Whole cuts** beef/veal/lamb | **63°C / 145°F + 3 min rest** | rare/med-rare = preference, BELOW safe min, intact cuts only |
| **Pork** chops/roasts | **63°C / 145°F + 3 min rest** | |
| **Fish** | **63°C / 145°F** or opaque + flakes | |
| **Egg dishes** (quiche/frittata) | **71°C / 160°F** | shell eggs: cook until firm |
| **Leftovers / casseroles** | **74°C / 165°F** | reheat soups to a rolling boil |

- **Danger zone 4–60°C (40–140°F); max 2 h total (1 h if >32°C).** Hot-hold ≥60°C, fridge ≤4°C.
- **Fridge storage (safety):** cooked meat/stew/soup **3–4 days**; cooked rice 3–4 days (ideally 1). Freezer = quality only.
- **NEVER author these (auto-fail):** raw meat at room temp "to come to temperature" for hours; washing/rinsing raw poultry; partial-cook-then-finish-later; leaving cooked rice at room temp (Bacillus cereus, heat-stable toxin); rare ground meat/poultry/pork; slow-cooling big pots overnight; counter-thawing; color-only doneness for poultry/ground; reheating rice/leftovers more than once.
- **EU note:** 70°C/2-min (held) family is acceptable ONLY when a hold time is specified; otherwise default to USDA instant targets.

---

## 3. Food-science verification («whyItWorks» gate — McGee / López-Alt / ATK / Modernist)

**Sound mechanisms (use the right one + right temp/condition):** Maillard (dry surface, ~140–165°C+); caramelization (sugar alone, ~160–185°C); starch gelatinization (~60–80°C — sauces set near a simmer, not a hard boil); protein denaturation/coagulation (egg white ~60–65°C, yolk ~65–70°C; muscle ~50–70°C); collagen→gelatin (braising, slow at 80–95°C moist); emulsification (lecithin/mustard/protein disperses droplets); dry brining (osmosis + protein denaturation, hours); evaporation/surface-drying enables browning; gluten development; **fat as flavor carrier** (lycopene/saffron/capsaicin are fat-soluble — bloom in fat, not water); enzymatic browning (acid/cold/blanch slows it); marination is shallow (surface mm only).

**Debunked myths — flag/reject if asserted:** "searing seals in juices" (it's flavor, not a moisture seal); "salt makes water boil meaningfully faster"; "alcohol fully cooks off" (4–85% remains); "bring meat to room temp before cooking" (changes core by ~2°, enters danger zone); "rinse pasta" (removes sauce-clinging starch); "cold water boils faster"; "bone-in cooks faster" (bone insulates); "acid marinade deeply tenderizes the whole cut" (shallow, mushes surface); "oil in pasta water stops sticking".

**Rubric — a claim is SOUND when it:** names a real mechanism (not "locks in"/"seals"/"opens pores"); gets temperature direction + condition right; separates flavor (browning) from juiciness (final internal temp + salt); matches McGee/López-Alt/ATK consensus and survives the myth list. **REJECT** sealing/pore/lock-in metaphors, mechanism-without-temperature, Maillard/caramelization conflation, deep-marinade claims.

---

## 4. World-class app gaps (informs authoring richness + the later page rebuild)

Our CONTENT depth already exceeds NYT/BBC/ATK; the gaps are the **interaction layer** (mostly built this session or queued for the page rebuild). Authoring-relevant takeaways:
- **Unit toggle (metric/US, volume↔weight)** is high-value and nearly free — BUT only if the data is clean: `weightG` = grams (number), `volume` = a true household measure (پیمانه/عدد/قاشق), **never a restatement of grams** («۴۵۰g · 450 گرم» is a data bug). Author both, distinctly.
- **Mise-en-place grouping** by `component` (sauce/marinade/garnish) is a chef-credibility signal — author meaningful `component` values + a per-step `mise` where useful.
- **Per-step structured timers** — `durationMin` must be a clean number (already used by Cook Mode).
- **Per-step ingredient refs** (`usesIngredientIds`) enable exact remove/swap cascade — author them.
- **Reference image at CRITICAL steps only** (doneness decision points) — note `mediaHint` where a photo would most help (photography deferred, but mark the spot).
- Skip: AI food-photo generation (authenticity), smart-appliance sync (defer).
