export const meta = {
  name: 'gris-author-batch-v2',
  description: 'TOKEN-EFFICIENT recipe authoring → 3 consolidated adversarial critics → 1 fix round → gate. NO args (the args channel misfired and re-ran a done batch, burning 47% of the weekly budget); the batch + list are hardcoded here. Same coverage, ~half the agents.',
  phases: [
    { title: 'Author', detail: 'rewrite each recipe to GRIS v2.1 (high effort — content quality)' },
    { title: 'Verify', detail: '3 consolidated critics/recipe at medium effort (grounding+safety · science+swaps · cleanliness)' },
    { title: 'Fix', detail: 'one fix round only if a major issue' },
  ],
}

// HARDCODED (no args — args is unreliable here and caused a 47%-budget misfire). Edit per batch.
const BATCH = 'batch-05'
const recipes = [
  { recipeId: 'garnish_recipe_fa_228_09a631f3', title: 'خورشت فسنجان' },
  { recipeId: 'garnish_recipe_fa_235_3d02f3ae', title: 'چلو کباب کوبیده' },
  { recipeId: 'garnish_recipe_fa_866_9986ddf5', title: 'لوبیا پلو با گوشت چرخ‌کرده' },
  { recipeId: 'garnish_recipe_fa_872_529097b4', title: 'دلمه برگ مو' },
  { recipeId: 'garnish_recipe_fa_875_f2ddeb1c', title: 'دلمه بادمجان / دلمه کلم' },
  { recipeId: 'garnish_recipe_fa_878_85458912', title: 'زرشک پلو با مرغ' },
  { recipeId: 'garnish_recipe_fa_880_6164abab', title: 'کوفته تبریزی' },
  { recipeId: 'garnish_recipe_fa_1208_434b3a9a', title: 'آش رشته' },
  { recipeId: 'garnish_recipe_fa_1220_6429319c', title: 'سبزی پلو با ماهی' },
  { recipeId: 'garnish_recipe_fa_1239_1be04a64', title: 'قیمه نثار' },
  { recipeId: 'garnish_recipe_fa_1290_f5fc285f', title: 'حلیم بادمجان' },
  { recipeId: 'garnish_recipe_fa_1743_005c3739', title: 'کشک بادمجان' },
  { recipeId: 'garnish_recipe_fa_84_52c11d43', title: 'کباب برگ' },
]
const DIR = `docs/data-pilot/_authored/${BATCH}`
const REFS = 'Read docs/data-pilot/GRIS_V2_1_CONTRACT.md (exact shape + hard rules) and docs/data-pilot/AUTHORING_REFERENCE.md (substitution §1 · food-safety §2 HARD · food-science+myths §3). Ground ids by grepping docs/data-pilot/_grounding/ingredients.json (match the Persian name in the "fa" field). NEVER invent an id.'

const AUTHOR_SCHEMA = { type: 'object', additionalProperties: false, required: ['recipeId', 'path', 'selfScore'], properties: { recipeId: { type: 'string' }, path: { type: 'string' }, coverageLocked: { type: 'number' }, coverageTotal: { type: 'number' }, selfScore: { type: 'number' }, notes: { type: 'string' } } }
const VERIFY_SCHEMA = { type: 'object', additionalProperties: false, required: ['critic', 'pass', 'severity'], properties: { critic: { type: 'string' }, pass: { type: 'boolean' }, severity: { type: 'string', enum: ['ok', 'minor', 'major'] }, issues: { type: 'array', items: { type: 'string' } } } }
const FIX_SCHEMA = { type: 'object', additionalProperties: false, required: ['fixed'], properties: { recipeId: { type: 'string' }, fixed: { type: 'boolean' }, addressed: { type: 'array', items: { type: 'string' } } } }

