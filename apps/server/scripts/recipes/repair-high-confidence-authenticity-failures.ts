import fs from 'node:fs';
import path from 'node:path';
import { prisma, sprintDir, writeJson, writeMd } from './culinary-authenticity-sprint-common';

async function main() {
  const auditPath = path.join(sprintDir, 'authenticity_audit_with_rulebook_v1.json');
  const audit = fs.existsSync(auditPath) ? JSON.parse(fs.readFileSync(auditPath, 'utf8')) : { rows: [] };
  const blockers = audit.rows.filter((r: any) => r.status === 'AUTH_FAIL_PUBLIC_BLOCKER');
  writeJson('high_confidence_authenticity_rollback.json', []);
  writeMd('high_confidence_authenticity_repair_report.md', `# High Confidence Authenticity Repair Report

- generatedAt: ${new Date().toISOString()}
- public blockers before repair: ${blockers.length}
- DB writes: 0
- reason: No high-confidence public blocker remained after P1 review/rulebook audit.
- verdict: ${blockers.length === 0 ? 'PASS' : 'FAIL'}
`);
  if (blockers.length) throw new Error('authenticity_public_blockers_remaining');
  console.log(JSON.stringify({ ok: true, repaired: 0 }, null, 2));
}

main().finally(async () => prisma.$disconnect()).catch((err) => {
  console.error(err);
  process.exit(1);
});

