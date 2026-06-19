/**
 * GRIS-PILOT APPLY (vertical slice, DEV) — write the 2 GRIS v2 pilot objects into Recipe.gris.
 *
 * Uses RAW SQL ($executeRawUnsafe) so it works WITHOUT regenerating the Prisma client (the running dev
 * server holds the query-engine DLL). Purely additive: sets the new `gris` (JSONB) + `containsPork` columns
 * on the two pilot recipes; touches NOTHING else (ingredients/allergens/nutrition/steps relations untouched).
 */
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');

const ROOT = path.resolve(__dirname, '../../../..');
const SOURCE = path.join(ROOT, 'apps/server/scripts/data/_pilot/gris-v2-pilot-proposed.json');
const isLocal = (host) => ['localhost', '127.0.0.1', '::1'].includes(host);

async function main() {
  const apply = process.argv.includes('--apply');
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL not set');
  const parsed = new URL(dbUrl);
  if (parsed.pathname.replace(/^\//, '') !== 'garnish_db' || !isLocal(parsed.hostname)) throw new Error('SAFETY STOP: expected local garnish_db');

  const recipes = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  console.log(`[plan] GRIS v2 records=${recipes.length} | mode=${apply ? 'apply' : 'dry-run'}`);
  for (const r of recipes) console.log(`  • ${r.title} (${r.recipeId}) | containsPork=${r.dietary && r.dietary.containsPork ? 'true' : 'false'}`);
  if (!apply) { console.log('[dry-run] no writes. Re-run with --apply.'); return; }

  const prisma = new PrismaClient();
  try {
    let updated = 0;
    for (const r of recipes) {
      const pork = !!(r.dietary && r.dietary.containsPork);
      const n = await prisma.$executeRawUnsafe(
        'UPDATE "Recipe" SET "gris" = $1::jsonb, "containsPork" = $2 WHERE id = $3',
        JSON.stringify(r), pork, r.recipeId,
      );
      console.log(`  [apply] ${r.title}: rows=${n}`);
      updated += n;
    }
    console.log(`[apply] gris written to ${updated} recipes`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error('APPLY ERROR:', e.message); process.exit(1); });
