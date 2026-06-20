export const meta = {
  name: 'forge',
  description: 'Universal SHIFT-LEFT quality forge: intake → multi-lens critique → complete spec + Definition-of-Done → adversarial spec-review (loop on the cheap TEXT, not code) → matured output. Tier + type aware. For ANY work unit: idea · feature · design · copy · element · bug. Avoids rework by locking the complete scope BEFORE implementation.',
  phases: [
    { title: 'Intake', detail: 'read the item; classify type + importance tier' },
    { title: 'Critique', detail: 'perspective-diverse critics (lenses by type), one per distinct failure class' },
    { title: 'Spec', detail: 'synthesize the COMPLETE remediation/maturation spec + acceptance criteria (DoD)' },
    { title: 'Spec-review', detail: 'adversarially attack the SPEC for missing sites/edges; loop on text until complete' },
  ],
}

// Read the work item from a file (the args channel is unreliable here, so we use a file the agents read).
const ITEM = 'docs/audit/_forge/item.md'
const SPEC = 'docs/audit/_forge/spec.md'

// Perspective-DIVERSE lenses per type (each = one distinct failure class, not redundant).
const LENSES = {
  idea: ['user value (does a real user care?)', 'investor value / moat / business', 'feasibility & cost', 'novelty vs the WORLD state-of-the-art', 'fit with the Garnish vision + layered plan', 'the missing 90% — what important angle is absent'],
  feature: ['correctness', 'COMPLETE coverage — every affected site/consumer/serving-path', 'edge cases & failure modes (fail-closed where safety)', 'hard invariants (allergy filter · cold-start byte-identical · consent · Europe-general-public)', 'UX', 'test adequacy', 'vs world-class competitors'],
  bug: ['true root cause (not the symptom)', 'COMPLETE coverage — every site with the same bug', 'edge/failure modes', 'hard invariants at risk', 'the regression test that proves it'],
  design: ['visual quality & the $20-premium feel', 'design-system consistency', 'RTL + natural Persian', 'accessibility', 'responsive / mobile', 'fit for a Dutch/European user with zero Persian background'],
  copy: ['clarity', 'brand voice & tone', 'natural Persian (and translatable)', 'ACCURACY / no over-claim', 'concision'],
  element: ['reusability & API', 'ALL states (loading / empty / error / disabled)', 'consistency with siblings', 'accessibility'],
}
const TIER_LENS_COUNT = { 0: 1, 1: 2, 2: 4, 3: 99 } // how many lenses by importance tier
const TIER_SPEC_ROUNDS = { 0: 0, 1: 1, 2: 2, 3: 3 } // adversarial spec-review rounds by tier

const INTAKE = { type: 'object', additionalProperties: false, required: ['type', 'tier', 'title', 'summary'], properties: {
  type: { type: 'string', enum: ['idea', 'feature', 'bug', 'design', 'copy', 'element'] },
  tier: { type: 'number', enum: [0, 1, 2, 3] }, title: { type: 'string' }, summary: { type: 'string' },
} }
const CRIT = { type: 'object', additionalProperties: false, required: ['lens', 'issues', 'mustFix'], properties: {
  lens: { type: 'string' }, issues: { type: 'array', items: { type: 'string' } }, mustFix: { type: 'array', items: { type: 'string' } },
} }
const REVIEW = { type: 'object', additionalProperties: false, required: ['complete', 'gaps'], properties: {
  complete: { type: 'boolean' }, gaps: { type: 'array', items: { type: 'string' } },
} }

const CTX = `Garnish — Persian-first cooking app, premium ($7 feeling like $20), launching in Holland/Europe for the GENERAL public (NOT diaspora). Hard invariants: allergy filter + cold-start byte-identical, consent fail-closed, no-pork for halal. Truth: docs/audit/{EXECUTION_LEDGER,IDEAS_AND_GAPS,AI_STANDARD,GUARDIAN_LOG}.md + FOUNDER_REQUIREMENTS. The founder's bar: world-class, no carelessness, no over-claim.`

phase('Intake')
const intake = await agent(`${CTX}\n\nRead ${ITEM}. Classify the work item: type (idea|feature|bug|design|copy|element) and importance TIER 0..3 (0=trivial e.g. one word; 1=small e.g. copy/element; 2=feature/design; 3=core/safety/AI/a whole layer). Return {type, tier, title, summary}.`, { label: 'forge:intake', phase: 'Intake', schema: INTAKE })
const lenses = (LENSES[intake.type] || LENSES.feature).slice(0, TIER_LENS_COUNT[intake.tier] ?? 2)
const rounds = TIER_SPEC_ROUNDS[intake.tier] ?? 1
log(`forge: «${intake.title}» — type=${intake.type} tier=${intake.tier} → ${lenses.length} lenses, ${rounds} spec-review rounds`)

phase('Critique')
const effort = intake.tier >= 3 ? 'high' : intake.tier === 2 ? 'high' : 'medium'
const critiques = (await parallel(lenses.map((L) => () =>
  agent(`${CTX}\n\nRead ${ITEM}. You are a RUTHLESS critic, lens = «${L}» ONLY. What is wrong, weak, missing, or over-claimed through THIS lens? Be specific + evidence-based; default to skepticism. Return {lens, issues, mustFix}.`, { label: `forge:critique:${L.slice(0, 24)}`, phase: 'Critique', effort, schema: CRIT }),
))).filter(Boolean)

phase('Spec')
await agent(`${CTX}\n\nRead ${ITEM}. Critiques from ${critiques.length} lenses:\n${JSON.stringify(critiques, null, 1)}\n\nProduce the COMPLETE spec and write it to ${SPEC}. For a feature/bug: EVERY affected site/consumer + edge cases + fail-modes + the exact acceptance tests (Definition-of-Done) so it can be built ONCE with zero rework. For an idea: the MATURED idea (the 90%) — user+investor+world rationale, which layer it fits, risks, and a crisp go/no-go recommendation. For design/copy/element: the exact improved version + why. End the file with a "## Definition of Done" checklist. Return a one-paragraph summary.`, { label: 'forge:spec', phase: 'Spec', effort, schema: { type: 'object', additionalProperties: false, required: ['summary'], properties: { summary: { type: 'string' } } } })

phase('Spec-review')
let complete = rounds === 0
let lastGaps = []
for (let i = 0; i < rounds && !complete; i++) {
  const rv = await agent(`${CTX}\n\nADVERSARIALLY review the spec at ${SPEC} against the item at ${ITEM}. Your job: find any site/consumer/edge/case/assumption that is MISSING and would force REWORK after implementation. Default to "incomplete" unless it is genuinely airtight. Return {complete, gaps}.`, { label: `forge:spec-review:${i + 1}`, phase: 'Spec-review', effort, schema: REVIEW })
  complete = rv.complete
  lastGaps = rv.gaps || []
  if (!complete) await agent(`${CTX}\n\nRevise the spec at ${SPEC} to CLOSE these gaps (rewrite the file completely, keep what's correct):\n${JSON.stringify(lastGaps, null, 1)}\nReturn "done".`, { label: `forge:spec-fix:${i + 1}`, phase: 'Spec-review', effort })
}
return { type: intake.type, tier: intake.tier, title: intake.title, specComplete: complete, residualGaps: lastGaps, specFile: SPEC }
