export const meta = {
  name: 'personalization-system-audit',
  description: 'Ruthless multi-agent audit of the personalization/recsys/behavior system + a world-class standard',
  phases: [
    { title: 'Map', detail: 'trace + inventory each subsystem slice with file:line' },
    { title: 'Audit', detail: '5 adversarial dimensions (no flattery) + 3 world-research threads' },
    { title: 'Synthesize', detail: 'ruthless audit report + global standard + concrete roadmap' },
  ],
}

const MAPDIR = 'docs/audit/_map'
const FINDDIR = 'docs/audit/_findings'
const RESDIR = 'docs/audit/_research'

// ---------- PHASE 1: MAP & TRACE (read-only, write an inventory per slice) ----------
const SLICES = [
  { key: 'signals', title: 'Behavior capture → signals', scope: 'apps/server/src/behavior-engine/signals, behavior-engine/processors, behavior-engine/feature-store, behavior-engine/identity, and apps/server/src/analytics (events/event-quality/anti-bot gate) + apps/server/src/gamification. How is raw user behavior (views, cooks, favorites, dismisses, dwell) captured, turned into signals, weighted, decayed, deduped, and stored? What signal TYPES exist? How does the anti-bot/event-quality gate work and what bypasses it?' },
  { key: 'profile', title: 'User profile + taste', scope: 'apps/server/src/behavior-engine/profile (declared, onboarding, reconciliation, read/living-profile.ts) + recommendation/taste-affinity + the FI-4.1 taste-correction (signal-calculator guard) + the frontend Food-DNA (apps/web/src/app/food-dna, components/ges/FoodDnaRing.jsx). How is the user model built: declared → reconciled → living profile? What dimensions (taste, diet, allergy, effort/skill)? How does getLivingUserProfile compose them? How does per-ingredient like/dislike feed back?' },
  { key: 'ranking', title: 'Ranking algorithm', scope: 'apps/server/src/recommendation/pipeline (candidate-generator, ranking.service, recommendation-pipeline.service, coldstart, ranking-effort-skill) + recommendation/ranking-model/contribution-calculator + recipes/intelligence/recipe-fit. THE CORE: what is the actual recommendation ALGORITHM? Enumerate every scoring component (memory says ~10). Is it content-based, collaborative, a hand-tuned linear blend, or learned? How are candidates generated and scored? How does cold-start work? Quote the component weights/formula.' },
  { key: 'shadow', title: 'Shadow runtime + experimentation', scope: 'apps/server/src/recommendation/runtime-shadow (control-plane, lab: activation-review/execution/founder-review) + recommendation/evaluation + exposure + explainability + intelligence + apps/server/src/recsys eval harness. Is there a real online/shadow serving path, A/B experimentation, exposure logging, and offline evaluation (MAP/MRR/Recall)? Is the shadow runtime WIRED to what users actually see, or is it parallel scaffolding that never reaches production? Trace whether ranking output reaches the frontend.' },
  { key: 'frontend', title: 'Personalization UX (what the user feels)', scope: 'apps/web/src/app/home/lib/useHomeData.js (the "for you" feed), app/food-dna, hooks/usePersonalization.js + usePersonalizedCascade.js + useDismissRecommendation.js, components/ges/personalize.js, features/ai-chat/services/personalizationService.js, the recipe-detail personalization, WhyChip/explanation. What does the user ACTUALLY see and feel as "personalized"? Where do recommendations surface? Is there any "for you / because you…" explanation? Context-awareness (time/season/pantry)?' },
]

const mapPrompt = (s) => `You are a principal engineer reverse-engineering a recipe app's personalization system for a forensic audit. Map ONE slice precisely and honestly — facts with evidence, not impressions.

SLICE: ${s.title}
SCOPE (read these — use Grep/Read/Glob, read the real code, follow imports): ${s.scope}

Produce a precise inventory + data-flow map. For the slice, document:
- every key file (path) with its role + the key functions/classes and what they actually DO (cite file:line for anything important).
- the data flow IN and OUT (what calls this, what it calls, what it reads/writes in the DB).
- the actual logic/algorithm/formula (quote real numbers: weights, thresholds, decay rates, component lists).
- entry points that reach (or DON'T reach) a real user-facing path — be explicit about dead/shadow-only code.
- anything surprising, hardcoded, stubbed, frozen, or disabled.

Write the map as clean markdown to ${MAPDIR}/${s.key}.md. Be exhaustive and exact (this is the evidence base for the audit). Return a 3-line summary {slice, files mapped, the single most important fact you found}.`

