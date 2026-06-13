/**
 * E39-1C-VERIFY-DISPOSABLE-DB-ERASURE-INTEGRATION
 *
 * Integration proof that the REAL (compiled) ErasureService.eraseUser works against real Prisma
 * relations — Cascade deletes, SetNull tombstones, and residual-PII scrub — on a DISPOSABLE database.
 *
 * Safety model (defence in depth — never touches real data):
 *   1. Creates a brand-new throwaway database `garnish_erasure_verify` (separate from `garnish_db`).
 *   2. Pushes the current schema to it (prisma db push) — password passed via env, never logged.
 *   3. Hard guard: refuses to seed/erase unless `SELECT current_database()` === the disposable DB
 *      (and explicitly NOT `garnish_db`).
 *   4. Schema-aware FK guard: enumerates every FK referencing "User" from information_schema and
 *      asserts 0 Restrict/NoAction (deletion can't be blocked) and that the Cascade/SetNull counts
 *      match the script's table lists — so future schema drift cannot silently false-pass.
 *   5. Seeds an isolated TARGET user + a BYSTANDER user, erases ONLY the target, asserts the
 *      bystander is untouched (PII preserved).
 *   6. Drops the disposable database at the end (best-effort, guarded).
 *
 * Run:  node --env-file=.env scripts/security/erasure-disposable-verify.cjs
 * Exit: 0 = all checks pass, 1 = any failure / guard abort.
 */
require('reflect-metadata');
const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const { ErasureService } = require('../../dist/src/users/erasure/erasure.service.js');
const { ErasureAuditService } = require('../../dist/src/users/erasure/erasure-audit.service.js');

const TEST_DB = 'garnish_erasure_verify';
const PII_NEEDLES = ['@', '203.0.113.50', 'Mozilla']; // strings that must never appear in PII-free output

