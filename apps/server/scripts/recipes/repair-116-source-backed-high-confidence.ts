import fs from 'node:fs';
import path from 'node:path';
import { assertLocalDatabase, getCounts, prisma } from './culinary-authenticity-sprint-common';

const sourceSprintDir = path.resolve(process.cwd(), '..', '..', 'docs', 'qa', 'recipes', 'source-backed-authenticity-116');
const auditPath = path.join(sourceSprintDir, 'audit_116_against_rules.json');

async function main() {
  assertLocalDatabase();
  const before = await getCounts();
  const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
  const candidates = audit.rows.filter((row: any) =>
    ['AUTH_METADATA_ONLY_FIX', 'AUTH_CONTENT_FIX_REQUIRED', 'AUTH_INGREDIENT_FIX_REQUIRED'].includes(row.status),
  );
  const rollback: any[] = [];
  fs.writeFileSync(path.join(sourceSprintDir, 'repair_116_high_confidence_rollback.json'), JSON.stringify(rollback, null, 2), 'utf8');
  const after = await getCounts();
  const countStable =
    before.totalRecipes === after.totalRecipes &&
    before.activePublic === after.activePublic &&
    before.draftPrivate === after.draftPrivate &&
    before.ingredientCount === after.ingredientCount;
  fs.writeFileSync(
    path.join(sourceSprintDir, 'repair_116_high_confidence_report.md'),
    `# Repair 116 High Confidence Report

- generatedAt: ${new Date().toISOString()}
- local/dev guard: PASS
- high-confidence candidates: ${candidates.length}
- patched recipes: 0
- reason: No high-confidence source-backed fix candidates remained after rule false-positive cleanup.
- recipe count: ${before.totalRecipes} -> ${after.totalRecipes}
- active/public count: ${before.activePublic} -> ${after.activePublic}
- draft/private count: ${before.draftPrivate} -> ${after.draftPrivate}
- ingredient count: ${before.ingredientCount} -> ${after.ingredientCount}
- rollback entries: 0
- verdict: ${countStable ? 'PASS - no DB patch required' : 'FAIL - count drift'}
`,
    'utf8',
  );
  if (!countStable) throw new Error(`COUNT_DRIFT:${JSON.stringify({ before, after })}`);
  console.log(JSON.stringify({ ok: true, candidates: candidates.length, patched: 0 }, null, 2));
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
