export const meta = {
  name: 'guardian-review',
  description: 'Post-fix guardian — TWO independent reviewers check each fix I made: "done in the BEST way?" If either finds a gap, the fix is returned for rework (the cycle repeats).',
  phases: [{ title: 'Review', detail: '2 independent reviewers per fix; a fix passes only if BOTH approve' }],
}

const MEM = 'C:/Users/mfara/.claude/projects/C--dev-garnish-app/memory'
const CTX = `Garnish — Persian-first cooking app, premium, launching in Holland/Europe for the GENERAL public (NOT diaspora). Hard invariants: the allergy HARD filter + getLivingUserProfile cold-start byte-identical; consent fail-CLOSED; no-pork for halal/kosher. Truth sources (read fresh): docs/audit/EXECUTION_LEDGER.md, FOUNDER_REQUIREMENTS.md, IDEAS_AND_GAPS.md, AI_STANDARD.md, GUARDIAN_LOG.md, ${MEM}. The founder's bar is "the BEST possible", world-class, no carelessness.`

// args.fixes = [{ id, issue, whatIDid, files }]  (the issues the implementer just fixed)
const fixes = (args && Array.isArray(args.fixes)) ? args.fixes : []

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