const results = [];
function check(name, pass, detail = '') {
  results.push({ name, pass: !!pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}
function note(msg) { console.log(`[note] ${msg}`); }
function redact(s, secret) { return secret ? String(s).split(secret).join('***') : String(s); }

function deriveTestUrl(baseUrl) {
  const u = new URL(baseUrl);
  u.pathname = '/' + TEST_DB;
  return u.toString();
}

// userId-bearing tables grouped by erasure policy (drives seeding, deletion checks, and orphan sweep).
const CASCADE_TABLES = [
  'userPreference', 'userAllergy', 'userCuisine', 'userHealthGoal', 'favoriteRecipe', 'mealPlan',
  'shoppingList', 'notification', 'supportTicket', 'userSession', 'userEvent', 'userBehaviorProfile',
  'preferenceHistory', 'userFeatureVector', 'userFeature', 'userOutcome', 'userIdentityDimension',
  'userBehaviorTimeline', 'signalObservation', 'recommendationExposure', 'featureContributionLog',
  'recommendationAttributionEvent', 'userBehaviorSignal', 'userEngagementSnapshot', 'userHealthSnapshot',
  'userIdentitySnapshot', 'userRetentionSnapshot', 'experimentAssignment', 'chatMessage', 'userFact',
]; // 30 FKs to User with onDelete: Cascade (each has a userId scalar)
// SetNull tables that carry a userId scalar (orphan-swept by userId). aiSpendAlert added in E47-A10C.
const SETNULL_USERID_TABLES = ['aICallLog', 'consentLog', 'userAuditLog', 'dataAccessLog', 'erasureEvent', 'aiSpendAlert'];
// Recipe is also SetNull but de-links via `authorId` (not userId) — checked explicitly, not in the userId sweep.
const EXPECTED_FK_TO_USER = { total: 37, cascade: 30, setNull: 7, restrict: 0 }; // tripwire vs live schema (E47-A10C: +aiSpendAlert SetNull)

async function main() {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) throw new Error('DATABASE_URL not set (run with: node --env-file=.env ...)');
  const baseDbName = new URL(baseUrl).pathname.replace(/^\//, '');
  if (baseDbName === TEST_DB) throw new Error(`Refusing to run: base DB is the disposable name ${TEST_DB}`);
  const testUrl = deriveTestUrl(baseUrl);
  const testSecret = new URL(testUrl).password;

  // ---- 1. provision disposable DB ----
  const admin = new PrismaClient();
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
  await admin.$executeRawUnsafe(`CREATE DATABASE ${TEST_DB}`);
  await admin.$disconnect();
  console.log(`[provision] created disposable DB "${TEST_DB}" (base DB "${baseDbName}" untouched)`);

  // ---- 2. push schema to disposable DB (stderr captured + password-redacted on failure) ----
  try {
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: testUrl }, // password stays in env, never in argv
      stdio: ['ignore', 'ignore', 'pipe'],
    });
  } catch (e) {
    const err = redact((e.stderr || e.stdout || e.message || '').toString(), testSecret);
    throw new Error(`prisma db push failed (password redacted):\n${err}`);
  }
  console.log('[provision] schema pushed to disposable DB');

  const prisma = new PrismaClient({ datasources: { db: { url: testUrl } } });
  let failedHard = false;
  try {
    // ---- 3. HARD SAFETY GUARD ----
    const cur = await prisma.$queryRawUnsafe('SELECT current_database() AS db');
    const connectedDb = cur[0].db;
    if (connectedDb !== TEST_DB || connectedDb === baseDbName) {
      throw new Error(`SAFETY ABORT: connected to "${connectedDb}", expected disposable "${TEST_DB}"`);
    }
    check('safety: connected to disposable DB only', true, `current_database()=${connectedDb}`);

    // ---- 3b. SCHEMA-AWARE FK COVERAGE GUARD (prevents future false-pass on schema drift) ----
    const fks = await prisma.$queryRawUnsafe(`
      SELECT tc.table_name AS referencing_table, kcu.column_name AS fk_column, rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'User'`);
    const ruleCount = (rule) => fks.filter((f) => f.delete_rule === rule).length;
    const cascade = ruleCount('CASCADE');
    const setNull = ruleCount('SET NULL');
    const restrict = ruleCount('NO ACTION') + ruleCount('RESTRICT');
    note(`FK->User rules: total=${fks.length} cascade=${cascade} setNull=${setNull} restrict/noaction=${restrict}`);
    check('FK guard: NO Restrict/NoAction FK to User (deletion cannot be blocked / orphan)', restrict === EXPECTED_FK_TO_USER.restrict, `restrict/noaction=${restrict}`);
    check('FK guard: live schema matches expected coverage (tripwire on drift)',
      fks.length === EXPECTED_FK_TO_USER.total && cascade === EXPECTED_FK_TO_USER.cascade && setNull === EXPECTED_FK_TO_USER.setNull,
      `total=${fks.length} cascade=${cascade} setNull=${setNull} (expected ${JSON.stringify(EXPECTED_FK_TO_USER)})`);
    check('FK guard: script table lists account for all userId-cascade + setNull(userId)+recipe FKs',
      CASCADE_TABLES.length === EXPECTED_FK_TO_USER.cascade && (SETNULL_USERID_TABLES.length + 1) === EXPECTED_FK_TO_USER.setNull,
      `cascadeList=${CASCADE_TABLES.length} setNullList+recipe=${SETNULL_USERID_TABLES.length + 1}`);

    // ---- 4. seed lookups + target (T) + bystander (B) ----
    const allergy = await prisma.allergy.create({ data: { name: 'verify-allergy' } });
    const cuisine = await prisma.cuisine.create({ data: { name: 'verify-cuisine' } });
    const goal = await prisma.healthGoal.create({ data: { name: 'verify-goal' } });
    const experiment = await prisma.experiment.create({ data: { name: 'verify-exp', variantA: {}, variantB: {} } });
    const recipeCat = await prisma.recipe.create({ data: { title: 'Catalog Recipe', category: 'main', isPublic: true } });

    const T = await prisma.user.create({ data: { phone: '+989000000001', email: 'target-T@example.com', name: 'Target' } });
    const B = await prisma.user.create({ data: { phone: '+989000000002', email: 'bystander-B@example.com', name: 'Bystander' } });

    const recipeT = await prisma.recipe.create({ data: { title: 'T Recipe', category: 'main', authorId: T.id } });
    const recipeB = await prisma.recipe.create({ data: { title: 'B Recipe', category: 'main', authorId: B.id } });

    // --- target full cascade graph ---
    await prisma.userPreference.create({ data: { userId: T.id, diet: 'omnivore' } });
    await prisma.userAllergy.create({ data: { userId: T.id, allergyId: allergy.id } });
    await prisma.userCuisine.create({ data: { userId: T.id, cuisineId: cuisine.id } });
    await prisma.userHealthGoal.create({ data: { userId: T.id, healthGoalId: goal.id } });
    await prisma.favoriteRecipe.create({ data: { userId: T.id, recipeId: recipeCat.id } });
    const mealPlan = await prisma.mealPlan.create({ data: { userId: T.id, weekStart: new Date('2026-06-01T00:00:00Z') } });
    const mealSlot = await prisma.mealSlot.create({ data: { mealPlanId: mealPlan.id, dayOfWeek: 1, mealType: 'lunch', recipeId: recipeCat.id } });
    const shoppingList = await prisma.shoppingList.create({ data: { userId: T.id, name: 'List' } });
    const shoppingItem = await prisma.shoppingItem.create({ data: { shoppingListId: shoppingList.id, name: 'Salt' } });
    await prisma.notification.create({ data: { userId: T.id, title: 'hi', body: 'b', type: 'info' } });
    const ticket = await prisma.supportTicket.create({ data: { userId: T.id, subject: 's', message: 'm' } });
    const ticketReply = await prisma.ticketReply.create({ data: { ticketId: ticket.id, message: 'r' } });
    const session = await prisma.userSession.create({ data: { userId: T.id, device: 'd', ip: '203.0.113.50' } });
    const event = await prisma.userEvent.create({ data: { userId: T.id, type: 'page_view', sessionId: session.id, page: '/home' } });
    await prisma.signalObservation.create({ data: { userId: T.id, signalName: 'sig', eventId: event.id, weight: 1 } });
    await prisma.userBehaviorProfile.create({ data: { userId: T.id } });
    await prisma.preferenceHistory.create({ data: { userId: T.id, fieldName: 'diet', newValue: 'omnivore' } });
    await prisma.userFeatureVector.create({ data: { userId: T.id, features: {} } });
    await prisma.userFeature.create({ data: { userId: T.id, featureKey: 'fk', value: 1 } });
    await prisma.userOutcome.create({ data: { userId: T.id, metricName: 'm1' } });
    await prisma.userIdentityDimension.create({ data: { userId: T.id, dimensionKey: 'dk' } });
    await prisma.userBehaviorTimeline.create({ data: { userId: T.id, dimensionKey: 'dk', value: 1 } });
    await prisma.recommendationExposure.create({ data: { userId: T.id, recipeId: recipeCat.id } });
    await prisma.featureContributionLog.create({ data: { userId: T.id, recipeId: recipeCat.id, featureKey: 'fk', contribution: 1, finalScore: 1 } });
    await prisma.recommendationAttributionEvent.create({ data: { userId: T.id, recipeId: recipeCat.id, eventType: 'click' } });
    await prisma.userBehaviorSignal.create({ data: { userId: T.id, signalName: 's', signalDomain: 'd', signalType: 't' } });
    await prisma.userEngagementSnapshot.create({ data: { userId: T.id } });
    await prisma.userHealthSnapshot.create({ data: { userId: T.id } });
    await prisma.userIdentitySnapshot.create({ data: { userId: T.id } });
    await prisma.userRetentionSnapshot.create({ data: { userId: T.id } });
    await prisma.experimentAssignment.create({ data: { userId: T.id, experimentId: experiment.id, variant: 'A' } });
    await prisma.chatMessage.create({ data: { userId: T.id, conversationId: 'c1', role: 'user', content: 'hello' } });
    await prisma.userFact.create({ data: { userId: T.id, key: 'diet', value: { v: 1 }, source: 'test' } });

    // --- target SetNull (audit-long) rows WITH residual PII to scrub ---
    const consentT = await prisma.consentLog.create({ data: { userId: T.id, type: 'analytics', ip: '203.0.113.50' } });
    const auditT = await prisma.userAuditLog.create({ data: { userId: T.id, action: 'login', details: 'login by target-T@example.com', ip: '203.0.113.50', userAgent: 'Mozilla/5.0 (Test)' } });
    const accessT = await prisma.dataAccessLog.create({ data: { userId: T.id, resource: 'profile', action: 'read', details: 'read target-T@example.com', ip: '203.0.113.50' } });
    // AICallLog seeded with DISTINCTIVE markers so we can observe whether eraseUser scrubs them.
    const aiT = await prisma.aICallLog.create({ data: { userId: T.id, model: 'stub', provider: 'stub', status: 'ok', guardHits: [], toolCalls: [], metadata: { marker: 'AICALL_META_MARKER' }, errorMessage: 'AICALL_ERR_MARKER' } });
    // E47-A10C: AiSpendAlert is SetNull — seed one for the target to verify it survives de-linked.
    const alertT = await prisma.aiSpendAlert.create({ data: { userId: T.id, thresholdType: 'token_daily', thresholdValue: 160000, observedValue: 161000, dayUtc: '2026-06-14', status: 'triggered', severity: 'warning', metadata: { kind: 'ai_spend_alert' }, schemaVersion: 1 } });

    // --- bystander rows (must remain fully intact, including PII) ---
    await prisma.userPreference.create({ data: { userId: B.id } });
    await prisma.chatMessage.create({ data: { userId: B.id, conversationId: 'cb', role: 'user', content: 'bystander' } });
    await prisma.userFact.create({ data: { userId: B.id, key: 'diet', value: { v: 2 }, source: 'test' } });
    const consentB = await prisma.consentLog.create({ data: { userId: B.id, type: 'analytics', ip: '198.51.100.9' } });
    const auditB = await prisma.userAuditLog.create({ data: { userId: B.id, action: 'login', details: 'b', ip: '198.51.100.9', userAgent: 'BUA' } });
    const accessB = await prisma.dataAccessLog.create({ data: { userId: B.id, resource: 'profile', action: 'read', details: 'b', ip: '198.51.100.9' } });
    const aiB = await prisma.aICallLog.create({ data: { userId: B.id, model: 'stub', provider: 'stub', status: 'ok', guardHits: [], toolCalls: [], metadata: {} } });

    // ---- before counts ----
    const before = {};
    for (const t of [...CASCADE_TABLES, ...SETNULL_USERID_TABLES]) before[t] = await prisma[t].count({ where: { userId: T.id } });
    const beforeTotalTargetRows = CASCADE_TABLES.reduce((a, t) => a + before[t], 0);
    console.log(`[seed] target rows seeded across user-linked tables: ${beforeTotalTargetRows}`);
    check('seed: target has rows in every Cascade table', CASCADE_TABLES.every((t) => before[t] >= 1),
      CASCADE_TABLES.filter((t) => before[t] < 1).join(',') || 'all present');
    check('seed: target has rows in SetNull audit-long tables', ['aICallLog', 'consentLog', 'userAuditLog', 'dataAccessLog'].every((t) => before[t] >= 1));

    // ---- 5. RUN THE REAL ERASURE ----
    let result, threw = null;
    try {
      result = await new ErasureService(prisma).eraseUser(T.id, { actorType: 'self' });
    } catch (e) {
      threw = e;
    }
    check('eraseUser did not throw (no FK errors)', !threw, threw ? threw.message : 'ok');
    if (threw) { failedHard = true; throw threw; }
    console.log('[erase] result:', JSON.stringify(result));

    // ---- 6. VERIFY ----
    // 6a. returned result
    check('result.status === erased', result.status === 'erased', result.status);
    check('result.erasureEventId present', !!result.erasureEventId, String(result.erasureEventId));
    // EXACT count validation: returned counts must equal what was actually seeded (not merely >= 1).
    check('result.summary counts EXACTLY match seeded rows',
      result.summary.sessionsRevoked === before.userSession
      && result.summary.consentScrubbed === before.consentLog
      && result.summary.auditScrubbed === before.userAuditLog
      && result.summary.accessScrubbed === before.dataAccessLog,
      `summary=${JSON.stringify(result.summary)} expected={sessions:${before.userSession},consent:${before.consentLog},audit:${before.userAuditLog},access:${before.dataAccessLog}}`);
    const resultStr = JSON.stringify(result);
    check('result is PII-free', PII_NEEDLES.every((n) => !resultStr.includes(n)) && !resultStr.includes(T.id),
      'no email/ip/userAgent/raw-userId in result');

    // 6b. user gone, bystander intact
    check('target User row deleted', (await prisma.user.findUnique({ where: { id: T.id } })) === null);
    check('bystander User row intact', (await prisma.user.findUnique({ where: { id: B.id } })) !== null);

    // 6c. Cascade tables empty for target
    const cascadeLeft = {};
    for (const t of CASCADE_TABLES) cascadeLeft[t] = await prisma[t].count({ where: { userId: T.id } });
    const cascadeOffenders = CASCADE_TABLES.filter((t) => cascadeLeft[t] !== 0);
    check('all Cascade rows for target deleted (0 left)', cascadeOffenders.length === 0,
      cascadeOffenders.length ? cascadeOffenders.map((t) => `${t}=${cascadeLeft[t]}`).join(',') : 'all 0');
    check('ChatMessage + UserFact for target deleted', cascadeLeft.chatMessage === 0 && cascadeLeft.userFact === 0);
    check('behavior/snapshot rows for target deleted',
      ['userBehaviorSignal', 'userEngagementSnapshot', 'userHealthSnapshot', 'userIdentitySnapshot', 'userRetentionSnapshot', 'signalObservation', 'userBehaviorTimeline'].every((t) => cascadeLeft[t] === 0));

    // 6d. transitive child rows (no userId column) gone
    check('child rows via parent cascade deleted (mealSlot/shoppingItem/ticketReply)',
      (await prisma.mealSlot.findUnique({ where: { id: mealSlot.id } })) === null
      && (await prisma.shoppingItem.findUnique({ where: { id: shoppingItem.id } })) === null
      && (await prisma.ticketReply.findUnique({ where: { id: ticketReply.id } })) === null);

    // 6e. SetNull tombstones: row survives, userId/authorId null
    const aiRow = await prisma.aICallLog.findUnique({ where: { id: aiT.id } });
    check('AICallLog survives with userId SetNull (tombstone)', aiRow && aiRow.userId === null, aiRow ? `userId=${aiRow.userId}` : 'missing');
    // CONTRACT NOTE (not a failure): AICallLog.metadata/errorMessage are NOT scrubbed by eraseUser — by
    // design they are written PII-free (assertNoPIIInMetadata) / sanitized. We record the real state as
    // evidence so reviewers can decide on an optional defence-in-depth scrub (see report).
    const aiMetaScrubbed = aiRow && JSON.stringify(aiRow.metadata) === '{}';
    const aiErrScrubbed = aiRow && aiRow.errorMessage === null;
    note(`AICallLog post-erasure: userId=${aiRow && aiRow.userId} metadataScrubbed=${aiMetaScrubbed} errorMessageScrubbed=${aiErrScrubbed} ` +
      `(current design: metadata/errorMessage RETAINED — PII-free at write; defence-in-depth scrub is a reviewer/ADV decision)`);
    const recipeTRow = await prisma.recipe.findUnique({ where: { id: recipeT.id } });
    check('Recipe survives with authorId SetNull', recipeTRow && recipeTRow.authorId === null, recipeTRow ? `authorId=${recipeTRow.authorId}` : 'missing');
    // E47-A10C: AiSpendAlert survives the user's deletion, de-linked (userId null) — does not block erasure.
    const alertRow = await prisma.aiSpendAlert.findUnique({ where: { id: alertT.id } });
    check('AiSpendAlert survives with userId SetNull (tombstone)', alertRow && alertRow.userId === null, alertRow ? `userId=${alertRow.userId}` : 'missing');

    // 6f. residual PII scrubbed on surviving (de-linked) rows
    const consentRow = await prisma.consentLog.findUnique({ where: { id: consentT.id } });
    check('ConsentLog: survives, userId null, ip scrubbed', consentRow && consentRow.userId === null && consentRow.ip === null,
      consentRow ? `userId=${consentRow.userId} ip=${consentRow.ip}` : 'missing');
    const auditRow = await prisma.userAuditLog.findUnique({ where: { id: auditT.id } });
    check('UserAuditLog: survives, userId null, ip/userAgent/details scrubbed',
      auditRow && auditRow.userId === null && auditRow.ip === null && auditRow.userAgent === null && auditRow.details === null,
      auditRow ? `userId=${auditRow.userId} ip=${auditRow.ip} ua=${auditRow.userAgent} details=${auditRow.details}` : 'missing');
    const accessRow = await prisma.dataAccessLog.findUnique({ where: { id: accessT.id } });
    check('DataAccessLog: survives, userId null, ip/details scrubbed',
      accessRow && accessRow.userId === null && accessRow.ip === null && accessRow.details === null,
      accessRow ? `userId=${accessRow.userId} ip=${accessRow.ip} details=${accessRow.details}` : 'missing');

    // 6g. ErasureEvent proof
    const expectedHash = ErasureAuditService.subjectHash(T.id);
    const evt = await prisma.erasureEvent.findFirst({ where: { subjectHash: expectedHash } });
    check('ErasureEvent written with matching subjectHash', evt && evt.subjectHash === expectedHash);
    check('ErasureEvent userId SetNull (de-linked after delete)', evt && evt.userId === null, evt ? `userId=${evt.userId}` : 'missing');
    check('ErasureEvent action/status correct', evt && evt.action === 'user_erasure' && evt.status === 'completed', evt ? `${evt.action}/${evt.status}` : 'missing');
    check('ErasureEvent id matches returned erasureEventId', evt && evt.id === result.erasureEventId);
    const metaStr = JSON.stringify(evt ? evt.metadata : {});
    check('ErasureEvent metadata PII-free (counts only, no raw subject id)',
      PII_NEEDLES.every((n) => !metaStr.includes(n)) && !metaStr.includes(T.id), `metadata=${metaStr}`);

    // 6h. exhaustive orphan sweep — NO row anywhere still references the deleted target userId (or authorId)
    const orphans = {};
    for (const t of [...CASCADE_TABLES, ...SETNULL_USERID_TABLES]) orphans[t] = await prisma[t].count({ where: { userId: T.id } });
    const orphanOffenders = Object.entries(orphans).filter(([, n]) => n !== 0);
    check('orphan sweep: 0 rows reference the deleted target userId (any userId table)', orphanOffenders.length === 0,
      orphanOffenders.length ? orphanOffenders.map(([t, n]) => `${t}=${n}`).join(',') : 'all 0');
    check('Recipe.author orphan check: 0 recipes still point to target (authorId)', (await prisma.recipe.count({ where: { authorId: T.id } })) === 0);

    // 6i. bystander isolation — B's data untouched, PII intact, NOT scrubbed
    const cB = await prisma.consentLog.findUnique({ where: { id: consentB.id } });
    const aB = await prisma.userAuditLog.findUnique({ where: { id: auditB.id } });
    const acB = await prisma.dataAccessLog.findUnique({ where: { id: accessB.id } });
    const aiBrow = await prisma.aICallLog.findUnique({ where: { id: aiB.id } });
    const recipeBRow = await prisma.recipe.findUnique({ where: { id: recipeB.id } });
    check('bystander ConsentLog intact (userId + ip preserved, NOT scrubbed)', cB && cB.userId === B.id && cB.ip === '198.51.100.9');
    check('bystander UserAuditLog intact (PII preserved)', aB && aB.userId === B.id && aB.ip === '198.51.100.9' && aB.userAgent === 'BUA');
    check('bystander DataAccessLog intact (userId + ip preserved)', acB && acB.userId === B.id && acB.ip === '198.51.100.9');
    check('bystander AICallLog intact (userId preserved)', aiBrow && aiBrow.userId === B.id);
    check('bystander Recipe.author preserved', recipeBRow && recipeBRow.authorId === B.id);
    check('bystander Cascade rows intact', (await prisma.chatMessage.count({ where: { userId: B.id } })) === 1 && (await prisma.userFact.count({ where: { userId: B.id } })) === 1);

    // ---- summary ----
    const failed = results.filter((r) => !r.pass);
    console.log(`\n=== SUMMARY: ${results.length - failed.length}/${results.length} checks passed ===`);
    if (failed.length) { console.log('FAILED:', failed.map((f) => f.name).join(' | ')); failedHard = true; }
  } finally {
    await prisma.$disconnect();
    // ---- 7. drop disposable DB (best-effort; never leaves a stale DB silently) ----
    try {
      const admin2 = new PrismaClient();
      await admin2.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
      await admin2.$disconnect();
      console.log(`[cleanup] dropped disposable DB "${TEST_DB}"`);
    } catch (e) {
      console.error(`[cleanup] WARNING: failed to drop disposable DB "${TEST_DB}" — drop it manually. Reason:`, redact(e.message, testSecret));
    }
  }
  process.exit(failedHard ? 1 : 0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
