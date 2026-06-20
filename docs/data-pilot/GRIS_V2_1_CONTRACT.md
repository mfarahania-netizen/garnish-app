# GRIS v2.1 — Authoring Contract (machine-checkable)

> The exact object every authored recipe must produce. v2.1 = GRIS v2 + the root fixes for the
> founder's 70/100 review: **structured dish-aware swaps**, **per-step ingredient refs** (so remove/swap
> cascade exactly), and **clean user-facing fields** (no authoring-metadata leak, volume ≠ a gram
> restatement). Read `AUTHORING_REFERENCE.md` for the substitution / food-safety / food-science gates.
>
> Stored additively in `Recipe.gris` (JSONB). The allergy hard-filter + `getLivingUserProfile` are NEVER
> touched. Consumers prefer the explicit `ingredientId` field, falling back to a legacy «— ing_xxx» name suffix.

## The four non-negotiable constraints (a section violating any is REJECTED)
- **(الف) id-grounding** — every ingredient maps to a REAL id in the dictionary (`ingredient_id_registry`). No invented ids. Unknown ingredient → flag `MISSING_INGREDIENT`, don't publish.
- **(ب) no fabricated nutrition** — numbers ONLY from the source-locked engine (USDA `fdcId`). Unlocked ingredient → it doesn't contribute + the recipe is flagged "incomplete coverage". Never a guessed kcal/macro.
- **(ج) non-medical health** — no self-made grade (A–E / "health score"). Attribute badges only from inspectable numeric thresholds, with the fixed non-medical disclaimer.
- **(د) real food science** — every `whyItWorks` bullet a real mechanism (Reference §3); no debunked myth.

## Object shape

```jsonc
{
  "schemaVersion": "2.1",
  "story":  { "hook": "...", "origin": "...", "occasion": "...", "lineage": "family|chef|documented tradition (cautious on disputed regional claims)" },
  "whyItWorks": [ { "point": "short claim", "explanation": "real mechanism + temp/condition", "testedBecause": "optional source" } ],   // 3–5, Reference §3
  "glance": {
    "promise": "one vivid sentence of the result",
    "activeTimeMin": 0, "totalTimeMin": 0, "handsOffMin": 0,
    "difficulty": "آسان|متوسط|سخت", "costBand": "کم|متوسط|زیاد", "servings": 0,
    "keyEquipment": ["..."], "equipmentIdeal": ["pan X — even heat (reason)"], "goodFor": ["..."]
  },
  "skillsLearned": ["concrete skill", "..."],
  "ingredients": [ {
    "ingredientId": "ing_lamb_meat_raw",         // REAL id (constraint الف). Required.
    "name": "گوشت گوسفند",                          // CLEAN human name — NO «— ing_xxx», NO parenthetical metadata
    "component": "خورش",                           // mise-en-place group (sauce/marinade/garnish/…)
    "role": "پروتئین اصلی",                         // functional role (drives swap validity)
    "weightG": 450,                                // grams, number (drives nutrition + scaling). null if truly n/a (e.g. salt «به‌مزه»)
    "volume": "حدود ۲ پیمانه خرد‌شده",              // household measure — NEVER a restatement of weightG («۴۵۰g · 450 گرم» is a BUG)
    "prepState": "خردشده به قطعات کوچک",            // clean prep note, no metadata
    "buyTip": "...",
    "swaps": [                                     // STRUCTURED, dish-aware, grounded (Reference §1). [] when none truly exist (saffron).
      { "ingredientId": "ing_veal_meat_raw", "name": "گوشت گوساله", "note": "هم‌نقش؛ زمان پخت کمی بیشتر", "ratio": "۱:۱" },
      { "ingredientId": "ing_beef_meat_raw", "name": "گوشت گاو", "note": "کمی کم‌چرب‌تر", "ratio": "۱:۱" }
    ],
    "swap": "گوشت گوساله یا گوشت گاو (هم‌نقش پروتئینی)",   // back-compat one-line display; derived from swaps[]
    "optional": false,                             // true → safe to remove without breaking the dish
    "criticalRole": false                          // true → removing it breaks the recipe (binder/leavener/structure); warn + require a swap
  } ],
  "steps": [ {
    "order": 1, "title": "نیم‌پز کردن لپه",
    "instruction": "...beginner-grade, references ingredients by the SAME short name used in `name`...",
    "usesIngredientIds": ["ing_yellow_split_peas_dry"],   // exact refs → exact remove/swap cascade
    "flame": "none|low|medium|medium-high|high",
    "tempC": 0,                                    // number when a target temp applies (Reference §2 food-safety hard gate); else omit
    "durationMin": 15,                             // clean number (Cook-Mode timer). 0/omit if not timed
    "sees": "visual/sensory cue at this step",
    "doneness": "how you know it's done (Reference §2 for safety temps)",
    "tip": "optional", "recovery": "rescue if it goes wrong",
    "mediaHint": "optional: 'critical doneness shot here'"
  } ],
  "finish": { "finalLook": "vivid description replacing the photo", "plating": "...", "chefSecret": "1–2 load-bearing moves backed by whyItWorks" },
  "troubleshooting": [ { "problem": "...", "fix": "...", "stepRef": 3 } ],
  "variations":     [ { "name": "قیمه بادمجانی", "how": "...", "swapsIngredientIds": ["ing_potato_raw→ing_eggplant_raw"] } ],
  "keep":  { "makeAhead": "...", "storage": "fridge N days (Reference §2)", "reheat": "...", "freeze": "... or 'مناسب فریز نیست'" },
  "serveWith": ["چلو", "سبزی خوردن"],              // CLEAN text, no embedded ids
  "nourishment": { "attributes": ["پُرپروتئین"], "note": "...", "disclaimer": "این اطلاعات عمومی و آشپزی است، نه توصیهٔ پزشکی." },
  "faq": [ { "q": "...", "a": "..." } ],
  "dietary": { "vegetarian": false, "vegan": false, "glutenFree": true, "dairyFree": true, "containsPork": false, "freezable": true },
  "allergens": ["..."]                             // DERIVED from ingredient ids (constraint الف) — never hand-typed
}
```
> ALLERGENS — use the dictionary's CANONICAL tokens, derived as the union of each ingredient id's
> allergen arrays (`us9 ∪ eu14 ∪ other` in ingredients.json). A wheat-bearing ingredient yields BOTH
> «wheat» (us9) and «gluten_cereals» (eu14) — list every token the ids carry; do NOT collapse them to a
> single «gluten» or omit «wheat». (This was the only thing that failed 2/24 in batch-02.)
```jsonc
// (end of object)
```

