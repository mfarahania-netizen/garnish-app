export const meta = {
  name: 'guardian-review',
  description: 'Post-fix guardian — TWO independent reviewers check each fix I made: "done in the BEST way?" If either finds a gap, the fix is returned for rework (the cycle repeats).',
  phases: [{ title: 'Review', detail: '2 independent reviewers per fix; a fix passes only if BOTH approve' }],
}

const MEM = 'C:/Users/mfara/.claude/projects/C--dev-garnish-app/memory'
const CTX = `Garnish — Persian-first cooking app, premium, launching in Holland/Europe for the GENERAL public (NOT diaspora). Hard invariants: the allergy HARD filter + getLivingUserProfile cold-start byte-identical; consent fail-CLOSED; no-pork for halal/kosher. Truth sources (read fresh): docs/audit/EXECUTION_LEDGER.md, FOUNDER_REQUIREMENTS.md, IDEAS_AND_GAPS.md, AI_STANDARD.md, GUARDIAN_LOG.md, ${MEM}. The founder's bar is "the BEST possible", world-class, no carelessness.`

// args.fixes = [{ id, issue, whatIDid, files }]. The args channel is flaky for scriptPath runs, so the
// current cycle's fixes are also hardcoded as the default (edit per cycle).
const DEFAULT_FIXES = [
  { id: 'H1-rework', issue: 'PRIOR REWORK: the allergy hard filter only covered /recommendations, NOT the GET /recipes (findAll) + /search + /:id/similar rails that Home/Discover actually render — a logged-in allergic user still saw peanut/pork on Home. Also fail-closed was weak (a swallowed userAllergy read yielded an empty-allergy profile).', whatIDid: 'Created ONE reusable RecipeSafetyFilterService (apps/server/src/recipes/intelligence/recipe-safety-filter.service.ts): getLivingUserProfile + assessRecipeFit, drops avoid_allergen + avoid_constraint; authed → FAIL-CLOSED (no profile → []), anonymous → pass-through (documented). Added OptionalJwtGuard (apps/server/src/auth/optional-jwt.guard.ts) and applied it + the filter to GET /recipes (findAll), /search, /:id/similar (recipes.controller.ts) — Home/Discover read these and the web apiClient already sends the token. candidate-generator.filterSafe now DELEGATES to the shared service (one definition). Hardened source: getDeclaredAnswers (profile-read.service.ts) no longer swallows a userAllergy read failure — it propagates so the gate fails closed.', files: ['apps/server/src/recipes/intelligence/recipe-safety-filter.service.ts', 'apps/server/src/auth/optional-jwt.guard.ts', 'apps/server/src/recipes/recipes.controller.ts', 'apps/server/src/recommendation/pipeline/candidate-generator.ts', 'apps/server/src/behavior-engine/profile/read/profile-read.service.ts', 'apps/server/src/recipes/intelligence/recipe-safety-filter.service.spec.ts'] },
  { id: 'H2-rework', issue: 'PRIOR REWORK: pork/halal not enforced on the /recipes rails + the registry copy over-claimed enforcement.', whatIDid: 'The shared RecipeSafetyFilterService drops avoid_constraint on every serving path (recommendations + /recipes + search + similar + meal-plan + briefing + offline-metrics); Recipe.containsPork is the authoritative flag. Corrected declared-dimension-registry.ts copy to "enforced across recommendations, the recipe lists, search, and meal plans". Halal-user+pork regression covered in the safety-filter + candidate-generator specs.', files: ['apps/server/src/recipes/intelligence/recipe-safety-filter.service.ts', 'apps/server/src/behavior-engine/profile/declared/declared-dimension-registry.ts'] },
]
const fixes = (args && Array.isArray(args.fixes) && args.fixes.length) ? args.fixes : DEFAULT_FIXES

const REVIEW = { type: 'object', additionalProperties: false, required: ['bestWay', 'gaps', 'verdict'], properties: {
  bestWay: { type: 'boolean' },
  gaps: { type: 'array', items: { type: 'string' } },
  betterApproach: { type: 'string' },
  verdict: { type: 'string', enum: ['approve', 'rework'] },
} }

const reviewerPrompt = (fix, n) => `${CTX}\n\nYou are POST-FIX REVIEWER #${n} (independent — do NOT assume the fix is good). The implementer claims to have FIXED this issue:\n- issue: ${fix.issue}\n- what they did: ${fix.whatIDid}\n- files: ${(fix.files || []).join(', ')}\n\nRead the ACTUAL code (and run the relevant tests/grep). Judge ruthlessly whether it was done in the BEST way: is it correct, complete, edge-safe, tested, idiomatic, and does it respect the hard invariants + the Europe-general-public target? FLAG any remaining gap, missed edge, better approach, or over-claim. verdict='approve' ONLY if it is genuinely best-in-class; else 'rework' with concrete gaps. Default to skepticism.`

phase('Review')
const results = await pipeline(
  fixes,
  (fix, _orig, i) => parallel([
    () => agent(reviewerPrompt(fix, 1), { label: `review1:${(fix.id || i)}`, phase: 'Review', effort: 'high', schema: REVIEW }),
    () => agent(reviewerPrompt(fix, 2), { label: `review2:${(fix.id || i)}`, phase: 'Review', effort: 'high', schema: REVIEW }),
  ]).then((rv) => {
    const reviews = rv.filter(Boolean)
    const approved = reviews.length === 2 && reviews.every((r) => r.bestWay && r.verdict === 'approve')
    return { id: fixes[i].id, issue: fixes[i].issue, passed: approved, gaps: reviews.flatMap((r) => r.gaps || []), reviews }
  }),
)

const passed = results.filter(Boolean).filter((r) => r.passed)
const needsRework = results.filter(Boolean).filter((r) => !r.passed)
log(`post-fix review: ${passed.length}/${results.length} passed; ${needsRework.length} need rework`)
return { total: results.length, passed: passed.length, needsRework }
