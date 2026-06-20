export const meta = {
  name: 'gris-author-batch',
  description: 'Author a batch of recipes to GRIS v2.1 + adversarially verify (5 lenses) + fix + gate',
  phases: [
    { title: 'Author', detail: 'rewrite each recipe to GRIS v2.1 (grounded, clean, dish-aware swaps)' },
    { title: 'Verify', detail: '5 adversarial lenses per recipe: grounding · safety · science · swaps · cleanliness' },
    { title: 'Fix', detail: 'revise any recipe with a major issue, then re-verify' },
  ],
}

const BATCH = (args && args.batch) || 'batch-03'
const recipes = (args && Array.isArray(args.recipes) && args.recipes.length) ? args.recipes : [
  { recipeId: "garnish_recipe_fa_197_dbaa9b9a", title: "چلو ماهیچه" },
  { recipeId: "garnish_recipe_fa_868_c97331a5", title: "استانبولی پلو بدون گوشت" },
  { recipeId: "garnish_recipe_fa_1053_29566b67", title: "خورشت بامیه" },
  { recipeId: "garnish_recipe_fa_1195_4b547f19", title: "ماکارونی" },
  { recipeId: "garnish_recipe_fa_1207_5b8c823a", title: "شیشلیک (کباب دنده)" },
  { recipeId: "garnish_recipe_fa_1209_7bd0ff68", title: "کباب بختیاری" },
  { recipeId: "garnish_recipe_fa_1270_70cc3cff", title: "یتیمچه" },
  { recipeId: "garnish_recipe_fa_1767_4e6ed616", title: "شامی کباب لرستانی" },
  { recipeId: "garnish_recipe_fa_2064_b5a2a37a", title: "پاستا پستو" },
  { recipeId: "garnish_recipe_fa_98_601bddc6", title: "خورشت هویج تبریزی" },
  { recipeId: "garnish_recipe_fa_119_2a846a21", title: "آش شولی یزدی" },
  { recipeId: "garnish_recipe_fa_129_5d8a7866", title: "قنبرپلو شیرازی" },
  { recipeId: "garnish_recipe_fa_164_8367ec24", title: "ته‌چین گوشت و بادمجان" },
  { recipeId: "garnish_recipe_fa_170_44f0d2ad", title: "قیمه‌ریزه اصفهانی" },
  { recipeId: "garnish_recipe_fa_190_49162ac2", title: "خورش مرغ قیسی" },
  { recipeId: "garnish_recipe_fa_95_0962d2a9", title: "آبگوشت قنبید" },
  { recipeId: "garnish_recipe_fa_101_877a41d3", title: "خورش آلو" },
  { recipeId: "garnish_recipe_fa_1052_8bde566e", title: "خورشت آلو اسفناج" },
  { recipeId: "garnish_recipe_fa_1071_6e0696a6", title: "کتلت گوشت" },
  { recipeId: "garnish_recipe_fa_1072_b55bdfe7", title: "اشکنه" },
  { recipeId: "garnish_recipe_fa_1077_1b3eec19", title: "خوراک لوبیا چیتی" },
  { recipeId: "garnish_recipe_fa_1197_73204fa8", title: "کباب تابه‌ای مرغ" },
  { recipeId: "garnish_recipe_fa_1215_673014ad", title: "کباب چنجه" },
  { recipeId: "garnish_recipe_fa_1224_c65df148", title: "باقلاقاتُق" },
  { recipeId: "garnish_recipe_fa_1225_159208a2", title: "میرزا قاسمی" },
  { recipeId: "garnish_recipe_fa_1325_87da9b04", title: "املت گوجه فرنگی" },
  { recipeId: "garnish_recipe_fa_1482_782462e9", title: "شله زرد" },
  { recipeId: "garnish_recipe_fa_1491_0553f941", title: "شیر برنج" },
  { recipeId: "garnish_recipe_fa_1492_08a81971", title: "فرنی" },
  { recipeId: "garnish_recipe_fa_1548_dc89130d", title: "خاگینه" },
  { recipeId: "garnish_recipe_fa_1761_4f9171a7", title: "سالاد رنگینک" },
  { recipeId: "garnish_recipe_fa_2028_1932b5ee", title: "سس فلافل" },
  { recipeId: "garnish_recipe_fa_2035_e1080e79", title: "سس مارینارا" },
  { recipeId: "garnish_recipe_fa_89_292dde1d", title: "اکبر جوجه" },
  { recipeId: "garnish_recipe_fa_133_139b05e2", title: "کوکو سیب‌زمینی" },
  { recipeId: "garnish_recipe_fa_179_9cb4bccf", title: "زولبیا و بامیه" },
  { recipeId: "garnish_recipe_fa_99_14f1018b", title: "خورشت ریواس" },
  { recipeId: "garnish_recipe_fa_103_066b318c", title: "واویشکا" },
  { recipeId: "garnish_recipe_fa_104_7b4ced78", title: "گمج کباب" },
  { recipeId: "garnish_recipe_fa_112_9764d4aa", title: "کدو پلو مازندرانی" },
]
const DIR = `docs/data-pilot/_authored/${BATCH}`
const REFS = 'Read docs/data-pilot/GRIS_V2_1_CONTRACT.md (exact shape + hard rules) and docs/data-pilot/AUTHORING_REFERENCE.md (substitution §1 · food-safety §2 HARD · food-science+myths §3). Ground ids by grepping docs/data-pilot/_grounding/ingredients.json (match the Persian name in the "fa" field). NEVER invent an id.'

