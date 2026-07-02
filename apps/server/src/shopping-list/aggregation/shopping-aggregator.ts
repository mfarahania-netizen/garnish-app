/**
 * Smart shopping-list aggregator (GARNISH-PLANNER-L4-09) — pure, deterministic.
 *
 * Aggregates ingredients across planned recipes into a usable shopping list:
 *  - resolve + MERGE duplicates by the resolved dictionary id (else normalized name),
 *  - combine quantities when units are compatible (same unit → sum); flag incompatible units HONESTLY
 *    (kept as separate quantity entries, never silently coerced),
 *  - scale by servings/household,
 *  - categorize (from the resolved dictionary category; 'other' when unknown),
 *  - de-dupe against items the user already has/checked.
 * Never fabricates quantities/ids — unparseable amounts are carried as a unit-less unspecified entry.
 */
import { norm, looseMatch } from '../../ai/tools/grounding-utils';

export interface PlannedIngredient {
  name: string;
  amount?: string | number | null;
  unit?: string | null;
  category?: string | null; // from the resolved dictionary entry when available
  ingredientId?: string | null; // resolved dictionary id (the merge key when present)
  scale?: number; // PER-LINE multiplier (this slot's servings ÷ the recipe's base servings) — so each planned dish scales independently
}

export interface AggregatedItem {
  name: string;
  category: string;
  ingredientId: string | null;
  quantities: { amount: number | null; unit: string }[];
  display: string;
  sources: number; // how many planned lines merged into this item
  flags: string[];
}

export interface AggregateOptions {
  scale?: number; // servings/household multiplier (default 1)
  ownedNames?: string[]; // names already checked/owned → de-duped out
}

const UNITLESS = '';
const UNSPECIFIED_AMOUNT_DISPLAY = 'به مقدار لازم';

function parseAmount(amount: unknown): number | null {
  if (typeof amount === 'number') return Number.isFinite(amount) ? amount : null;
  if (typeof amount !== 'string') return null;
  // tolerate latin + persian digits
  const normalized = amount.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  const m = normalized.match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

export function aggregateShoppingList(items: PlannedIngredient[], opts: AggregateOptions = {}): { items: AggregatedItem[]; merged: number; flagged: number } {
  const scale = opts.scale && opts.scale > 0 ? opts.scale : 1;
  const owned = (opts.ownedNames ?? []).map(norm).filter(Boolean);

  const groups = new Map<string, { name: string; category: string; ingredientId: string | null; byUnit: Map<string, number | null>; sources: number; hadUnparseable: boolean }>();

  for (const raw of items) {
    const name = String(raw?.name ?? '').trim();
    if (!name) continue;
    const key = raw.ingredientId ? `id:${raw.ingredientId}` : `name:${norm(name)}`;
    const unit = norm(raw.unit) || UNITLESS;
    const amount = parseAmount(raw.amount);

    const g = groups.get(key) ?? { name, category: raw.category || 'other', ingredientId: raw.ingredientId ?? null, byUnit: new Map(), sources: 0 as number, hadUnparseable: false };
    g.sources += 1;
    if (raw.category && g.category === 'other') g.category = raw.category;
    const lineScale = typeof raw.scale === 'number' && raw.scale > 0 ? raw.scale : 1; // this dish's servings ÷ its base servings
    if (amount == null) {
      g.hadUnparseable = true;
      if (!g.byUnit.has(unit)) g.byUnit.set(unit, null);
    } else {
      const prev = g.byUnit.get(unit);
      g.byUnit.set(unit, (typeof prev === 'number' ? prev : 0) + amount * lineScale);
    }
    groups.set(key, g);
  }

  let merged = 0;
  let flagged = 0;
  const out: AggregatedItem[] = [];
  for (const g of groups.values()) {
    if (owned.some((o) => looseMatch(g.name, o))) continue; // already owned/checked → de-duped

    const quantities = [...g.byUnit.entries()].map(([unit, amount]) => ({
      amount: amount == null ? null : Math.round(amount * scale * 100) / 100,
      unit,
    }));
    const realUnits = quantities.filter((q) => q.unit !== UNITLESS).map((q) => q.unit);
    const flags: string[] = [];
    if (new Set(realUnits).size > 1) { flags.push('incompatible_units'); flagged += 1; }
    if (g.hadUnparseable) flags.push('some_amounts_unspecified');
    if (g.sources > 1) merged += 1;

    const display = quantities
      .map((q) =>
        q.amount == null
          ? UNSPECIFIED_AMOUNT_DISPLAY
          : `${q.amount}${q.unit ? ' ' + q.unit : ''}`,
      )
      .join(' + ');

    out.push({ name: g.name, category: g.category || 'other', ingredientId: g.ingredientId, quantities, display, sources: g.sources, flags });
  }

  out.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  return { items: out, merged, flagged };
}
