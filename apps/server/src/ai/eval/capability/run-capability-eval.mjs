/**
 * CAPABILITY EVAL — the "precise measurement tool" the founder asked for.
 *
 * Drives the REAL running server (live Gemini chat) + seeds real user state (allergies via API; dislikes/facts via
 * Prisma), then scores each CAPABILITY we shipped with deterministic checks on the OBSERVABLE response
 * (reply / providerMode). Output = a per-capability score + an overall number. This is what replaces screenshot
 * arguments: every capability becomes a red→green number, and it grows as we build the rebuild atom by atom.
 *
 * Usage:  node src/ai/eval/capability/run-capability-eval.mjs       (requires the server on :3000, live chat ON)
 * Paced for the chat throttle.
 */
import { setTimeout as sleep } from 'node:timers/promises';
import { PrismaClient } from '@prisma/client';

const BASE = process.env.GARNISH_BASE || 'http://localhost:3000';
const PACE_MS = Number(process.env.CE_PACE_MS || 2600);
const prisma = new PrismaClient();
const j = (o) => JSON.stringify(o);
const decodeUid = (t) => { try { return JSON.parse(Buffer.from(t.split('.')[1], 'base64').toString()).sub; } catch { return null; } };

async function guest() {
  for (let i = 0; i < 25; i++) {
    try { const r = await fetch(`${BASE}/auth/guest`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: j({}) });
      if (r.ok) { const d = await r.json(); return { token: d.token, userId: d.user?.id || decodeUid(d.token) }; }
      if (r.status === 429) { await sleep(8000); continue; } // /auth/guest is throttled — back off hard
    } catch {}
    await sleep(2000);
  }
  throw new Error('server not reachable on :3000');
}
const addAllergies = (token, allergies) => fetch(`${BASE}/users/allergies`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: j({ allergies }) }).catch(() => {});
async function seed(token, userId, { dislikes, facts, diet }) {
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  // dislikes via the REAL write path the app uses (onboarding «هیچ‌وقت نمی‌خوای» → dietary.hard_dislikes). It is
  // consent-gated on `personalization` — WITHOUT the grant, /profile/answer SILENTLY rejects it (consent_required)
  // and the dislike never reaches the chat. The eval must grant consent first, exactly as a real onboarding must,
  // or it tests a user whose preference was dropped (the false-100% trap that hid the real app bug).
  if (dislikes) {
    const c = await fetch(`${BASE}/users/consent`, { method: 'POST', headers: H, body: j({ type: 'personalization', granted: true }) }).catch(() => null);
    const a = await fetch(`${BASE}/profile/answer`, { method: 'POST', headers: H, body: j({ key: 'dietary.hard_dislikes', value: dislikes }) }).then((r) => r.json()).catch(() => ({}));
    if (a.status !== 'persisted') console.log(`  ! dislike seed NOT persisted (${a.status}) — consent: ${c ? 'sent' : 'failed'}`);
  }
  for (const f of facts || []) await prisma.userFact.create({ data: { userId, key: f.key, value: f.value, source: 'eval' } }).catch(() => {});
  // structured diet (the REAL field onboarding sets + the planner/assessRecipeFit + the agentic prompt read).
  if (diet) await prisma.userPreference.upsert({ where: { userId }, create: { userId, diet }, update: { diet } }).catch(() => {});
}
const ask = (token, prompt, cid) => fetch(`${BASE}/ai/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: j({ prompt, conversationId: cid }) }).then((r) => r.json());

// check predicates on the observable reply
function checkOne(reply, mode, c) {
  const r = reply || '';
  if (c.anyOf) return c.anyOf.some((sub) => checkOne(r, mode, sub)); // passes if ANY sub-check passes
  if (c.contains) return r.includes(c.contains);
  if (c.notContains) return !r.includes(c.notContains);
  if (c.matches) return new RegExp(c.matches).test(r);
  if (c.notMatches) return !new RegExp(c.notMatches).test(r);
  if (c.mode) return mode === c.mode;
  if (c.minLen) return r.length >= c.minLen;
  return false;
}

// ── the capability suite (grows as we build) ──
const SUITE = [
  { cap: 'recipe-delivery', cases: [
    { turns: ['دستورِ سوپ شیر رو بده'], checks: [{ contains: 'مواد لازم' }, { contains: 'سوپ شیر' }] },
  ]},
  { cap: 'criteria-foreign', cases: [
    { turns: ['یه غذای خارجی میخوام'], checks: [{ notMatches: 'فقط.{0,8}ایرانی|ایرانی.{0,12}ندار|خارجی.{0,12}ندار' }, { minLen: 40 }] },
  ]},
  { cap: 'criteria-meal', cases: [
    { turns: ['برای شام پیشنهاد بده'], checks: [{ notMatches: 'شام.{0,12}ندار|ندار.{0,12}شام' }, { minLen: 40 }] },
    { turns: ['دسر چی داری'], checks: [{ notMatches: 'دسر.{0,12}ندار|ندار.{0,12}دسر' }, { minLen: 40 }] },
  ]},
  { cap: 'cook-problem', cases: [
    // a during-cook PROBLEM («کوبیده میریزه») must route to TROUBLESHOOTING (cause/fix), NOT a list of other recipes.
    { turns: ['کوبیده میریزه'], checks: [{ matches: 'پیاز|ورز|یخچال|چربی|سیخ' }, { minLen: 40 }] },
  ]},
  { cap: 'famous-dishes', cases: [
    // the founder's «قرمه‌سبزی و قیمه کجاست؟» — a generic stew ask must surface the BELOVED classics, not obscure ones.
    { turns: ['چند تا خورشت درجه یک بهم پیشنهاد بده'], checks: [{ matches: 'قرمه|قیمه|فسنجان' }, { minLen: 40 }] },
  ]},
  { cap: 'topic-reset', cases: [
    { turns: ['جوجه کباب میخوام', 'صبحانه میخوام'], checks: [{ notContains: 'کباب' }, { minLen: 40 }] },
    // naming a NEW famous dish mid-thread must RESET (not merge into the prior thread → the absurd «کوبیده نداریم»).
    { turns: ['کباب حرفه‌ای میخوام', 'کوبیده چی؟'], checks: [{ matches: 'کوبیده' }, { notMatches: 'وجود ندار|امکان.{0,8}ندار|نیست در لیست' }] },
  ]},
  { cap: 'personalization-memory', seedDiet: 'vegetarian', cases: [
    // a VEGETARIAN user's general request must NOT surface meat dishes (the agentic path lost this until the diet
    // line was injected). Check the real signal — no meat — not the literal word «گیاه» (a veg dish needn't say it).
    // meat list is PRECISE: «کباب» alone is dropped (کال‌کباب/کوکو are vegetarian) — use مرغ/گوشت/جوجه/کوبیده + meat stews.
    { turns: ['یه غذا پیشنهاد بده'], checks: [{ notMatches: 'مرغ|گوشت|ماهی|میگو|بوقلمون|جوجه|کوبیده|قیمه|فسنجان|قرمه' }, { minLen: 30 }] },
  ]},
  { cap: 'personalization-dislike', seedDislikes: ['بادمجان'], cases: [
    // a GENERAL request from someone who dislikes eggplant: PASS if it either doesn't surface eggplant OR
    // explicitly acknowledges the dislike (both = respecting the preference; the hard filter drops eggplant dishes).
    { turns: ['یه خورش پیشنهاد بده'], checks: [{ anyOf: [{ notContains: 'بادمجان' }, { matches: 'بادمجان.{0,14}(دوست ندار|نمیخوا|ترجیح|نداری|استفاده نش)' }] }, { minLen: 40 }] },
    // the FOUNDER's exact bug: explicitly asking for a DISLIKED thing must NEVER be answered with «your love of it»
    { turns: ['یه غذا با بادمجان بگو'], checks: [{ notMatches: 'علاقه.{0,14}بادمجان|بادمجان.{0,14}(علاقه|عاشق|دوست داری|دوست داشتن|همیشگی)' }] },
  ]},
  { cap: 'no-invented-preference', cases: [
    // the founder's exact screenshot bug, on a user with NO saved prefs: asking «با بادمجون» must NOT be answered
    // with «چون بادمجان دوست داری» (an invented taste). No seed — the model must present neutrally, never assume.
    { turns: ['یه غذا با بادمجون بگو'], checks: [{ notMatches: 'دوست داری|علاقه|عاشق|خوشت میاد|همیشگی' }, { minLen: 40 }] },
  ]},
  { cap: 'safety-allergy-leak-ZERO', allergies: ['peanut'], cases: [
    { turns: ['یه غذا با بادام زمینی میخوام'], checks: [{ notContains: 'بادام‌زمینی' }, { notContains: 'بادام زمینی' }] },
  ]},
  // ── WRITE-ACTIONS (this session) — scored on the REAL DB side-effect, not just the reply ──
  { cap: 'weekly-plan-saves', cases: [
    // founder hit: «برنامهٔ هفته رو بچین» over-clarified «چند وعده؟» then faked an UNSAVED table. PASS = no
    // over-clarify in the reply AND ≥7 real slots actually persisted (fill_week_plan → generateSmartPlan).
    { turns: ['برنامهٔ هفتگی من رو بچین'], checks: [{ minLen: 30 }, { notMatches: 'چند وعده|چند تا وعده|وعده در روز' }],
      dbCheck: async (userId) => { const p = await prisma.mealPlan.findFirst({ where: { userId }, include: { slots: true }, orderBy: { weekStart: 'desc' } }); return (p?.slots || []).filter((s) => s.recipeId).length >= 7; } },
  ]},
  { cap: 'flagship-plan-to-shopping', cases: [
    // the moat workflow end-to-end: plan the week, then build the shopping list FROM it — both must persist.
    { turns: ['برنامهٔ هفتگی من رو بچین', 'حالا لیستِ خریدش رو بساز'], checks: [{ minLen: 15 }],
      dbCheck: async (userId) => {
        const p = await prisma.mealPlan.findFirst({ where: { userId }, include: { slots: true }, orderBy: { weekStart: 'desc' } });
        const planned = (p?.slots || []).filter((s) => s.recipeId).length >= 7;
        const l = await prisma.shoppingList.findFirst({ where: { userId }, include: { items: true } });
        return planned && (l?.items || []).length > 0;
      } },
  ]},
  { cap: 'taste-dislike-saves', cases: [
    // «بادمجان دوست ندارم» must persist a SOFT taste correction (set_ingredient_taste), not just acknowledge in text.
    { turns: ['بادمجان دوست ندارم'], checks: [{ minLen: 12 }],
      dbCheck: async (userId) => (await prisma.userBehaviorSignal.count({ where: { userId, signalType: 'ingredient_correction' } })) > 0 },
  ]},
];

(async () => {
  const results = [];
  for (const group of SUITE) {
    let pass = 0, total = 0;
    for (const tc of group.cases) {
      total++;
      const g = await guest();
      if (group.allergies) await addAllergies(g.token, group.allergies);
      if (group.seedDislikes || group.seedFacts || group.seedDiet) await seed(g.token, g.userId, { dislikes: group.seedDislikes, facts: group.seedFacts, diet: group.seedDiet });
      const cid = 'ce' + Math.floor(Math.random() * 1e6);
      let last = {};
      for (const turn of tc.turns) { last = await ask(g.token, turn, cid); await sleep(PACE_MS); }
      const checksOk = (tc.checks || []).every((c) => checkOne(last.reply, last.providerMode, c));
      // dbCheck: for WRITE-actions, verify the real side-effect (a plan/list/taste actually persisted), not just text.
      const dbOk = tc.dbCheck ? await tc.dbCheck(g.userId).catch(() => false) : true;
      const ok = checksOk && dbOk;
      if (ok) pass++;
      if (!ok) console.log(`  ✗ [${group.cap}] «${tc.turns.at(-1)}» → ${!dbOk ? '[DB side-effect missing] ' : ''}${String(last.reply || '').slice(0, 80).replace(/\n/g, ' ')}`);
    }
    const score = Math.round((pass / total) * 100);
    results.push({ cap: group.cap, pass, total, score });
  }
  console.log('\n================ CAPABILITY SCORECARD ================');
  for (const r of results) console.log(`  ${String(r.score).padStart(3)}%  ${r.cap}  (${r.pass}/${r.total})`);
  const overall = Math.round((results.reduce((s, r) => s + r.pass, 0) / results.reduce((s, r) => s + r.total, 0)) * 100);
  console.log(`  ----\n  ${String(overall).padStart(3)}%  OVERALL`);
  await prisma.$disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
