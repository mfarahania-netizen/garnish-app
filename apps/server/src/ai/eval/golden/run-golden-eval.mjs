/**
 * D1 GOLDEN EVAL — live runner (fa first batch).
 *
 * Drives the REAL, running server (/auth/guest + /ai/chat) over the curated golden cases and checks each
 * response deterministically (the chat API exposes reply / suggestedAction / safetyStatus — NOT intent — so
 * every check is on observable output). Measures the deterministic assistant end-to-end against the real DB:
 * this is the thing that turns D1 claims from "built" to "measured" and surfaces real bugs (it found
 * dessert→chicken). No live LLM is involved (chat stays deterministic by default).
 *
 * Usage:  node src/ai/eval/golden/run-golden-eval.mjs            (all cases)
 *         node src/ai/eval/golden/run-golden-eval.mjs bug        (only failures, compact)
 * Requires the server on :3000. Paced for the 20/min chat throttle (~3.2s/turn).
 */
import { setTimeout as sleep } from 'node:timers/promises';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASE = process.env.GARNISH_BASE || 'http://localhost:3000';
const PACE_MS = Number(process.env.GE_PACE_MS || 3200);
const here = dirname(fileURLToPath(import.meta.url));
const onlyBugs = process.argv[2] === 'bug';

const j = (o) => JSON.stringify(o);
async function guest() {
  const r = await fetch(`${BASE}/auth/guest`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: j({}) });
  const d = await r.json();
  return { token: d.token, userId: d.user?.id };
}
async function addAllergies(token, allergies) {
  await fetch(`${BASE}/users/allergies`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: j({ allergies }) });
}
async function ask(token, prompt, conversationId) {
  const r = await fetch(`${BASE}/ai/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: j({ prompt, conversationId }) });
  return r.json();
}

// ── check interpreter — every predicate is on the observable response ──
function evalChecks(resp, checks) {
  const reply = String(resp?.reply ?? '');
  const fails = [];
  for (const c of checks) {
    if (c.replyIncludesAny && !c.replyIncludesAny.some((s) => reply.includes(s))) fails.push(`expected ANY of [${c.replyIncludesAny.join(' | ')}]`);
    if (c.replyIncludesAll) for (const s of c.replyIncludesAll) if (!reply.includes(s)) fails.push(`missing «${s}»`);
    if (c.replyExcludes) for (const s of c.replyExcludes) if (reply.includes(s)) fails.push(`MUST NOT contain «${s}»`);
    if (c.suggestedActionIs !== undefined) {
      const got = resp?.suggestedAction?.type ?? null;
      if (got !== c.suggestedActionIs) fails.push(`suggestedAction ${got} ≠ ${c.suggestedActionIs}`);
    }
    if (c.suggestedAllergen) {
      const toks = (resp?.suggestedAction?.allergens ?? []).map((a) => a.token);
      if (!toks.includes(c.suggestedAllergen)) fails.push(`suggested allergens [${toks.join(',')}] missing ${c.suggestedAllergen}`);
    }
    if (c.safetyStatusIs && resp?.safetyStatus !== c.safetyStatusIs) fails.push(`safetyStatus ${resp?.safetyStatus} ≠ ${c.safetyStatusIs}`);
  }
  return fails;
}

async function main() {
  const cases = JSON.parse(await readFile(join(here, 'golden-eval-fa.json'), 'utf8'));
  const shared = await guest();
  if (!shared.token) { console.error('FATAL: could not mint a guest (throttled?). Retry in a minute.'); process.exit(1); }

  const results = [];
  let n = 0;
  for (const c of cases) {
    n++;
    let token = shared.token;
    if (c.allergies?.length) { const gx = await guest(); token = gx.token; if (token) await addAllergies(token, c.allergies); await sleep(PACE_MS); }
    const turns = c.turns ?? [c.prompt];
    const convo = `ge-${c.id}`;
    let resp;
    for (const p of turns) { resp = await ask(token, p, convo); await sleep(PACE_MS); }
    const fails = token ? evalChecks(resp, c.checks) : ['no token (throttled)'];
    results.push({ id: c.id, category: c.category, passed: fails.length === 0, fails, reply: String(resp?.reply ?? '').replace(/\n+/g, ' ').slice(0, 120) });
    if (!onlyBugs) process.stdout.write(fails.length ? 'x' : '.');
  }

  // ── report ──
  const byCat = {};
  for (const r of results) { (byCat[r.category] ??= { pass: 0, fail: 0 }); byCat[r.category][r.passed ? 'pass' : 'fail']++; }
  const pass = results.filter((r) => r.passed).length;
  console.log(`\n\n=== GOLDEN EVAL (fa) — ${pass}/${results.length} passed ===`);
  for (const [cat, s] of Object.entries(byCat).sort()) console.log(`  ${s.fail ? 'x' : '✓'} ${cat}: ${s.pass}/${s.pass + s.fail}`);
  const failures = results.filter((r) => !r.passed);
  if (failures.length) {
    console.log(`\n--- ${failures.length} FAILURES ---`);
    for (const f of failures) console.log(`\n[${f.id}] (${f.category})\n  fails: ${f.fails.join(' ; ')}\n  reply: ${f.reply}`);
  }
}
main().catch((e) => { console.error('ERR', e); process.exit(1); });
