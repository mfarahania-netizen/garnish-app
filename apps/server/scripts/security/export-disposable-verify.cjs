/**
 * E39-1D — Disposable-DB GDPR-export integration verification.
 *
 * Proves the REAL (compiled) UserExportService.exportUser works against real Prisma relations and —
 * critically for an export endpoint — that it leaks NEITHER secrets (password hash, AICallLog.errorMessage)
 * NOR any other user's data. Runs on a throwaway DB; never touches real data.
 *
 * Run:  node --env-file=.env scripts/security/export-disposable-verify.cjs
 * Exit: 0 = all checks pass, 1 = any failure / guard abort.
 */
require('reflect-metadata');
const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const { UserExportService } = require('../../dist/src/users/export/user-export.service.js');

const TEST_DB = 'garnish_export_verify';
// markers that must NEVER appear in the export (secrets / other-user data)
const FORBIDDEN = ['HASHEDPW_TARGET', 'HASHEDPW_BYSTANDER', 'AICALL_ERR_LEAK_MARKER', 'BYSTANDER_CHAT_MARKER', 'bystander-export@example.com'];
// markers that SHOULD appear (the target's own data)
const EXPECTED = ['TARGET_CHAT_OWN_DATA', 'target-export@example.com'];

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

    // ---- seed target (T) with PII + secret markers, and a bystander (B) ----
    const experiment = await prisma.experiment.create({ data: { name: 'exp', variantA: {}, variantB: {} } });
    const recipeCat = await prisma.recipe.create({ data: { title: 'Catalog', category: 'main', isPublic: true } });

    const T = await prisma.user.create({ data: { phone: '+989000000001', email: 'target-export@example.com', name: 'Target', password: 'HASHEDPW_TARGET' } });
    const B = await prisma.user.create({ data: { phone: '+989000000002', email: 'bystander-export@example.com', name: 'Bystander', password: 'HASHEDPW_BYSTANDER' } });

    await prisma.recipe.create({ data: { title: 'T Recipe', category: 'main', authorId: T.id } });
    await prisma.userPreference.create({ data: { userId: T.id, diet: 'omnivore' } });
    await prisma.consentLog.create({ data: { userId: T.id, type: 'analytics', ip: '203.0.113.50' } });
    await prisma.userSession.create({ data: { userId: T.id, device: 'd', ip: '203.0.113.50' } });
    await prisma.userEvent.create({ data: { userId: T.id, type: 'page_view', page: '/home' } });
    await prisma.userBehaviorProfile.create({ data: { userId: T.id, cookingSkill: 'beginner' } });
    await prisma.userBehaviorSignal.create({ data: { userId: T.id, signalName: 's', signalDomain: 'd', signalType: 't' } });
    await prisma.userHealthSnapshot.create({ data: { userId: T.id, goalCompletionRate: 0.5 } });
    await prisma.chatMessage.create({ data: { userId: T.id, conversationId: 'c1', role: 'user', content: 'TARGET_CHAT_OWN_DATA' } });
    await prisma.userFact.create({ data: { userId: T.id, key: 'diet', value: { v: 1 }, source: 'test' } });
    await prisma.aICallLog.create({ data: { userId: T.id, model: 'stub', provider: 'stub', status: 'error', guardHits: [], toolCalls: [], metadata: { ok: true }, errorMessage: 'AICALL_ERR_LEAK_MARKER', estimatedInputTokens: 42 } });
    const mp = await prisma.mealPlan.create({ data: { userId: T.id, weekStart: new Date('2026-06-01T00:00:00Z') } });
    await prisma.mealSlot.create({ data: { mealPlanId: mp.id, dayOfWeek: 1, mealType: 'lunch', recipeId: recipeCat.id } });
    const sl = await prisma.shoppingList.create({ data: { userId: T.id, name: 'List' } });
    await prisma.shoppingItem.create({ data: { shoppingListId: sl.id, name: 'Salt' } });
    await prisma.favoriteRecipe.create({ data: { userId: T.id, recipeId: recipeCat.id } });
    await prisma.notification.create({ data: { userId: T.id, title: 'hi', body: 'b', type: 'info' } });
    await prisma.supportTicket.create({ data: { userId: T.id, subject: 's', message: 'm' } });
    await prisma.dataAccessLog.create({ data: { userId: T.id, resource: 'profile', action: 'read', ip: '203.0.113.50' } });
    await prisma.experimentAssignment.create({ data: { userId: T.id, experimentId: experiment.id, variant: 'A' } });

    // bystander data (must NOT appear in T's export)
    await prisma.chatMessage.create({ data: { userId: B.id, conversationId: 'cb', role: 'user', content: 'BYSTANDER_CHAT_MARKER' } });
    await prisma.consentLog.create({ data: { userId: B.id, type: 'analytics', ip: '198.51.100.9' } });

    // ---- run the REAL export ----
    const exp = await new UserExportService(prisma).exportUser(T.id);
    const serialized = JSON.stringify(exp);
    console.log(`[export] version=${exp.exportVersion} included=${exp.metadata.includedSections.length} omitted=${exp.metadata.omittedSections.length} bytes=${serialized.length}`);

    // ---- verify ----
    check('exportVersion v1 + correct userId', exp.exportVersion === 'v1' && exp.userId === T.id);
    check('subject is the safe allow-list (no password / extra keys)',
      exp.subject && !('password' in exp.subject) && Object.keys(exp.subject).every((k) => ['id', 'phone', 'name', 'email', 'avatar', 'isAdmin', 'createdAt'].includes(k)),
      `keys=${Object.keys(exp.subject || {}).join(',')}`);

    const leaked = FORBIDDEN.filter((m) => serialized.includes(m));
    check('NO secret / other-user data leaks into the export', leaked.length === 0, leaked.length ? `LEAKED: ${leaked.join(', ')}` : 'none of the forbidden markers present');
    const missing = EXPECTED.filter((m) => !serialized.includes(m));
    check("target's OWN data is present (chat content + email)", missing.length === 0, missing.length ? `missing: ${missing.join(', ')}` : 'present');

    // AICallLog must not carry errorMessage
    const callLogs = exp.sections.ai && exp.sections.ai.callLogs;
    check('AICallLog export excludes errorMessage', Array.isArray(callLogs) && callLogs.length === 1 && !('errorMessage' in callLogs[0]),
      callLogs && callLogs[0] ? `keys=${Object.keys(callLogs[0]).join(',')}` : 'no callLogs');
    check('AICallLog export keeps token COUNT field (not dropped as secret)', Array.isArray(callLogs) && callLogs[0] && callLogs[0].estimatedInputTokens === 42);

    // representative section population
    const s = exp.sections;
    check('core sections populated (profile/preferences/consents/sessions/events)',
      s.profile && s.preferences.preference && s.consents.length === 1 && s.sessions.length === 1 && s.events.length === 1);
    check('behavior + ai + commerce sections populated',
      s.behavior.profile && s.behavior.snapshots.health && s.ai.chatMessages.length === 1 && s.ai.userFacts.length === 1
      && s.mealPlans.length === 1 && s.shopping.length === 1 && s.favorites.length === 1 && s.notifications.length === 1 && s.support.length === 1 && s.authoredRecipes.length === 1);
    check('analytics section populated (dataAccessLogs + experimentAssignments)', s.analytics.dataAccessLogs.length === 1 && s.analytics.experimentAssignments.length === 1);
    check('no omitted sections / all modules present', exp.metadata.omittedSections.length === 0, `omitted=${JSON.stringify(exp.metadata.omittedSections)}`);

    // confirm consent export contains ONLY target's consent (1 row), not bystander's
    check("consents scoped to target only (bystander's consent absent)", s.consents.length === 1 && s.consents[0].ip === '203.0.113.50');

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