// 3 CONSOLIDATED critics (cover the same 5 lenses, fewer agents → fewer tokens, same checks).
const CRITICS = [
  { key: 'grounding_safety', name: 'گراندینگ + ایمنیِ داده/غذا', checks: 'EVERY ingredientId (recipe + swaps[] + step usesIngredientIds + ingredientSubsEnrichment) EXISTS in ingredients.json (grep). allergens DERIVED from ids (not invented). NO fabricated nutrition (only "locked":true ingredients contribute). EVERY tempC + doneness meets AUTHORING_REFERENCE §2 (poultry 74°C, ground 71°C, whole cuts 63°C+rest, fish 63°C, eggs 71°C); FLAG any §2 unsafe practice (washing raw poultry, raw meat at room temp, partial-cook-finish-later, cooked rice at room temp, rare ground/poultry).' },
  { key: 'science_swaps', name: 'علمِ غذا + ربطِ جایگزین‌ها', checks: 'every whyItWorks bullet is a REAL mechanism with correct temp/direction (§3); FLAG any debunked myth (sear seals juices, salt boils faster, alcohol fully cooks off, bring-to-room-temp, rinse pasta, bone-in-faster, deep-acid-marinade) or Maillard/caramelization conflation. each ingredient swaps[] is dish-appropriate, same FUNCTIONAL ROLE, grounded (real id), honest (§1); FLAG irrelevant/near-identical swaps, wrong-role swaps, or a unique ingredient (saffron) given a fake swap (must be []).' },
  { key: 'clean', name: 'تمیزی و کامل‌بودن', checks: 'all GRIS v2.1 sections present + rich. NO leak in any DISPLAY field (name/volume/prepState/serveWith/swap/finish/variations): no «ing_xxx», no «اصلاح…منبع…», no raw English id. volume must NOT restate grams; weightG numeric. steps reference ingredients by a short name in ingredients[].name AND carry usesIngredientIds. Persian natural + beginner-grade (concrete flame/time/sensory cues). criticalRole/optional honest.' },
  // founder: "some recipes don't read human". This critic catches FLAT/TEMPLATED prose so the fix round humanizes it.
  { key: 'human_voice', name: 'صدای انسانی', checks: 'Does the PROSE read like a real Persian home cook / food writer wrote it, or like a machine/template? FLAG (severity "major") when story.hook/origin, glance.promise, whyItWorks.explanation, step.instruction, or finish read FLAT, GENERIC, TEMPLATED, or robotic: identical sentence rhythm across steps, bland filler ("سپس", "حالا" repeated mechanically), no sensory/emotional texture, no real-cook warmth or asides, or a tone that could belong to ANY recipe. A GREAT recipe has a specific evocative hook, an origin with genuine cultural/occasion texture accessible to a European newcomer (zero Persian background), and steps with concrete sensory cues in a natural human cadence. Do NOT flag for correctness/structure (other critics own that) — ONLY voice/humanity. issues must quote the exact flat field/sentence.' },
]

const authorPrompt = (r) => `You are a world-class recipe developer + food scientist for Garnish (Persian-first, premium, must beat NYT Cooking/ATK on depth AND correctness, ZERO fabrication).
TASK: rewrite ONE existing recipe «${r.title}» (recipeId ${r.recipeId}) into GRIS v2.1.
${REFS}
Your source recipe is the object with recipeId "${r.recipeId}" in docs/data-pilot/_grounding/${BATCH}.json (real ingredientIds + flat steps).
Produce EXACTLY the GRIS v2.1 shape with every hard rule: structured DISH-AWARE grounded swaps per ingredient (real verified ids; saffron→[]); CLEAN display fields (name/volume[true household measure, not grams]/prepState); 6–10 ultra-granular BEGINNER steps each with flame, tempC (FOOD-SAFE §2), durationMin, sees, doneness, usesIngredientIds; whyItWorks 3–5 REAL mechanisms (§3, no myths); allergens DERIVED from ids; honest nutrition coverage. Also output ingredientSubsEnrichment to upgrade the dictionary's swaps.
HUMAN VOICE (non-negotiable — the founder rejects machine/templated prose): write as a REAL Persian home cook / food writer with a voice, not a template. story.hook = one evocative, specific, mouth-watering line. story.origin = genuine cultural/occasion texture, accessible to a European with ZERO Persian background (a natural comparison to a familiar dish is welcome). Steps + whyItWorks must VARY their cadence (no mechanical "سپس…/حالا…" on every step), carry concrete SENSORY cues, and feel like a person who has cooked this many times — warmth + the occasional real-cook aside — never bland filler that could belong to any recipe. Beginner-clear but alive.
Write valid pretty JSON to ${DIR}/${r.recipeId}.json: { "recipeId","gris":{...}, "coverage":{"locked":N,"total":M,"missingIds":[]}, "ingredientSubsEnrichment":[...], "selfScore":0-100 }. Verify it parses. Return {recipeId, path:"${DIR}/${r.recipeId}.json", coverageLocked, coverageTotal, selfScore, notes}.`