const AUTHOR_SCHEMA = { type: 'object', additionalProperties: false, properties: {
  recipeId: { type: 'string' }, path: { type: 'string' },
  coverageLocked: { type: 'number' }, coverageTotal: { type: 'number' },
  selfScore: { type: 'number' }, notes: { type: 'string' },
}, required: ['recipeId', 'path', 'selfScore'] }

const VERIFY_SCHEMA = { type: 'object', additionalProperties: false, properties: {
  lens: { type: 'string' }, pass: { type: 'boolean' },
  severity: { type: 'string', enum: ['ok', 'minor', 'major'] },
  issues: { type: 'array', items: { type: 'string' } },
}, required: ['lens', 'pass', 'severity'] }

const FIX_SCHEMA = { type: 'object', additionalProperties: false, properties: {
  recipeId: { type: 'string' }, fixed: { type: 'boolean' }, addressed: { type: 'array', items: { type: 'string' } },
}, required: ['fixed'] }

const LENSES = [
  { key: 'grounding', name: 'گراندینگ و ایمنیِ داده', checks: 'EVERY ingredientId (recipe ingredients, every swaps[].ingredientId, every step usesIngredientIds, ingredientSubsEnrichment) must EXIST in ingredients.json — grep each id. allergens must be DERIVED from the ingredient ids (not hand-invented). NO fabricated nutrition (only source-locked ingredients may contribute; "locked":true in ingredients.json). coverage.missingIds honest.' },
  { key: 'safety', name: 'ایمنیِ غذایی', checks: 'every tempC + doneness meets AUTHORING_REFERENCE §2 minimums: poultry 74°C/165°F, ground meats 71°C/160°F, whole cuts beef/lamb/veal 63°C/145°F + 3min rest, fish 63°C, egg dishes 71°C, leftovers/casseroles 74°C. FLAG any §2 unsafe practice (washing raw poultry, raw meat resting at room temp for hours, partial-cook-then-finish-later, cooked rice left at room temp, rare ground/poultry/pork, slow-cooling big pots overnight, counter-thawing).' },
  { key: 'science', name: 'علمِ غذا', checks: 'every whyItWorks bullet must be a REAL mechanism with correct temperature/direction (AUTHORING_REFERENCE §3). FLAG any debunked myth (searing seals juices, salt boils water faster, alcohol fully cooks off, bring meat to room temp, rinse pasta, bone-in cooks faster, deep acid-marinade tenderizing), any Maillard/caramelization conflation, any vague "locks in/seals/opens pores" claim.' },
  { key: 'swaps', name: 'ربطِ جایگزین‌ها', checks: 'each ingredient swaps[] must be dish-appropriate, same FUNCTIONAL ROLE, grounded (real id), and honest (AUTHORING_REFERENCE §1). FLAG any irrelevant/near-identical swap (potato→another potato), wrong-role swap, padded category peer, or a saffron-type unique ingredient given a fake swap (must be []). Check the ingredientSubsEnrichment is equally valid.' },
  { key: 'clean', name: 'تمیزی و کامل‌بودن', checks: 'all GRIS v2.1 sections present and rich. NO leak in any DISPLAY field (name/volume/prepState/serveWith/swap/finish/variations): no «ing_xxx», no «اصلاح…منبع…», no raw English id. volume must NOT restate grams. weightG numeric. steps must reference ingredients by a short name that appears in ingredients[].name AND carry usesIngredientIds. Persian natural + beginner-grade (concrete flame/time/sensory cues). criticalRole/optional set honestly.' },
]

