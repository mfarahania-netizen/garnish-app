/**
 * GRIS v2.1 BATCH APPLY (DEV) — write reviewed/approved authored recipes into Recipe.gris and upgrade
 * the dictionary's Ingredient.substitutionOptions so the live «جایگزین؟» button returns dish-grade swaps.
 *
 * Purely additive + safety-first:
 *   - reads each authored package from docs/data-pilot/_authored/<batch>/<recipeId>.json
 *     (shape: { recipeId, gris, coverage, ingredientSubsEnrichment, selfScore })
 *   - SNAPSHOTS the prior gris + the prior substitutionOptions to _authored/<batch>/_backup/ before writing
 *   - sets Recipe.gris (JSONB) + Recipe.containsPork from gris.dietary; touches nothing else on the recipe
 *   - MERGES ingredientSubsEnrichment into Ingredient.substitutionOptions (new dish-aware options FIRST,
 *     deduped by replaceWithIngredientId/name) — never the allergy filter, never nutrition.
 *
 * Usage:  node apply-gris-batch.js <batch> [--apply] [--only=id1,id2]
 *   dry-run by default; --apply writes. --only restricts to an approved id list.
 */
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');

const ROOT = path.resolve(__dirname, '../../../..');
const isLocal = (host) => ['localhost', '127.0.0.1', '::1'].includes(host);
const norm = (s) => String(s || '').replace(/[‌‍]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

async function main() {
  const apply = process.argv.includes('--apply');
  const batch = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'batch-01';
  const onlyArg = process.argv.find((a) => a.startsWith('--only='));
  const only = onlyArg ? onlyArg.slice('--only='.length).split(',').map((s) => s.trim()).filter(Boolean) : null;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL not set');
  const parsed = new URL(dbUrl);
  if (parsed.pathname.replace(/^\//, '') !== 'garnish_db' || !isLocal(parsed.hostname)) throw new Error('SAFETY STOP: expected local garnish_db');

  const dir = path.join(ROOT, 'docs/data-pilot/_authored', batch);
  const backupDir = path.join(dir, '_backup');
  let files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !f.startsWith('_'));
  if (only) files = files.filter((f) => only.includes(f.replace('.json', '')));

  const pkgs = files.map((f) => ({ f, pkg: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) }));
  console.log(`[plan] batch=${batch} files=${pkgs.length} mode=${apply ? 'APPLY' : 'dry-run'}${only ? ` only=${only.length}` : ''}`);
  for (const { pkg } of pkgs) {
    const g = pkg.gris || {};
    const ok = Array.isArray(g.ingredients) && g.ingredients.length && Array.isArray(g.steps) && g.steps.length;
    console.log(`  • ${g.story && g.glance ? '✓' : '?'} ${pkg.recipeId} | ings=${(g.ingredients || []).length} steps=${(g.steps || []).length} subsEnrich=${(pkg.ingredientSubsEnrichment || []).length} ${ok ? '' : '  ⚠ MALFORMED'}`);
    if (!ok) throw new Error(`malformed gris in ${pkg.recipeId} — aborting (no partial writes)`);
  }
  if (!apply) { console.log('[dry-run] no writes. Re-run with --apply.'); return; }

  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const prisma = new PrismaClient();
  try {
    let recipesWritten = 0;
    let ingredientsUpdated = 0;
    for (const { pkg } of pkgs) {
      const g = pkg.gris;
      // snapshot prior gris
      const prior = await prisma.$queryRawUnsafe('SELECT gris FROM "Recipe" WHERE id = $1', pkg.recipeId);
      fs.writeFileSync(path.join(backupDir, `${pkg.recipeId}.before.json`), JSON.stringify(prior && prior[0] ? prior[0].gris : null));
      const pork = !!(g.dietary && g.dietary.containsPork);
      const n = await prisma.$executeRawUnsafe('UPDATE "Recipe" SET "gris" = $1::jsonb, "containsPork" = $2 WHERE id = $3', JSON.stringify(g), pork, pkg.recipeId);
      recipesWritten += n;
      console.log(`  [gris] ${pkg.recipeId}: rows=${n}`);

      // merge substitution-options enrichment (new dish-aware options first, deduped)
      for (const enr of pkg.ingredientSubsEnrichment || []) {
        if (!enr || !enr.ingredientId || !Array.isArray(enr.substitutionOptions) || !enr.substitutionOptions.length) continue;
        const row = await prisma.ingredient.findUnique({ where: { id: enr.ingredientId }, select: { substitutionOptions: true } });
        if (!row) { console.log(`    ⚠ subsEnrich skip (id not found): ${enr.ingredientId}`); continue; }
        const existing = Array.isArray(row.substitutionOptions) ? row.substitutionOptions : [];
        const seen = new Set();
        const merged = [];
        for (const o of [...enr.substitutionOptions, ...existing]) {
          const key = norm(o && (o.replaceWithIngredientId || o.name || o.nameFa));
          if (!key || seen.has(key)) continue;
          seen.add(key);
          merged.push(o);
        }
        const snapPath = path.join(backupDir, `ing_${enr.ingredientId}.before.json`);
        if (!fs.existsSync(snapPath)) fs.writeFileSync(snapPath, JSON.stringify(existing));
        await prisma.ingredient.update({ where: { id: enr.ingredientId }, data: { substitutionOptions: merged } });
        ingredientsUpdated += 1;
        console.log(`    [subs] ${enr.ingredientId}: ${existing.length}→${merged.length}`);
      }
    }
    console.log(`[apply] gris written=${recipesWritten} | ingredient subs updated=${ingredientsUpdated}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error('APPLY ERROR:', e.message); process.exit(1); });