## Hard authoring rules (the verification gate checks every one)
1. **Clean display fields.** `name`, `volume`, `prepState`, `serveWith`, `swap`, `finish.*`, `variations.*` contain ZERO: `ing_xxx` tokens · «اصلاح…منبع…» notes · raw English ids · the gram weight restated as volume.
2. **`volume` ≠ grams.** `weightG` is the number; `volume` is پیمانه/عدد/قاشق/تکه. If the only honest measure is grams, set `volume:""` (the UI shows `Ng`).
3. **Swaps are dish-aware + grounded + honest.** Each `swaps[]` entry is a REAL id, same functional role, valid for THIS dish (Reference §1). `[]` when none (saffron) — do not pad with category peers. Gheymeh potato → `ing_eggplant_raw`, NOT another potato.
4. **Steps reference ingredients by the matchable short name** that appears in `ingredients[].name`, and list `usesIngredientIds` — so removing/swapping cascades exactly.
5. **Food safety is a HARD gate.** Any `tempC`/doneness for poultry/ground/pork/eggs/leftovers must meet Reference §2 minimums. No §2 unsafe practice may appear in any step.
6. **Nutrition coverage:** list which `ingredientId`s are NOT source-locked; the recipe self-reports coverage. Never invent a number.
7. **Persian quality:** natural, correct Persian; fix transliteration glitches; beginner-grade steps (for someone who's never cooked) — every cue concrete (flame level, exact time, what to see/hear/smell).
8. **`criticalRole`/`optional`** set honestly so remove-warnings are accurate (egg-as-binder = critical; garnish parsley = optional).

## Output for the apply pipeline
Each authored recipe returns: `{ recipeId, gris: <object above>, ingredientSubsEnrichment: [ {ingredientId, substitutionOptions:[{replaceWithIngredientId, name, reason, note}]} ], coverage: {locked, total, missingIds[]}, selfScore }`.
The `ingredientSubsEnrichment` updates the dictionary's `Ingredient.substitutionOptions` so the LIVE «جایگزین؟» button also returns dish-grade swaps (fixes the founder's complaint at the source).
