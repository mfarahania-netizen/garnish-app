export const meta = {
  name: 'master-rebuild-plan',
  description: 'Map cross-app dependencies + lock the no-rework, dependency-ordered whole-app rebuild plan',
  phases: [
    { title: 'Map', detail: 'dependency-map each app area on the shared foundation (file:line)' },
    { title: 'Plan', detail: 'synthesize the layered, no-rework master rebuild sequence + prune list' },
  ],
}

const DIR = 'docs/audit/_rebuild'

// Areas to dependency-map. Personalization is already deeply mapped in docs/audit/_map + _findings;
// these cover the REST of the app + the shared foundation, focused on "what does it depend on".
const AREAS = [
  { key: 'foundation', title: 'The shared intelligence FOUNDATION (the spine)', scope: 'apps/server/src/behavior-engine (signals, processors, routing/event-router + processor.registry, feature-store, identity, profile/read/living-profile, snapshots) + apps/server/src/analytics (event ingest, event-quality, consent) + the SignalObservation/UserEvent schema (prisma). THIS IS THE SPINE every feature reads. Document: the exact signal/observation/profile data model, who WRITES it (event → processor → SignalObservation), who READS it (ranker, AI, gamification, food-DNA), the broken joints (cook_complete unrouted, profile hydrated from []), and what a world-class foundation needs (full event capture + consent-at-ingest + a hydrated unified taste/identity model + a context object). file:line.' },
  { key: 'ai', title: 'AI subsystem', scope: 'apps/server/src/ai (assist, tools, core, controller, nutrition-claim guard, behavioral-context-snapshot) + apps/web/src/features/ai-chat + assistant screen. What does the AI READ about the user today (does it use getLivingUserProfile / signals / context)? Live LLM rails on or off? How grounded? Its dependency on the foundation (a real living profile) to become "AI that knows you" vs a generic chatbot. What a world-class, personalized, grounded AI needs from L0. file:line.' },
  { key: 'proactive', title: 'Notifications / proactive / briefing', scope: 'apps/server/src/* notification-scheduler, briefing controller/service, any push/email channel; apps/web notifications screen. Is anything delivered (push/email) or all dry-run? What it depends on (context engine, recs, signals). What a world-class proactive layer needs from L0/L1. file:line.' },
  { key: 'planning', title: 'Meal planning + shopping list', scope: 'apps/server/src/* meal-plan(ning) + shopping modules; apps/web plan + shopping-list screens; the pantry gap (no Pantry model). Their dependency on taste/recs/events. What a world-class planner + shopping/pantry needs from L0/L1. file:line.' },
  { key: 'engagement', title: 'Gamification + Food-DNA + profile', scope: 'apps/server/src/gamification + behavior-engine/profile + apps/web food-dna + profile screens. What events they consume (cook_complete for streak), how Food-DNA hydrates (getFoodDnaProjection vs the frozen getLivingUserProfile), their dependency on the foundation. What world-class engagement + a living Food-DNA needs from L0. file:line.' },
  { key: 'data-admin', title: 'Analytics + admin observability', scope: 'apps/server/src/admin + analytics controllers/services; apps/web admin screen. What is captured vs the founder\'s "capture every second"; the missing personalization events (swap/remove/scale); what the admin shows (honesty dashboard) vs the behavioral-intelligence cockpit needed ("for قیمه, 40% swap گوشت→قارچ"). Dependency on the L0 event pipeline. file:line.' },
]

const mapPrompt = (a) => `You are a principal architect mapping ONE app area's dependencies for a WHOLE-APP rebuild plan, so the rebuild order has NO rework. Facts with file:line evidence, not impressions.

AREA: ${a.title}
SCOPE (read the real code — Grep/Read/Glob, follow imports): ${a.scope}

Document precisely:
- WHAT it is + key files (path) and what they do (file:line for anything important).
- WHAT it READS from the shared foundation (signals / SignalObservation / getLivingUserProfile / events / context / recommendations) and WHAT it WRITES.
- Its hard DEPENDENCY on the foundation: would rebuilding this area before the foundation cause rework? Why?
- What's broken / stubbed / theater / dead today (be blunt, file:line).
- What a WORLD-CLASS version of this area needs FROM the foundation (L0) and from the recommender (L1) — i.e. what must exist first.

Write to ${DIR}/${a.key}.md (clean markdown). Return a 4-line summary {area, its #1 dependency, the single most important fact, rebuild-before-or-after-foundation}.`

phase('Map')
log('dependency-mapping 6 app areas')
const maps = await parallel(AREAS.map((a) => () => agent(mapPrompt(a), { label: `map:${a.key}`, phase: 'Map', effort: 'high', agentType: 'Explore' })))

phase('Plan')
log('synthesizing the master rebuild plan')
const plan = await agent(
  `You are the lead architect producing THE master rebuild plan for Garnish — a whole-app rewrite to a beyond-world-class standard for a founder who wants "imagine we have nothing", every part rebuilt, with ZERO rework and ZERO wasted time. You decide the route; be decisive and correct.

READ: ${DIR}/*.md (the 6 cross-app dependency maps), docs/audit/PERSONALIZATION_AUDIT.md + PERSONALIZATION_STANDARD.md + PERSONALIZATION_ROADMAP.md (the personalization layer, already designed), docs/audit/_findings/*.md, docs/audit/_map/*.md, and docs/audit/_research/FOUNDER_REQUIREMENTS.md (the founder's vision/bar).

Write docs/audit/MASTER_REBUILD_PLAN.md. The thesis to validate or correct with evidence: rebuild by LAYER, not by feature — build the shared intelligence FOUNDATION once, then every feature is a thin consumer; sequencing by feature (personalization, then AI) would rebuild both on a severed foundation = double rework. Cover:
1. The dependency graph (who depends on what), as a clear ordered list — the proof of the correct sequence.
2. The LAYERED rebuild sequence with NO rework, each layer stating WHAT IT UNBLOCKS:
   - L0 FOUNDATION (the spine everything reads): total event capture + consent-at-ingest (fixes the GDPR gap) · signal routing that closes the cook loop · the unified hydrated taste/identity model · the real-time context object · the admin/observability pipeline. Give the concrete data contracts + the precise broken joints to fix (file:line).
   - L1 LEARNING RECOMMENDER (per PERSONALIZATION_STANDARD): two-stage funnel + Bayesian collective trio + Thompson bandit + learned ranking + transparency.
   - L2 AI grounded in the L0 living profile + L1 taste model (the founder's #1) — why it's near-worthless before L0.
   - L3 CONSUMERS: proactive/notifications, meal-planning + shopping/pantry, gamification + Food-DNA — each a thin reader of L0/L1.
3. The KEEP / DELETE / EXTRACT list — what to prune now ("imagine we have nothing" done right): the ~13k LOC shadow/lab/control-plane (extract to research/ or delete), dead taxonomy constants, theater (fake pantry rail, hardcoded AI Whisper). Keep: allergy gate, ingredient data moat, candidate diversity, the live negative loop, explainability substrate.
4. The FIRST SPRINT — the exact, ordered, do-this-now checklist for L0 (file-level), since L0 is unambiguous and everything waits on it.
5. A one-screen ordered master checklist (every step, dependency-ordered, the whole app).
Be concrete, decisive, evidence-based; push back on anything in the inputs that's wrong. Return a 10-line executive summary: the locked sequence + the first 5 concrete steps + the top-3 things to delete.`,
  { label: 'synth:master-plan', phase: 'Plan', effort: 'high' },
)

return { maps: maps.filter(Boolean).length, plan }
