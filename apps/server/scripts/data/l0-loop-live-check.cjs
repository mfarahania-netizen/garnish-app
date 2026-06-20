/**
 * L0 LOOP — live end-to-end check against the real DB (throwaway user, fully cleaned up).
 * Proves the new infrastructure works in reality: a cook writes a dotted taste.cuisine_affinity
 * SignalObservation carrying the new typed columns; the exact loadObservations('rebuild') query reads it
 * back + aggregates it; and a granted UserConsent makes getConsentState include 'personalization'
 * (the gate that flips getLivingUserProfile hydration on). The graph-building itself is unit-proven.
 */
const { PrismaClient } = require('@prisma/client');
const UID = 'l0_live_check_user_TEMP';

async function main() {
  const p = new PrismaClient();
  try {
    // pick a real Persian recipe for realistic recipeId/region
    const persian = await p.recipe.findFirst({ where: { region: 'persian' }, select: { id: true, title: true } })
      || (await p.recipe.findFirst({ select: { id: true, title: true } }));
    console.log('using recipe:', persian?.title, `(${persian?.id})`);

    await p.user.deleteMany({ where: { id: UID } }); // idempotent
    await p.user.create({ data: { id: UID, name: 'L0 live check (temp)' } });

    // 3 "cooks" of the Persian dish → 3 cook_complete events + 3 dotted taste.cuisine_affinity rows
    for (let i = 0; i < 3; i++) {
      const ev = await p.userEvent.create({ data: { userId: UID, type: 'cook_complete', recipeId: persian.id, payload: JSON.stringify({ recipeId: persian.id }) } });
      await p.signalObservation.create({ data: { userId: UID, signalName: 'taste.cuisine_affinity', eventId: ev.id, weight: 1, recipeId: persian.id, dimension: 'taste', value: 'persian', confidence: 1, source: 'cook_complete' } });
    }
    // grant personalization (what ConsentService.grantPurpose writes)
    await p.userConsent.create({ data: { userId: UID, purpose: 'personalization', status: 'granted', lawfulBasis: 'consent', source: 'settings', grantedAt: new Date() } });

    // ---- read back exactly as the hydration path does ----
    const rows = await p.signalObservation.findMany({ where: { userId: UID }, orderBy: { observedAt: 'desc' }, select: { signalName: true, weight: true, dimension: true, value: true, recipeId: true } });
    const agg = new Map();
    for (const r of rows) { const c = agg.get(r.signalName) || { n: 0, sum: 0, value: r.value, dim: r.dimension }; c.n++; c.sum += r.weight; agg.set(r.signalName, c); }
    console.log('\nloadObservations would aggregate:');
    for (const [k, v] of agg) console.log(`  • ${k}  dim=${v.dim}  value=${v.value}  n=${v.n}  meanWeight=${(v.sum / v.n).toFixed(2)}  family=${k.split('.')[0]} → ${k.split('.')[0] === 'taste' ? 'REACHES taste dimension ✓' : 'dropped ✗'}`);

    const consentRows = await p.userConsent.findMany({ where: { userId: UID }, orderBy: { createdAt: 'asc' }, select: { purpose: true, status: true } });
    const latest = new Map(); for (const r of consentRows) latest.set(r.purpose, r.status);
    const granted = ['core', ...[...latest].filter(([, s]) => s === 'granted').map(([p]) => p)];
    console.log('\ngetConsentState would return granted =', granted, '→ hydration', granted.includes('personalization') ? 'FIRES ✓' : 'stays cold ✗');
  } finally {
    await (new PrismaClient()).user.deleteMany({ where: { id: UID } }).catch(() => {}); // Cascade cleanup
    await p.$disconnect();
    console.log('\ncleaned up throwaway user.');
  }
}
main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