const authorPrompt = (r) => `You are a world-class recipe developer and food scientist authoring for Garnish, a Persian-first cooking app whose recipes must beat NYT Cooking / ATK / Serious Eats on depth AND correctness, with ZERO fabrication.

TASK: rewrite ONE existing recipe into the GRIS v2.1 standard.
RECIPE: «${r.title}» — recipeId ${r.recipeId}.

${REFS}
Your source recipe is the object with recipeId "${r.recipeId}" inside docs/data-pilot/_grounding/${BATCH}.json (it carries the real ingredientIds + the existing flat steps). Use those ids for the recipe's own ingredients.

PRODUCE EXACTLY the GRIS v2.1 object shape from the contract, honoring every hard rule:
- Structured, DISH-AWARE, grounded swaps per ingredient (Reference §1) — e.g. lamb→[veal, beef, turkey, mushroom]; potato in a stew→eggplant (قیمه/خورش بادمجانی tradition); saffron→[] (honest, no fake color). Each swap a REAL id you verified by grepping ingredients.json. Also output ingredientSubsEnrichment to upgrade the dictionary's substitutionOptions for the live swap button.
- CLEAN display fields: name = clean human name (no «— ing_xxx», no parenthetical metadata), volume = a true household measure (پیمانه/عدد/قاشق/تکه) that does NOT restate weightG, weightG = the gram number, prepState clean.
- 6–10 ultra-granular BEGINNER steps (for someone who has never cooked): each with flame, tempC where a target applies (FOOD-SAFE per §2), durationMin (clean number), sees (visual/sensory cue), doneness, recovery; each step lists usesIngredientIds (the real ids it uses) and refers to ingredients by the SAME short name as ingredients[].name.
- whyItWorks: 3–5 REAL mechanisms (§3) with correct temps; NO debunked myth.
- Authentic to the dish; cautious on disputed regional origin claims. allergens DERIVED from ids. dietary booleans correct. Self-report nutrition coverage (which ids are NOT source-locked per "locked" in ingredients.json).

OUTPUT: Write the full package as valid, pretty JSON to ${DIR}/${r.recipeId}.json with shape:
{ "recipeId": "${r.recipeId}", "gris": { ...the GRIS v2.1 object... }, "coverage": {"locked":N,"total":M,"missingIds":[...]}, "ingredientSubsEnrichment": [ {"ingredientId":"...","substitutionOptions":[{"replaceWithIngredientId":"...","name":"...","reason":"availability|taste|dietary|cost","note":"..."}]} ], "selfScore": 0-100 }
Verify the file parses as JSON (cat it / parse it). Then return {recipeId, path:"${DIR}/${r.recipeId}.json", coverageLocked, coverageTotal, selfScore, notes}.`

