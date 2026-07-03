import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import {
  PARSE_REPORT,
  STAGING_JSON,
  localDbGuard,
  parseMarkdownBatches,
  validateParsedRecipes,
  writeJson,
} from './gris-repair-common';

async function main() {
  const db = localDbGuard();
  const prisma = new PrismaClient();
  try {
    const recipes = parseMarkdownBatches();
    const validation = await validateParsedRecipes(recipes, prisma);
    const payload = {
      schemaVersion: 'gris_repair_001_110_staging_v1',
      generatedAt: new Date().toISOString(),
      source: 'docs/qa/recipes/gris-repair-batches/non-drinks/*.md',
      db,
      validation,
      recipes,
    };
    writeJson(STAGING_JSON, payload);
    fs.mkdirSync(path.dirname(PARSE_REPORT), { recursive: true });
    const top = recipes.slice(0, 20).map((r, i) => `| ${i + 1} | ${r.recipeId} | ${r.slug} | ${r.headingTitle} | ${r.sourceFile} |`).join('\n');
    fs.writeFileSync(PARSE_REPORT, [
      '# GRIS Repair 001-110 Parse Report',
      '',
      `- generatedAt: ${payload.generatedAt}`,
      `- database: ${db.redacted}`,
      `- parsed recipes: ${validation.counts.parsedRecipes}`,
      `- unique recipeIds: ${validation.counts.uniqueRecipeIds}`,
      `- unique slugs: ${validation.counts.uniqueSlugs}`,
      `- existing in DB: ${validation.counts.dbExisting}`,
      `- DB adminNote.slug duplicates: ${validation.counts.dbAdminNoteSlugDuplicates}`,
      `- protected/review/lite audit check: ${validation.counts.protectedReviewLiteCheck}`,
      `- validation: ${validation.ok ? 'PASS' : 'FAIL'}`,
      '',
      '## First 20 Parsed Recipes',
      '',
      '| # | recipeId | slug | title | sourceFile |',
      '|---|---|---|---|---|',
      top,
      '',
      '## Errors',
      '',
      validation.errors.length ? validation.errors.map((e) => `- ${e}`).join('\n') : '- none',
      '',
    ].join('\n'), 'utf8');
    console.log(JSON.stringify({
      ok: validation.ok,
      staging: path.relative(process.cwd(), STAGING_JSON),
      report: path.relative(process.cwd(), PARSE_REPORT),
      counts: validation.counts,
      errors: validation.errors.slice(0, 25),
    }, null, 2));
    if (!validation.ok) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, message: error.message }, null, 2));
  process.exit(1);
});
