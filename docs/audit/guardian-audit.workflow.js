export const meta = {
  name: 'guardian-audit',
  description: 'Multi-stage guardian — many fresh-context FINDERS → a VERIFIER confirms/rejects each finding (kills false positives) → only CONFIRMED issues reach the implementer',
  phases: [
    { title: 'Find', detail: '6 fresh-context finders across distinct lenses' },
    { title: 'Verify', detail: 'an independent second guardian re-checks EACH finding; false positives are dropped' },
    { title: 'Report', detail: 'write GUARDIAN_LOG.md + return only the confirmed issues' },
  ],
}

const MEM = 'C:/Users/mfara/.claude/projects/C--dev-garnish-app/memory'
const TRUTH = `Sources of truth (read FRESH, never assume): docs/audit/EXECUTION_LEDGER.md, docs/audit/_research/FOUNDER_REQUIREMENTS.md, docs/audit/IDEAS_AND_GAPS.md, docs/audit/AI_STANDARD.md, docs/audit/GUARDIAN_LOG.md, and the auto-memory dir ${MEM} (MEMORY.md + each *.md).`
const CTX = `Garnish — Persian-first cooking app, premium, launching in Holland/Europe for the GENERAL public (NOT the diaspora). The founder grades hard, hates carelessness + drift, and wants every requirement remembered. ${TRUTH} Hard invariants: the allergy HARD filter + getLivingUserProfile cold-start stay byte-identical; consent is fail-CLOSED; no-pork enforced for halal/kosher.`

const FINDING = { type: 'object', additionalProperties: false, required: ['lens', 'kind', 'what', 'evidence', 'severity', 'suggestedFix'], properties: {
  lens: { type: 'string' }, kind: { type: 'string', enum: ['forgotten', 'careless', 'incomplete', 'drift', 'contradiction', 'theater', 'safety', 'on_track'] },
  what: { type: 'string' }, evidence: { type: 'string' }, severity: { type: 'string', enum: ['high', 'medium', 'low'] }, suggestedFix: { type: 'string' },
} }
const FINDINGS = { type: 'object', additionalProperties: false, required: ['findings'], properties: { findings: { type: 'array', items: FINDING } } }
const VERDICT = { type: 'object', additionalProperties: false, required: ['confirmed', 'reason', 'correctedSeverity'], properties: {
  confirmed: { type: 'boolean' }, reason: { type: 'string' }, correctedSeverity: { type: 'string', enum: ['high', 'medium', 'low', 'not_an_issue'] },
} }

const FINDERS = [
  { label: 'find:requirements-memory', lens: 'REQUIREMENTS & MEMORY — every founder requirement/decision/idea/promise: is it done, tracked, or DROPPED? include things said in passing + unanswered questions.' },
  { label: 'find:carelessness-quality', lens: 'CARELESSNESS & QUALITY — run `git log --oneline -30` + inspect recently-changed code; flag half-built things, missed edges, dead/unreachable code, untested paths, TODOs, inconsistencies, "looks done but isn\'t".' },
  { label: 'find:drift-vision', lens: 'DRIFT & VISION — are we on the layered no-rework path (L0→L3)? scope creep? premature work? what SHOULD we be doing/deciding that we are not?' },
  { label: 'find:safety-invariants', lens: 'SAFETY & INVARIANTS — verify the allergy hard filter + cold-start are byte-identical, consent is fail-closed, no-pork/halal is enforced, no fabricated nutrition; any regression risk?' },
  { label: 'find:europe-target', lens: 'TARGET-MARKET & EUROPE FIT — the launch is for the GENERAL European public. Flag anything Iran-hardcoded or assuming Persian knowledge (timezones, weekend, occasions, language, onboarding) that breaks for a Dutch user with zero Persian background.' },
  { label: 'find:theater-observability', lens: 'THEATER & OBSERVABILITY — anything claimed "done"/green that is built-but-unwired, consumed-by-nothing, or whose UI text over-claims; counters/events that should fire but don\'t.' },
]

phase('Find')
const raw = await parallel(FINDERS.map((f) => () => agent(`${CTX}\n\nYou are GUARDIAN FINDER. Be ruthless, specific, evidence-based (file:line / commit / requirement). No flattery. LENS: ${f.lens}\nReturn structured findings.`, { label: f.label, phase: 'Find', effort: 'high', schema: FINDINGS })))
const found = raw.filter(Boolean).flatMap((r) => r.findings || []).filter((f) => f.kind !== 'on_track')
log(`finders raised ${found.length} candidate issues → verifying each independently`)

phase('Verify')
const verifiedPairs = await parallel(found.map((f) => () => agent(
  `${CTX}\n\nYou are GUARDIAN VERIFIER (the independent SECOND guardian). A finder raised this candidate issue:\n- lens: ${f.lens}\n- kind: ${f.kind} | severity: ${f.severity}\n- what: ${f.what}\n- evidence: ${f.evidence}\n\nIndependently RE-CHECK it against the actual code + truth sources. CONFIRM only if you can reproduce it with your own evidence; REJECT false positives, already-fixed items, and wrong claims (e.g. a wrong line count or a model that already exists). Be skeptical but fair — do not reject a real issue. Return the verdict.`,
  { label: `verify:${(f.what || '').slice(0, 40)}`, phase: 'Verify', effort: 'high', schema: VERDICT },
).then((v) => ({ finding: f, verdict: v })))
)
const confirmed = verifiedPairs.filter(Boolean).filter((p) => p.verdict?.confirmed && p.verdict.correctedSeverity !== 'not_an_issue')
  .map((p) => ({ ...p.finding, severity: p.verdict.correctedSeverity || p.finding.severity, verifierReason: p.verdict.reason }))
log(`verifier confirmed ${confirmed.length}/${found.length} (dropped ${found.length - confirmed.length} false positives)`)

phase('Report')
const synth = `${CTX}\n\nYou are the GUARDIAN SYNTHESIZER. ${confirmed.length} CONFIRMED issues (already verified by a second guardian):\n${JSON.stringify(confirmed, null, 1)}\n\nDe-dupe + rank by severity. Write docs/audit/GUARDIAN_LOG.md (prepend a dated 2026-06-20 entry above older ones) with: 🔴 high · 🟡 medium · 🟢 low, each with evidence + the suggested fix. Then return a TIGHT founder-facing summary: the confirmed issues ranked, and the top corrections to make now.`
const summary = confirmed.length ? await agent(synth, { label: 'guardian:report', phase: 'Report', effort: 'high' }) : 'No confirmed issues — clean.'
return { candidates: found.length, confirmed: confirmed.length, confirmedIssues: confirmed, summary }