const verifyPrompt = (lens, path, r) => `You are an ADVERSARIAL verifier. Your job is to FIND FAULTS in an auto-authored recipe, not to praise it. Default to skepticism — a false "pass" on a real problem is the worst possible outcome.

LENS: ${lens.name}
Read the authored file: ${path}. Read docs/data-pilot/AUTHORING_REFERENCE.md (your gate) and docs/data-pilot/GRIS_V2_1_CONTRACT.md. For id checks, grep docs/data-pilot/_grounding/ingredients.json.

CHECK ONLY THIS LENS: ${lens.checks}

Inspect carefully (recipe: «${r.title}»). Return {lens:"${lens.key}", pass, severity, issues}. severity:
- "major" = a hard-constraint violation: unsafe temp/practice, fabricated nutrition, an id that doesn't exist in the dictionary, an irrelevant/wrong swap, a debunked-myth claim, or a display-field leak.
- "minor" = polish/wording.
- "ok" = clean for this lens.
issues = concise, each naming the exact field/step. Be specific and correct.`

const fixPrompt = (path, r, issues) => `You are fixing an auto-authored recipe «${r.title}» that FAILED verification. Read ${path}.
Address EVERY issue below (all "major" ones for certain; minor ones if quick):
${issues.map((s, i) => `${i + 1}. ${s}`).join('\n')}

${REFS}
Revise the gris package IN PLACE: keep what is correct, fix what is flagged, ground every id against ingredients.json, keep every display field clean, keep temps food-safe (§2), keep swaps dish-aware (§1). Rewrite the full corrected package to ${path} (same JSON shape). Return {recipeId:"${r.recipeId}", fixed:true, addressed:[short list of what you changed]}.`

// ---- run the pipeline: author -> (verify x5 + fix loop, max 2 rounds) -> verdict ----
log(`authoring ${recipes.length} recipes → ${BATCH}`)

const results = await pipeline(
  recipes,
  (r) => agent(authorPrompt(r), { label: `author:${r.title}`, phase: 'Author', effort: 'high', schema: AUTHOR_SCHEMA }),
  async (authored, r) => {
    if (!authored) return { recipeId: r.recipeId, title: r.title, pass: false, reason: 'author_failed', rounds: 0 }
    const path = `${DIR}/${r.recipeId}.json`
    let rounds = 0
    let verdicts = []
    let pass = false
    while (rounds < 2) {
      verdicts = (await parallel(LENSES.map((L) => () =>
        agent(verifyPrompt(L, path, r), { label: `verify:${L.key}:${r.title}`, phase: 'Verify', effort: 'high', schema: VERIFY_SCHEMA }),
      ))).filter(Boolean)
      const majors = verdicts.filter((v) => !v.pass && v.severity === 'major')
      pass = majors.length === 0
      rounds += 1
      if (pass) break
      const issues = verdicts.filter((v) => v.severity === 'major' || v.severity === 'minor').flatMap((v) => (v.issues || []).map((i) => `[${v.lens}] ${i}`))
      await agent(fixPrompt(path, r, issues), { label: `fix:${r.title} (round ${rounds})`, phase: 'Fix', effort: 'high', schema: FIX_SCHEMA })
    }
    const score = Math.round((verdicts.filter((v) => v.pass).length / Math.max(1, verdicts.length)) * 100)
    return {
      recipeId: r.recipeId, title: r.title, path, pass, rounds, score,
      coverage: { locked: authored.coverageLocked, total: authored.coverageTotal },
      verdicts: verdicts.map((v) => ({ lens: v.lens, pass: v.pass, severity: v.severity, issues: v.issues || [] })),
    }
  },
)

const passed = results.filter((r) => r && r.pass)
log(`done: ${passed.length}/${results.length} passed all lenses`)
return { batch: BATCH, passed: passed.map((r) => r.recipeId), results }
