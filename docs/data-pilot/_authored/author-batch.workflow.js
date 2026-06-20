export const meta = {
  name: 'gris-author-batch',
  description: 'Author a batch of recipes to GRIS v2.1 + adversarially verify (5 lenses) + fix + gate',
  phases: [
    { title: 'Author', detail: 'rewrite each recipe to GRIS v2.1 (grounded, clean, dish-aware swaps)' },
    { title: 'Verify', detail: '5 adversarial lenses per recipe: grounding · safety · science · swaps · cleanliness' },
    { title: 'Fix', detail: 'revise any recipe with a major issue, then re-verify' },
  ],
}

const BATCH = (args && args.batch) || 'batch-02'
const recipes = (args && Array.isArray(args.recipes) && args.recipes.length) ? args.recipes : [
  { recipeId: 'garnish_recipe_fa_1341_6b4ba753', title: 'همبرگر (چیز‌برگر)' },
  { recipeId: 'garnish_recipe_fa_1816_dec0afbb', title: 'سوپ شیر' },
  { recipeId: 'garnish_recipe_fa_1279_e3e99c0f', title: 'میگو پلو' },
  { recipeId: 'garnish_recipe_fa_1323_cf6bcb5c', title: 'لازانیا' },
  { recipeId: 'garnish_recipe_fa_1333_db68905d', title: 'مرغ سوخاری' },
  { recipeId: 'garnish_recipe_fa_1334_8963bd85', title: 'اشترودل گوشت' },
  { recipeId: 'garnish_recipe_fa_1343_5bf8151c', title: 'خوراک مرغ و قارچ' },
  { recipeId: 'garnish_recipe_fa_2071_5391bddf', title: 'سالاد سزار' },
  { recipeId: 'garnish_recipe_fa_2075_3d9b2098', title: 'سمبوسه آبادانی' },
  { recipeId: 'garnish_recipe_fa_2079_5543499b', title: 'سمبوسه در فر' },
  { recipeId: 'garnish_recipe_fa_862_dbf3d4d5', title: 'باقالی پلو با گوشت' },
  { recipeId: 'garnish_recipe_fa_883_4b80bbcf', title: 'رولت گوشت' },
  { recipeId: 'garnish_recipe_fa_1252_3d200c70', title: 'کلم‌پلو شیرازی' },
  { recipeId: 'garnish_recipe_fa_1276_cdef73d2', title: 'تاس‌کباب' },
  { recipeId: 'garnish_recipe_fa_2090_ea20119c', title: 'نودل سبزیجات' },
  { recipeId: 'garnish_recipe_fa_2103_d26d79d5', title: 'پاستا آلفردو' },
  { recipeId: 'garnish_recipe_fa_110_847e93ad', title: 'خورشت سیب' },
  { recipeId: 'garnish_recipe_fa_216_1bfdfe55', title: 'جوجه کباب زعفرانی' },
  { recipeId: 'garnish_recipe_fa_1051_68dd60e0', title: 'خورشت کرفس' },
  { recipeId: 'garnish_recipe_fa_1251_3f83f105', title: 'خورشت بادمجان' },
  { recipeId: 'garnish_recipe_fa_1280_13a22528', title: 'رشته‌پلو شیرازی' },
  { recipeId: 'garnish_recipe_fa_1315_c324442d', title: 'دال عدس' },
  { recipeId: 'garnish_recipe_fa_139_012333bd', title: 'کوفته برنجی' },
  { recipeId: 'garnish_recipe_fa_154_cdfcadf7', title: 'شله مشهدی' },
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
