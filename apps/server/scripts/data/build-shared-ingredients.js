/**
 * build-shared-ingredients.js  (GARNISH-PROFILE-L4-05, Phase 0)
 *
 * Reconciles the legacy/vestigial `packages/shared/data/ingredients.json` (a 124-item stub of
 * {id,title,searchableTerms}) with the VERIFIED 1008-item dictionary that the SERVER DB import
 * already uses (scripts/data/ingredient-dictionary.js). It PROJECTS every one of the 1008 verified
 * ingredients into the same {id,title,searchableTerms} shape — so the shared file is no longer a
 * misleading 124-item stub.
 *
 * NO fabrication, NO new IDs: every id/title/term is derived from the 1008 dictionary. If a field is
 * absent in the source it is simply omitted (honest). Idempotent; deterministic ordering by id.
 *
 * Usage: node apps/server/scripts/data/build-shared-ingredients.js [--check]
 *   --check : do not write; just validate counts + no-new-ids and exit non-zero on drift.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../../..');
const DICT_PATH = path.join(
  ROOT,
  'data/ingredients/phase-one-final/Ingredient Dictionary/ingredients_verified_structure_resolver_ready_1008_only_recipe_resolver_alias_patch_00.json',
);
const SHARED_PATH = path.join(ROOT, 'packages/shared/data/ingredients.json');

function canonical(nameNode) {
  if (!nameNode || typeof nameNode !== 'object') return null;
  return nameNode.canonical || nameNode.display || nameNode.normalized || null;
}

function project(raw) {
  const names = raw.names || {};
  const aliases = raw.aliases || {};
  const kw = raw.searchKeywords || {};
  const id = String(raw.ingredientId);
  const title = canonical(names.fa) || canonical(names.en) || String(raw.code);
  // searchable terms = fa + en canonical/display names, aliases, and keywords (strings only, deduped)
  const terms = new Set();
  for (const lang of ['fa', 'en']) {
    const c = canonical(names[lang]);
    if (c) terms.add(c);
    for (const a of Array.isArray(aliases[lang]) ? aliases[lang] : []) if (typeof a === 'string' && a.trim()) terms.add(a.trim());
    for (const k of Array.isArray(kw[lang]) ? kw[lang] : []) if (typeof k === 'string' && k.trim()) terms.add(k.trim());
  }
  return { id, title, searchableTerms: [...terms] };
}

function main() {
  const check = process.argv.includes('--check');
  const dict = JSON.parse(fs.readFileSync(DICT_PATH, 'utf8'));
  if (!Array.isArray(dict)) throw new Error('Dictionary is not an array.');

  const dictIds = new Set(dict.map((d) => String(d.ingredientId)));
  const projected = dict.map(project).sort((a, b) => a.id.localeCompare(b.id));

  // invariants: no new IDs, no duplicates, count matches the dictionary
  const outIds = projected.map((p) => p.id);
  const dup = outIds.filter((v, i) => outIds.indexOf(v) !== i);
  const newIds = outIds.filter((id) => !dictIds.has(id));
  if (newIds.length) throw new Error(`Refusing to write: ${newIds.length} ID(s) not in the 1008 dictionary (no fabrication).`);
  if (dup.length) throw new Error(`Refusing to write: duplicate IDs: ${dup.slice(0, 5).join(', ')}`);

  let before = 0;
  try { before = (JSON.parse(fs.readFileSync(SHARED_PATH, 'utf8')) || []).length; } catch { before = 0; }

  const summary = {
    dictionaryCount: dict.length,
    projectedCount: projected.length,
    sharedFileBefore: before,
    newIds: newIds.length,
    duplicateIds: dup.length,
    uniqueIds: new Set(outIds).size,
  };

  if (check) {
    const ok = summary.projectedCount === 1008 && summary.newIds === 0 && summary.duplicateIds === 0;
    console.log(JSON.stringify({ mode: 'check', ok, ...summary }, null, 2));
    process.exit(ok ? 0 : 1);
  }

  fs.writeFileSync(SHARED_PATH, JSON.stringify(projected, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ mode: 'write', wrote: SHARED_PATH, ...summary }, null, 2));
}

main();
