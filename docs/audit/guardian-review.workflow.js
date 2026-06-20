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
  { id: 'H1', issue: 'The allergy HARD filter was BYPASSED on the live recommendation feed for every ACTIVE user — it ran only in the cold-start bucket, which returns [] once a user has >5 events in 30 days (candidate-generator.ts getColdStartRecipes); the other 7 buckets + ranking.service.rank applied no allergen filter.', whatIDid: 'Added private filterSafe(userId, candidateIds) in apps/server/src/recommendation/pipeline/candidate-generator.ts: it runs the deterministic gate (getLivingUserProfile + analyzeRecipeIntegrity + assessRecipeFit) over the FULL merged candidate set for ALL users, FAIL-CLOSED (profile load throws/null → return []), dropping recommendation avoid_allergen AND avoid_constraint; wired into every generate() return; added Recipe.containsPork to FIT_SELECT. +2 live-path specs (active peanut+halal user → peanut & pork dropped, safe kept; fail-closed → []).', files: ['apps/server/src/recommendation/pipeline/candidate-generator.ts', 'apps/server/src/recommendation/pipeline/candidate-generator.spec.ts'] },
  { id: 'H2', issue: 'no_pork/halal/kosher was scored 0 but stayed a candidate (consumers dropped only avoid_allergen, never avoid_constraint), and recipe-fit sets safe=!allergenConflict so pork is marked safe; the registry copy claimed pork-avoidance is enforced (false).', whatIDid: 'Drop avoid_constraint/culturalConflict in filterSafe + cold-start fitRank + meal-plan-planner.service.ts (line ~86) + briefing-composer.ts (line ~90) + offline-metrics.ts (line ~31); added Recipe.containsPork to FIT_SELECT (authoritative). The registry copy is now true.', files: ['apps/server/src/recommendation/pipeline/candidate-generator.ts', 'apps/server/src/meal-plans/planner/meal-plan-planner.service.ts', 'apps/server/src/briefing/briefing-composer.ts', 'apps/server/src/recommendation/evaluation/offline-metrics.ts'] },
  { id: 'H3', issue: 'The LOCKED L0 EXIT GATE was narrowed from 6 criteria to 2, declared MET, and L1 was unblocked.', whatIDid: 'Restored the honest EXECUTION_LEDGER.md banner: L0 EXIT GATE NOT MET, L1 BLOCKED, with the full remaining locked criteria listed (real e2e integration test, Phase-0 counters, durable outbox, admin observability viewer, delete the 148-file shadow tree). Did NOT amend the plan to narrow it.', files: ['docs/audit/EXECUTION_LEDGER.md'] },
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
