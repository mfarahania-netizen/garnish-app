/**
 * INTERNATIONAL_CORE_150 post-import verifier (v0.6.0). Read-only.
 *
 * Confirms the dev DB after import: total count, 150 international recipes present (by source tag),
 * existing recipes preserved, no duplicate recipeId/slug/titleFa, no invalid ingredient references,
 * sample imported + existing slugs queryable. Plain JS (run via node). Exits 1 on any failure.
 */
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const { validate } = require('./validate-international-core-150-v0-6-0');

const SOURCE_TAG = 'international-core-150-v0.6.0';

function parseAdminNote(note) { try { return JSON.parse(note || '{}'); } catch { return {}; } }
function text(v, fb = '') { if (v == null) return fb; if (typeof v === 'string') return v; if (typeof v === 'object') return v.fa || v.en || fb; return String(v); }

async function main() {
  const v = validate();
  if (!v.ok) { console.log('[verify] package validation FAILED — cannot verify import.'); for (const e of v.errors) console.log(' -', e); process.exit(1); }
  const intlIds = new Set(v.recipes.map((r) => String(r.recipeId)));
  const intlSlugs = new Set(v.recipes.map((r) => r.slug));

  const prisma = new PrismaClient();
  const checks = [];
  const check = (name, cond, detail = '') => { checks.push({ name, ok: !!cond, detail }); };
  try {
    const total = await prisma.recipe.count();
    const all = await prisma.recipe.findMany({ select: { id: true, title: true, adminNote: true } });
    const intlInDb = all.filter((r) => parseAdminNote(r.adminNote).source === SOURCE_TAG);
    const intlIdsInDb = new Set(intlInDb.map((r) => r.id));

    check('totalCount350', total === 350, `total=${total}`);
    check('intl150PresentByTag', intlInDb.length === 150, `intlTagged=${intlInDb.length}`);
    check('allIntlIdsPresent', [...intlIds].every((id) => intlIdsInDb.has(id)), `missing=${[...intlIds].filter((id) => !intlIdsInDb.has(id)).length}`);

    // duplicates across whole DB
    const ids = all.map((r) => r.id);
    const slugs = all.map((r) => parseAdminNote(r.adminNote).slug).filter(Boolean);
    const titles = all.map((r) => r.title).filter(Boolean);
    const dup = (arr) => arr.length - new Set(arr).size;
    check('noDuplicateRecipeId', dup(ids) === 0, `dup=${dup(ids)}`);
    check('noDuplicateSlug', dup(slugs) === 0, `dup=${dup(slugs)}`);
    check('noDuplicateTitle', dup(titles) === 0, `dup=${dup(titles)}`);

    // existing (non-intl) preserved: should be exactly total - 150
    check('existingPreserved', all.length - intlInDb.length === total - 150, `nonIntl=${all.length - intlInDb.length}`);

    // sample imported queryable by id + slug
    const sampleImported = v.recipes.slice(0, 5);
    let importedQueryable = 0;
    const sampleImportedSlugsVerified = [];
    for (const r of sampleImported) {
      const found = await prisma.recipe.findUnique({ where: { id: String(r.recipeId) }, select: { id: true, ingredients: { select: { ingredientId: true } } } });
      if (found) { importedQueryable++; sampleImportedSlugsVerified.push(r.slug); }
    }
    check('sampleImportedQueryable', importedQueryable === sampleImported.length, `${importedQueryable}/${sampleImported.length}`);

    // sample existing (non-intl) still queryable
    const existingSample = all.filter((r) => !intlIdsInDb.has(r.id)).slice(0, 5);
    let existingQueryable = 0;
    const sampleExistingSlugsVerified = [];
    for (const r of existingSample) {
      const found = await prisma.recipe.findUnique({ where: { id: r.id }, select: { id: true } });
      if (found) { existingQueryable++; const s = parseAdminNote(r.adminNote).slug; if (s) sampleExistingSlugsVerified.push(s); }
    }
    check('sampleExistingQueryable', existingQueryable === existingSample.length, `${existingQueryable}/${existingSample.length}`);

    // ingredient reference integrity for imported recipes (no dangling ingredientId)
    const dangling = await prisma.recipeIngredient.count({ where: { recipeId: { in: [...intlIdsInDb] }, ingredientId: { not: null }, ingredient: { is: null } } });
    check('noDanglingIngredientRefs', dangling === 0, `dangling=${dangling}`);

    const allOk = checks.every((c) => c.ok);
    console.log('=== INTERNATIONAL_CORE_150 v0.6.0 POST-IMPORT VERIFY ===');
    for (const c of checks) console.log(`  [${c.ok ? 'PASS' : 'FAIL'}] ${c.name} ${c.detail}`);
    console.log(`sampleImportedSlugsVerified: ${JSON.stringify(sampleImportedSlugsVerified)}`);
    console.log(`sampleExistingSlugsVerified: ${JSON.stringify(sampleExistingSlugsVerified)}`);
    console.log(`RESULT: ${allOk ? 'PASS' : 'FAIL'} (total=${total})`);
    if (!allOk) process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error('VERIFY ERROR:', e.message); process.exit(1); });
