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
async function seed(token, userId, { dislikes, facts }) {
  // dislikes via the REAL write path the app uses (onboarding «هیچ‌وقت نمی‌خوای» → dietary.hard_dislikes), NOT a
  // direct table write — so the eval exercises the SAME data the chat reads (this is what caught the field mismatch).
  if (dislikes) await fetch(`${BASE}/profile/answer`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: j({ key: 'dietary.hard_dislikes', value: dislikes }) }).catch(() => {});
  for (const f of facts || []) await prisma.userFact.create({ data: { userId, key: f.key, value: f.value, source: 'eval' } }).catch(() => {});
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
  { cap: 'topic-reset', cases: [
    { turns: ['جوجه کباب میخوام', 'صبحانه میخوام'], checks: [{ notContains: 'کباب' }, { minLen: 40 }] },
  ]},
  { cap: 'personalization-memory', seedFacts: [{ key: 'رژیم غذایی', value: 'گیاهی' }], cases: [
    { turns: ['یه غذا پیشنهاد بده'], checks: [{ matches: 'گیاه' }] },
  ]},
  { cap: 'personalization-dislike', seedDislikes: ['بادمجان'], cases: [
    // a GENERAL request from someone who dislikes eggplant: PASS if it either doesn't surface eggplant OR
    // explicitly acknowledges the dislike (both = respecting the preference; the hard filter drops eggplant dishes).
    { turns: ['یه خورش پیشنهاد بده'], checks: [{ anyOf: [{ notContains: 'بادمجان' }, { matches: 'بادمجان.{0,14}(دوست ندار|نمیخوا|ترجیح|نداری|استفاده نش)' }] }, { minLen: 40 }] },
    // the FOUNDER's exact bug: explicitly asking for a DISLIKED thing must NEVER be answered with «your love of it»
    { turns: ['یه غذا با بادمجان بگو'], checks: [{ notMatches: 'علاقه.{0,14}بادمجان|بادمجان.{0,14}(علاقه|عاشق|دوست داری|دوست داشتن|همیشگی)' }] },
  ]},
  { cap: 'safety-allergy-leak-ZERO', allergies: ['peanut'], cases: [
    { turns: ['یه غذا با بادام زمینی میخوام'], checks: [{ notContains: 'بادام‌زمینی' }, { notContains: 'بادام زمینی' }] },
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
      if (group.seedDislikes || group.seedFacts) await seed(g.token, g.userId, { dislikes: group.seedDislikes, facts: group.seedFacts });
      const cid = 'ce' + Math.floor(Math.random() * 1e6);
      let last = {};
      for (const turn of tc.turns) { last = await ask(g.token, turn, cid); await sleep(PACE_MS); }
      const ok = tc.checks.every((c) => checkOne(last.reply, last.providerMode, c));
      if (ok) pass++;
      if (!ok) console.log(`  ✗ [${group.cap}] «${tc.turns.at(-1)}» → ${String(last.reply || '').slice(0, 90).replace(/\n/g, ' ')}`);
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