// ---------- PHASE 2a: ADVERSARIAL AUDIT (no flattery, file:line evidence) ----------
const DIMENSIONS = [
  { key: 'integrity', title: 'End-to-end integrity — does the loop actually close?', focus: 'Trace ONE full loop: user does X (cook/favorite/dislike) → signal → profile → ranking → what the user sees next. Does behavior ACTUALLY change recommendations for a real logged-in user, end to end? Or are there breaks: signals written but never read, a shadow ranker that never serves, cold-start that dominates forever, a frozen profile path? Find every place the loop is broken, stubbed, or shadow-only. The harshest question: if I cook 10 Persian stews, does the app verifiably surface more like them tomorrow — prove it from the code or show where it breaks.' },
  { key: 'algorithm', title: 'Algorithm quality — is it real personalization or heuristics?', focus: 'Is the recommender genuinely personalized/learned, or a hand-tuned linear blend of heuristics dressed up as ML? No collaborative filtering, no embeddings, no learning? Assess: candidate generation quality, the scoring blend (are the ~10 component weights principled or arbitrary?), diversity/serendipity/exploration (or filter-bubble?), cold-start strategy, and — critically — whether the offline eval (MAP/MRR/Recall) is VALID or computed on synthetic/seeded/overfit data that proves nothing about real users. Be blunt about the gap to a modern recsys.' },
  { key: 'mindreading', title: 'The "mind-reading" gap — does it feel like it gets the user?', focus: 'The founder wants the user to feel the app reads their mind. Audit the distance honestly. Context-awareness: does it use time-of-day, season, weather, pantry, mood, occasion, prior meals this week, household? Adaptation speed: how fast does it react to new signals? Transparency: is there a real "for you / because you cooked X" explanation that builds trust? Proactivity: does it ever suggest before being asked? Rate how close the CURRENT system is to "it reads my mind" as a brutally honest %, with the specific missing capabilities.' },
  { key: 'data', title: 'Data, scale, cold-start, privacy', focus: 'Will this work with REAL users (sparse data, few events each)? How severe is cold-start and how long until personalization kicks in? Is there enough signal density for the algorithm to matter? Privacy/consent of behavior tracking (GDPR/EU — the app targets NL/EU): what is tracked, consented, retained, erasable? The "deliberate signals bypass the anti-bot gate" design — is it sound or exploitable/biased? Single-user vs population effects (no collaborative signal = every user is cold forever?).' },
  { key: 'architecture', title: 'Architecture & shippability — value vs over-engineering', focus: '108 files in recommendation/ + a shadow runtime + an experimentation lab + control-plane + founder-review. Is this real, shippable value, or elaborate scaffolding that never reaches a user (gold-plating)? Assess coupling, complexity, maintainability for a solo non-technical founder, and the ratio of code-that-serves-users to code-that-only-serves-itself. Is the sophistication earned, or a liability? What should be deleted/simplified vs kept?' },
]

const auditPrompt = (d) => `You are a skeptical Principal/Staff engineer doing a forensic, NO-FLATTERY review of a recipe app's personalization & recommendation system for a founder building toward a billion-dollar product. The founder grades hard and explicitly wants the truth without diplomacy («بدون تعارف»). Praise is worthless here; find what is broken, naive, over-engineered, or fake — with EVIDENCE.

DIMENSION: ${d.title}
${d.focus}

Read the maps in ${MAPDIR}/*.md first (the evidence base), then verify against the REAL code (Grep/Read — cite file:line for every claim; do not trust the map blindly, confirm from source). Be specific and correct: a vague criticism is as useless as flattery.

Write your findings as markdown to ${FINDDIR}/${d.key}.md with:
- a 1-paragraph blunt verdict (and where relevant, an honest % "how close to world-class / to the vision").
- findings as a table: Severity (Critical/High/Medium/Low) · Finding · Evidence (file:line) · Why it matters · Concrete fix.
- the 3 things that would most move this dimension toward world-class.
Severity Critical = the loop is broken / it doesn't actually personalize / it can't ship. Rate honestly. Return a 4-line summary {dimension, verdict, #critical, the single biggest problem}.`

// ---------- PHASE 2b: WORLD RESEARCH ----------
const RESEARCH = [
  { key: 'recsys-sota', title: 'Modern recsys SOTA for a recipe app', prompt: 'Research the state of the art in recommendation systems and which techniques fit a RECIPE app with sparse per-user data + severe cold-start + a single-market launch. Cover: content-based vs collaborative vs hybrid; two-tower / embedding retrieval; session/sequence models (e.g. SASRec/GRU4Rec); contextual bandits & exploration (Thompson/LinUCB) for cold-start; graph-based; LLM-as-recommender and LLM taste-embeddings (2024–2026); offline eval done right (temporal splits, counterfactual/IPS, avoiding leakage) and online eval (interleaving, A/B). For EACH, say honestly whether it helps a solo-founder recipe app at launch scale, the data it needs, and the cost. Cite real systems/papers where possible. Write to ' + RESDIR + '/recsys-sota.md. Be concrete, ranked by ROI for THIS app.' },
  { key: 'cooking-apps', title: 'How the best cooking apps personalize', prompt: 'Research what the best cooking/recipe apps ACTUALLY do for taste profiling, the "for you" feed, and recommendation: Yummly (taste profile + Food Genome), Samsung Food / Whisk, Mealime, SideChef, NYT Cooking, Kptncook, ChefGPT, Cookpad, Tasty. For each: how they capture taste at onboarding, what implicit/explicit signals they use, how they recommend, how they explain ("recommended because…"), context-awareness (pantry/time/diet), and where they fall short. Distill the patterns worth stealing and the bar to beat. Write to ' + RESDIR + '/cooking-apps.md. Concrete, with what to copy and what to surpass.' },
  { key: 'mind-reading-ux', title: 'The "it reads my mind" UX/design', prompt: 'Research how to make a user FEEL deeply understood by a personalization system ("it reads my mind, it became one with me"). Cover: onboarding taste capture that feels effortless (cold-start UX); blending implicit + explicit feedback; context-awareness (time, season, weather, what they cooked this week, occasion, household, mood); proactive/anticipatory suggestions; transparency + user control ("because you…", tunable preferences) and why control increases trust; adaptive speed; the emotional/affective design of "it gets me"; and the failure modes (creepiness, filter bubble, over-personalization, the cold-start cliff). Pull from recsys-UX research, Spotify/Netflix/TikTok personalization design, and HCI. Write to ' + RESDIR + '/mind-reading-ux.md. Concrete principles + patterns we can implement.' },
]

