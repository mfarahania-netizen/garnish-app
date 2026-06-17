import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/apiClient';
import { IconSalad, IconMeat, IconWheat, IconMilk, IconShoppingCart } from '@tabler/icons-react';

/**
 * useShopping — the grocery list (GET /shopping-list), grouped by aisle/category. Check-off toggles
 * the REAL item via PATCH /shopping-list/items/:id (optimistic, reverts on failure). Build from the
 * meal plan (POST /shopping-list/from-plan) and manual add (POST /shopping-list/items). Honest:
 * ShoppingItem has no per-item provenance, so no fabricated «N رسپی» chip — the real aggregate merge
 * summary from from-plan is surfaced instead.
 */

// category token (en/fa) → aisle group (label + icon + order); unknown → «سایر»
const GROUPS = {
  vegetable: 'produce', vegetables: 'produce', produce: 'produce', fruit: 'produce', herb: 'produce', herbs: 'produce',
  protein: 'protein', meat: 'protein', poultry: 'protein', fish: 'protein', seafood: 'protein', egg: 'protein', eggs: 'protein',
  grain: 'grain', grains: 'grain', legume: 'grain', legumes: 'grain', pantry: 'grain', rice: 'grain', pasta: 'grain', bread: 'grain',
  dairy: 'dairy', milk: 'dairy', cheese: 'dairy',
};
const GROUP_META = {
  produce: { label: 'میوه و سبزی', Icon: IconSalad, order: 1 },
  protein: { label: 'گوشت و پروتئین', Icon: IconMeat, order: 2 },
  grain: { label: 'غلات و حبوبات', Icon: IconWheat, order: 3 },
  dairy: { label: 'لبنیات', Icon: IconMilk, order: 4 },
  other: { label: 'سایر', Icon: IconShoppingCart, order: 5 },
};
const groupKey = (category) => {
  const c = String(category || '').trim().toLowerCase();
  if (!c) return 'other';
  return GROUPS[c] || 'other';
};

export function useShopping() {
  const list = useQuery({ queryKey: ['shopping', 'list'], queryFn: () => apiClient.get('/shopping-list').then((r) => r.data) });
  const [overrides, setOverrides] = useState({}); // id → optimistic isChecked
  const [busy, setBusy] = useState(false);

  const items = useMemo(() => (Array.isArray(list.data?.items) ? list.data.items : []), [list.data]);

  const checkedOf = useCallback((it) => (it.id in overrides ? overrides[it.id] : !!it.isChecked), [overrides]);

  const groups = useMemo(() => {
    const byGroup = {};
    for (const it of items) {
      const g = groupKey(it.category);
      (byGroup[g] = byGroup[g] || []).push(it);
    }
    return Object.keys(byGroup)
      .map((g) => ({ key: g, ...GROUP_META[g], items: byGroup[g] }))
      .sort((a, b) => a.order - b.order);
  }, [items]);

  const total = items.length;
  const done = items.reduce((n, it) => n + (checkedOf(it) ? 1 : 0), 0);

  const toggle = useCallback(async (it) => {
    const nextVal = !checkedOf(it);
    setOverrides((o) => ({ ...o, [it.id]: nextVal }));
    try {
      await apiClient.patch(`/shopping-list/items/${it.id}`);
    } catch {
      setOverrides((o) => ({ ...o, [it.id]: !nextVal })); // revert on failure
    }
  }, [checkedOf]);

  const addManual = useCallback(async (name) => {
    const n = String(name || '').trim();
    if (!n) return false;
    setBusy(true);
    try {
      await apiClient.post('/shopping-list/items', { items: [{ name: n }] });
      await list.refetch();
      return true;
    } catch {
      return false;
    } finally {
      setBusy(false);
    }
  }, [list]);

  const buildFromPlan = useCallback(async () => {
    setBusy(true);
    try {
      const res = await apiClient.post('/shopping-list/from-plan').then((r) => r.data);
      setOverrides({});
      await list.refetch();
      return { ok: true, added: res?.added ?? 0, merged: res?.merged ?? 0, flagged: res?.flagged ?? 0, noPlan: res?.resultStatus === 'no_plan' };
    } catch {
      return { ok: false };
    } finally {
      setBusy(false);
    }
  }, [list]);

  let status = 'ready';
  if (list.isLoading) status = 'loading';
  else if (list.isError) status = 'error';
  else if (total === 0) status = 'empty';

  return { status, refetch: () => list.refetch(), groups, total, done, checkedOf, toggle, addManual, buildFromPlan, busy };
}
