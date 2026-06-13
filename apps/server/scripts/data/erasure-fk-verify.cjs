/**
 * E39-1A FK structural verification — READ-ONLY (no deletion).
 *
 * Lists every foreign key that REFERENCES "User" and its ON DELETE rule, and asserts that NONE are
 * RESTRICT / NO ACTION (which would block user deletion). Proves erasure is no longer structurally
 * blocked, without deleting any data. confdeltype: c=CASCADE, n=SET NULL, a=NO ACTION, r=RESTRICT.
 *
 * Run: node apps/server/scripts/data/erasure-fk-verify.cjs
 */
const path = require('node:path');
try {
  process.loadEnvFile(path.resolve(__dirname, '../../.env'));
} catch {
  /* env may already be set */
}
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const RULE = { c: 'CASCADE', n: 'SET NULL', a: 'NO ACTION', r: 'RESTRICT' };

(async () => {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT src.relname AS "table", c.confdeltype AS rule
     FROM pg_constraint c
     JOIN pg_class src ON src.oid = c.conrelid
     JOIN pg_class tgt ON tgt.oid = c.confrelid
     WHERE c.contype = 'f' AND tgt.relname = 'User'
     ORDER BY c.confdeltype, src.relname`,
  );
  const mapped = rows.map((r) => ({ table: r.table, onDelete: RULE[r.rule] || r.rule }));
  const blocking = mapped.filter((r) => r.onDelete === 'RESTRICT' || r.onDelete === 'NO ACTION');
  const byRule = mapped.reduce((acc, r) => ((acc[r.onDelete] = (acc[r.onDelete] || 0) + 1), acc), {});
  console.log(JSON.stringify({ totalUserFKs: mapped.length, byRule, blocking, all: mapped }, null, 2));
  await prisma.$disconnect();
  process.exit(blocking.length === 0 ? 0 : 2);
})().catch((e) => {
  console.error('VERIFY ERROR:', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