const researchPrompt = (r) => `You are a world-class researcher building the reference for a recipe app aiming to have the best food-personalization system in the world. ${r.prompt}\nBe rigorous, cite real systems/papers/apps, rank ideas by ROI for a solo-founder EU-launch recipe app, and be honest about what does NOT help at small scale. Return a 3-line summary of the top findings.`

// ---------- RUN ----------
phase('Map')
log('mapping 5 subsystem slices')
const maps = await parallel(SLICES.map((s) => () => agent(mapPrompt(s), { label: `map:${s.key}`, phase: 'Map', effort: 'high', agentType: 'Explore' })))

phase('Audit')
log('5 adversarial audits + 3 world-research threads')
const audits = parallel(DIMENSIONS.map((d) => () => agent(auditPrompt(d), { label: `audit:${d.key}`, phase: 'Audit', effort: 'high' })))
const research = parallel(RESEARCH.map((r) => () => agent(researchPrompt(r), { label: `research:${r.key}`, phase: 'Audit', effort: 'high' })))
const [auditOut, researchOut] = await Promise.all([audits, research])

phase('Synthesize')
log('synthesizing the audit report + the world standard + the roadmap')
const auditReport = await agent(
  `You are the lead author of a forensic audit report for a recipe app's personalization & recommendation system, for a hard-grading founder who wants the unvarnished truth and a billion-dollar bar.
Read ALL of: ${MAPDIR}/*.md (the system map), ${FINDDIR}/*.md (the 5 adversarial audits), and ${RESDIR}/*.md (world research). Synthesize a single, ruthless, evidence-based report.
Write to docs/audit/PERSONALIZATION_AUDIT.md (Persian-friendly headings ok, technical content precise):
- Executive verdict: an honest one-paragraph + a single headline % "how close is this to the world-class mind-reading system the founder wants" (the founder thinks it's "<10%" — assess that claim with evidence).
- What genuinely works (short, no flattery — only real strengths).
- The findings, consolidated + de-duplicated across the 5 dimensions, as one prioritized table: Severity · Finding · Evidence (file:line) · Impact · Fix. Lead with Criticals.
- The 5 biggest systemic problems, explained.
- The honest "loop closes? / it's real personalization? / it reads minds?" three-question scorecard.
Be specific, cite file:line, no diplomacy. Return a 5-line executive summary.`,
  { label: 'synth:audit-report', phase: 'Synthesize', effort: 'high' },
)
const standard = await agent(
  `You are the architect writing THE global standard + roadmap for the best food-personalization & recommendation system in the world, for an app that wants users to feel it reads their mind.
Read ${MAPDIR}/*.md, ${FINDDIR}/*.md, ${RESDIR}/*.md, and docs/audit/PERSONALIZATION_AUDIT.md.
Write TWO documents:
1) docs/audit/PERSONALIZATION_STANDARD.md — "The Garnish Personalization & Recommendation Standard": the principles + reference architecture a world-class (better-than-Yummly/Spotify-for-food) system must have — signal model, user taste model (incl. taste embeddings), candidate generation, ranking (hybrid + learning + bandits for cold-start + diversity), context-awareness, transparency/control, evaluation, privacy. Make it the document competitors would envy. Each section: principle → why → how Garnish should implement it concretely (reuse what exists where sound).
2) docs/audit/PERSONALIZATION_ROADMAP.md — a brutally prioritized path from the CURRENT system (per the audit) to the standard: phased (now / next / later), each item with the expected user-felt impact ("it gets me"), effort, and dependency. Include 8-12 concrete BEYOND-STANDARD ideas that would make Garnish a tier above everyone (e.g. taste embeddings from cook history, context engine, conversational preference capture, anticipatory meal suggestions, transparent tunable taste-DNA). Rank by impact×feasibility for a solo founder.
Be concrete and ambitious but honest about effort. Return a 6-line summary of the standard's pillars + the top 3 roadmap moves.`,
  { label: 'synth:standard-roadmap', phase: 'Synthesize', effort: 'high' },
)

return {
  maps: maps.filter(Boolean).length,
  audits: auditOut.filter(Boolean).length,
  research: researchOut.filter(Boolean).length,
  reportSummary: auditReport,
  standardSummary: standard,
}
