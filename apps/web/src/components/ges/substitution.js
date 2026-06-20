// GES — one grounded substitution fetch + normalizer, shared by the recipe page, the per-ingredient
// SubSheet, and the AISheet swap mode (so apply/feedback/error handling stay consistent).
//
// Grounded + honest: results come ONLY from POST /ai/substitutions (the deterministic dictionary tool,
// no live LLM). Declared allergies stay a hard filter server-side. Each option keeps its WHY (`reason`)
// and confidence basis so the UI can rank/label it instead of dropping the grounding.
import apiClient from '../../lib/apiClient';

// confidence label per the tool's `basis` (dish-authored > curated explicit option > same-role peer)
export const qualityOf = (basis) => {
  if (basis === 'authored') return { label: 'پیشنهادِ این دستور', rank: 0 };
  if (basis === 'explicit_option') return { label: 'جایگزین مطمئن', rank: 1 };
  if (basis === 'same_category') return { label: 'هم‌نقش', rank: 2 };
  return { label: 'پیشنهاد', rank: 3 };
};

export function normalizeSubs(data) {
  const arr = Array.isArray(data?.substitutions) ? data.substitutions : [];
  return arr
    .map((s) => (typeof s === 'string'
      ? { name: s, basis: null, reason: '', allergenNote: null }
      : { name: s?.name, basis: s?.basis || null, reason: s?.reason || '', allergenNote: s?.allergenNote || null }))
    .filter((s) => s.name);
}

/**
 * fetchSubstitutions — grounded same-role swaps for one ingredient.
 * Returns { items, resolvedId, resultStatus }. Throws on network/abort so the caller can flag an
 * honest "temporary error" (distinct from the empty "no swap found" result — see M7).
 */
export async function fetchSubstitutions(ingredient, { limit = 5, signal } = {}) {
  const { data } = await apiClient.post('/ai/substitutions', { ingredient, limit }, signal ? { signal } : undefined);
  return {
    items: normalizeSubs(data),
    resolvedId: data?.resolved?.id || null,
    resultStatus: data?.resultStatus || 'ok',
  };
}
