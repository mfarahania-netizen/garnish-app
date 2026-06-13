/**
 * E39-1A erasure FK preflight — READ-ONLY.
 *
 * Counts rows in each of the 12 "orphan" user-linked tables whose `userId` is NOT present in `User`.
 * Adding a User foreign key would fail if any such orphan rows exist. This script DELETES NOTHING and
 * prints COUNTS ONLY (no PII). Exit code 2 = orphans found (STOP before migrating); 0 = clean.
 *
 * Run: node apps/server/scripts/data/erasure-orphan-preflight.cjs
 */
const path = require('node:path');
try {
  process.loadEnvFile(path.resolve(__dirname, '../../.env'));
} catch {
  /* env may already be set */
}
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TABLES = [
  'UserFeatureVector',
  'UserFeature',
  'UserOutcome',
  'UserIdentityDimension',
  'UserBehaviorTimeline',
  'SignalObservation',
  'UserBehaviorSignal',
  'UserEngagementSnapshot',
  'UserHealthSnapshot',
  'UserIdentitySnapshot',
  'UserRetentionSnapshot',
  'ExperimentAssignment',
];

(async () => {
  const tables = [];
  let totalOrphans = 0;
  for (const t of TABLES) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT count(*)::int AS total, count(*) FILTER (WHERE u.id IS NULL)::int AS orphans
       FROM "${t}" x LEFT JOIN "User" u ON x."userId" = u.id`,
    );
    const total = Number(rows[0].total);
    const orphans = Number(rows[0].orphans);
    totalOrphans += orphans;
    tables.push({ table: t, total, orphans });
  }
  console.log(JSON.stringify({ totalOrphans, tables }, null, 2));
  await prisma.$disconnect();
  process.exit(totalOrphans > 0 ? 2 : 0);
})().catch((e) => {
  console.error('PREFLIGHT ERROR:', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