const verifyPrompt = (c, path, r) => `You are an ADVERSARIAL verifier — FIND FAULTS, don't praise. A false "pass" on a real problem is the worst outcome.
CRITIC: ${c.name}. Read the authored file ${path}, AUTHORING_REFERENCE.md + GRIS_V2_1_CONTRACT.md; grep ingredients.json for id checks.
CHECK ONLY: ${c.checks}
Recipe: «${r.title}». Return {critic:"${c.key}", pass, severity, issues}. severity "major"=a hard-constraint violation (unsafe temp/practice, fabricated nutrition, nonexistent id, irrelevant/wrong swap, debunked myth, display-field leak); "minor"=polish; "ok"=clean. issues name the exact field/step.`

const fixPrompt = (path, r, issues) => `Fix the auto-authored «${r.title}» at ${path} which FAILED verification. Address EVERY major issue (minor if quick):\n${issues.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n${REFS}\nRevise IN PLACE (keep what's correct), ground every id, keep display fields clean, temps §2-safe, swaps §1 dish-aware. If any issue is about «صدای انسانی», REWRITE the flagged flat/templated prose (story.hook/origin · glance.promise · whyItWorks.explanation · step.instruction · finish) into warm, specific, natural human food-writer Persian with varied cadence + real sensory texture — while preserving EVERY fact, id, number, tempC, and the structure exactly. Rewrite the full corrected package to ${path}. Return {recipeId:"${r.recipeId}", fixed:true, addressed:[...]}.`

log(`authoring ${recipes.length} recipes → ${BATCH} (efficient: author@high, 3 critics@medium, 1 fix round)`)
const results = await pipeline(
  recipes,
  (r) => agent(authorPrompt(r), { label: `author:${r.title}`, phase: 'Author', effort: 'high', schema: AUTHOR_SCHEMA }),
  async (authored, r) => {
    if (!authored) return { recipeId: r.recipeId, title: r.title, pass: false, reason: 'author_failed' }
    const path = `${DIR}/${r.recipeId}.json`
    let verdicts = (await parallel(CRITICS.map((c) => () =>
      agent(verifyPrompt(c, path, r), { label: `verify:${c.key}:${r.title}`, phase: 'Verify', effort: 'medium', schema: VERIFY_SCHEMA }),
    ))).filter(Boolean)
    let majors = verdicts.filter((v) => !v.pass && v.severity === 'major')
    if (majors.length) {
      const issues = verdicts.filter((v) => v.severity !== 'ok').flatMap((v) => (v.issues || []).map((i) => `[${v.critic}] ${i}`))
      await agent(fixPrompt(path, r, issues), { label: `fix:${r.title}`, phase: 'Fix', effort: 'medium', schema: FIX_SCHEMA })
      verdicts = (await parallel(CRITICS.map((c) => () =>
        agent(verifyPrompt(c, path, r), { label: `reverify:${c.key}:${r.title}`, phase: 'Fix', effort: 'medium', schema: VERIFY_SCHEMA }),
      ))).filter(Boolean)
      majors = verdicts.filter((v) => !v.pass && v.severity === 'major')
    }
    return { recipeId: r.recipeId, title: r.title, pass: majors.length === 0, score: Math.round((verdicts.filter((v) => v.pass).length / Math.max(1, verdicts.length)) * 100), verdicts: verdicts.map((v) => ({ critic: v.critic, pass: v.pass, severity: v.severity, issues: v.issues || [] })) }
  },
)
const passed = results.filter((r) => r && r.pass)
log(`done: ${passed.length}/${results.length} passed`)
return { batch: BATCH, passed: passed.map((r) => r.recipeId), results }
