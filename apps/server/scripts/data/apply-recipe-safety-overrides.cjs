/** Reconcile the reviewed recipe diet-label overrides into the LOCAL Garnish DB. Dry-run unless `--apply`. */
const { PrismaClient } = require('@prisma/client');
const { RECIPE_SAFETY_OVERRIDES } = require('./phase-one-recipes');

const prisma = new PrismaClient();
const isLocal = (host) => ['localhost', '127.0.0.1', '::1'].includes(host);
const stable = (value) => JSON.stringify(value);
const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
};
const dietFromFlags = (flags) => flags.includes('vegan') ? 'vegan'
  : flags.includes('vegetarian') ? 'vegetarian'
    : flags.includes('halal') ? 'halal'
      : flags.includes('protein_forward') ? 'high_protein'
        : 'regular';

async function main() {
  const apply = process.argv.includes('--apply');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  const parsed = new URL(url);
  if (!isLocal(parsed.hostname) || parsed.pathname.replace(/^\//, '') !== 'garnish_db') {
    throw new Error('SAFETY STOP: expected local garnish_db');
  }

  const ids = Object.keys(RECIPE_SAFETY_OVERRIDES.records);
  const rows = await prisma.recipe.findMany({
    where: { id: { in: ids } },
    select: { id: true, diet: true, categories: true, gris: true },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length) throw new Error(`Override recipe(s) missing from DB: ${missing.join(', ')}`);

  const changes = [];
  for (const id of ids) {
    const row = byId.get(id);
    const override = RECIPE_SAFETY_OVERRIDES.records[id];
    const flags = Array.isArray(override.dietFlags) ? override.dietFlags.map(String) : [];
    const diet = dietFromFlags(flags);
    const categories = [...new Set([
      ...asArray(row.categories).filter((value) => !['vegan', 'vegetarian'].includes(String(value))),
      ...flags,
    ])];
    const gris = row.gris && typeof row.gris === 'object' && !Array.isArray(row.gris)
      ? { ...row.gris, dietary: { ...(row.gris.dietary || {}), ...(override.grisDietary || {}) } }
      : row.gris;
    const next = { diet, categories: JSON.stringify(categories), gris };
    if (row.diet === next.diet && row.categories === next.categories && stable(row.gris) === stable(next.gris)) continue;
    changes.push({ id, before: row, after: next });
  }

  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', overrideCount: ids.length, changeCount: changes.length, changedIds: changes.map((change) => change.id) }, null, 2));
  if (!apply) return;
  await prisma.$transaction(async (tx) => {
    for (const change of changes) await tx.recipe.update({ where: { id: change.id }, data: change.after });
  });
  console.log(`[apply] reconciled ${changes.length} recipe records.`);
}

main()
  .catch((error) => { console.error(error?.message || error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
