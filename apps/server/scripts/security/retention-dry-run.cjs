/**
 * E39-1E — Disposable-DB retention DRY-RUN verification.
 *
 * Proves the REAL (compiled) RetentionService.previewRetention():
 *   - counts only OLD rows (> cutoff) in standard_365d models, ignores recent rows,
 *   - EXCLUDES audit_long + user_owned_active rows entirely,
 *   - DELETES NOTHING (row counts identical before/after),
 *   - refuses destructive execution (default-safe).
 * Runs on a throwaway DB; never touches real data.
 *
 * Run:  node --env-file=.env scripts/security/retention-dry-run.cjs
 * Exit: 0 = all checks pass, 1 = any failure / guard abort.
 */
require('reflect-metadata');
const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const { RetentionService } = require('../../dist/src/retention/retention.service.js');

const TEST_DB = 'garnish_retention_verify';
const DAY = 24 * 60 * 60 * 1000;

const results = [];
const check = (name, pass, detail = '') => { results.push({ name, pass: !!pass }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const redact = (s, sec) => (sec ? String(s).split(sec).join('***') : String(s));

async function main() {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) throw new Error('DATABASE_URL not set (run with: node --env-file=.env ...)');
  const baseDbName = new URL(baseUrl).pathname.replace(/^\//, '');
  if (baseDbName === TEST_DB) throw new Error(`Refusing to run: base DB is the disposable name ${TEST_DB}`);
  const u = new URL(baseUrl); u.pathname = '/' + TEST_DB; const testUrl = u.toString();
  const testSecret = new URL(testUrl).password;

  const admin = new PrismaClient();
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
  await admin.$executeRawUnsafe(`CREATE DATABASE ${TEST_DB}`);
  await admin.$disconnect();
  console.log(`[provision] created disposable DB "${TEST_DB}" (base DB "${baseDbName}" untouched)`);

  try {
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
      cwd: process.cwd(), env: { ...process.env, DATABASE_URL: testUrl }, stdio: ['ignore', 'ignore', 'pipe'],
    });
  } catch (e) {
    throw new Error(`prisma db push failed (password redacted):\n${redact((e.stderr || e.stdout || e.message || '').toString(), testSecret)}`);
  }
  console.log('[provision] schema pushed');

  const prisma = new PrismaClient({ datasources: { db: { url: testUrl } } });
  let failedHard = false;
  try {
    const cur = await prisma.$queryRawUnsafe('SELECT current_database() AS db');
    if (cur[0].db !== TEST_DB || cur[0].db === baseDbName) throw new Error(`SAFETY ABORT: connected to ${cur[0].db}`);
    check('safety: connected to disposable DB only', true, `current_database()=${cur[0].db}`);

    const now = new Date();
    const old = new Date(now.getTime() - 400 * DAY); // older than the 365d cutoff
    const recent = new Date(now.getTime() - 10 * DAY); // within retention

    // ---- seed ----
    const T = await prisma.user.create({ data: { phone: '+989000000001', email: 'r@example.com', name: 'R' } });
    const recipe = await prisma.recipe.create({ data: { title: 'R', category: 'main' } });

    // standard_365d prune candidates: 2 OLD + 1 RECENT userEvent → expect candidate count 2
    await prisma.userEvent.create({ data: { userId: T.id, type: 'a', timestamp: old } });
    await prisma.userEvent.create({ data: { userId: T.id, type: 'b', timestamp: old } });
    await prisma.userEvent.create({ data: { userId: T.id, type: 'c', timestamp: recent } });
    await prisma.recommendationExposure.create({ data: { userId: T.id, recipeId: recipe.id, viewedAt: old } });
    await prisma.recommendationMetrics.create({ data: { metricDate: old, windowDays: 7 } });

    // EXCLUDED classes (must never be counted), all OLD:
    // audit_long + user_owned_active (incl. preferenceHistory — reclassified as user-owned audit trail)
    await prisma.consentLog.create({ data: { userId: T.id, type: 'analytics', createdAt: old } });
    await prisma.userAuditLog.create({ data: { userId: T.id, action: 'login', createdAt: old } });
    await prisma.chatMessage.create({ data: { userId: T.id, conversationId: 'c', role: 'user', content: 'x', createdAt: old } });
    await prisma.preferenceHistory.create({ data: { userId: T.id, fieldName: 'diet', changedAt: old } });

    // ---- before counts ----
    const before = {
      userEvent: await prisma.userEvent.count(),
      consentLog: await prisma.consentLog.count(),
      userAuditLog: await prisma.userAuditLog.count(),
      chatMessage: await prisma.chatMessage.count(),
    };

    // ---- run the REAL dry-run ----
    const preview = await new RetentionService(prisma).previewRetention(now);
    console.log(`[dry-run] mode=${preview.mode} destructiveEnabled=${preview.destructiveEnabled} totalCandidates=${preview.totalCandidates}`);

    const byModel = Object.fromEntries(preview.candidates.map((c) => [c.model, c.candidateCount]));
    check('dry-run mode + destructive disabled', preview.mode === 'dry-run' && preview.destructiveEnabled === false);
    check('userEvent: only OLD rows counted (2 of 3)', byModel.userEvent === 2, `count=${byModel.userEvent}`);
    check('recommendationExposure OLD counted (1)', byModel.recommendationExposure === 1, `count=${byModel.recommendationExposure}`);
    check('recommendationMetrics OLD counted (1)', byModel.recommendationMetrics === 1, `count=${byModel.recommendationMetrics}`);
    check('unseeded prunable model = 0 candidates', byModel.userSession === 0 && byModel.signalObservation === 0);

    const candidateModels = preview.candidates.map((c) => c.model);
    check('audit_long NOT in candidates (consentLog/userAuditLog/erasureEvent/dataAccessLog/aICallLog)',
      ['consentLog', 'userAuditLog', 'erasureEvent', 'dataAccessLog', 'aICallLog'].every((m) => !candidateModels.includes(m)));
    check('user_owned_active NOT in candidates (chatMessage/userFact/mealPlan/user/preferenceHistory)',
      ['chatMessage', 'userFact', 'mealPlan', 'user', 'preferenceHistory'].every((m) => !candidateModels.includes(m)));
    check('review_required NOT in candidates (snapshots/reference)',
      ['userEngagementSnapshot', 'ingredient', 'experimentAssignment'].every((m) => !candidateModels.includes(m)));
    check('excluded lists populated', preview.excluded.audit_long.includes('consentLog') && preview.excluded.user_owned_active.includes('chatMessage'));

    // ---- NOTHING deleted ----
    const after = {
      userEvent: await prisma.userEvent.count(),
      consentLog: await prisma.consentLog.count(),
      userAuditLog: await prisma.userAuditLog.count(),
      chatMessage: await prisma.chatMessage.count(),
    };
    check('NO rows deleted (counts identical before/after)',
      after.userEvent === before.userEvent && after.consentLog === before.consentLog && after.userAuditLog === before.userAuditLog && after.chatMessage === before.chatMessage,
      `before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);

    // ---- destructive refused ----
    let refused = false;
    try { await new RetentionService(prisma).executeRetention(); } catch (e) { refused = /REFUSED/.test(e.message); }
    check('executeRetention refuses by default (no flag)', refused);

    // PII-free output
    check('preview output is PII-free', !JSON.stringify(preview).includes('@') && !/\b(ip|email|password)\b/i.test(JSON.stringify(preview)));

    const failed = results.filter((r) => !r.pass);
    console.log(`\n=== SUMMARY: ${results.length - failed.length}/${results.length} checks passed ===`);
    if (failed.length) { console.log('FAILED:', failed.map((f) => f.name).join(' | ')); failedHard = true; }
  } finally {
    await prisma.$disconnect();
    try {
      const admin2 = new PrismaClient();
      await admin2.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
      await admin2.$disconnect();
      console.log(`[cleanup] dropped disposable DB "${TEST_DB}"`);
    } catch (e) {
      console.error(`[cleanup] WARNING: failed to drop "${TEST_DB}" — drop manually. Reason:`, redact(e.message, testSecret));
    }
  }
  process.exit(failedHard ? 1 : 0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
