/**
 * Shared helpers for the L4 grounded tools (E47 — RAG/retrieval over recipes + ingredients).
 *
 * Rules these helpers enforce:
 *  - NO fabrication. Missing/unparseable data stays missing (empty), never invented.
 *  - Defensive parsing: Recipe array-ish fields are JSON strings (e.g. allergens '[]'); Ingredient
 *    fields are Prisma Json (already-parsed objects/arrays). Both shapes are tolerated.
 */

export function norm(s: unknown): string {
  return String(s ?? '').trim().toLowerCase();
}

/** Parse a value into a clean string[] from: array | JSON-string array | comma list | object-with-list. */
export function toStringArray(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value
      .flatMap((x) => {
        if (typeof x === 'string') return [x];
        if (x && typeof x === 'object') {
          const o = x as Record<string, unknown>;
          const n = o.name ?? o.nameFa ?? o.nameEn ?? o.label ?? o.value;
          return typeof n === 'string' ? [n] : [];
        }
        return [];
      })
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t) return [];
    if (t.startsWith('[')) {
      try {
        const p = JSON.parse(t);
        return Array.isArray(p) ? toStringArray(p) : [];
      } catch {
        return [];
      }
    }
    return t.split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    for (const k of ['contains', 'allergens', 'list', 'values', 'options', 'items']) {
      if (Array.isArray(o[k])) return toStringArray(o[k]);
    }
  }
  return [];
}

/** Fuzzy "these two food strings refer to the same thing" — substring either direction. */
export function looseMatch(a: unknown, b: unknown): boolean {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

/** Clamp a requested limit into [min, max] with a default. */
export function clampLimit(raw: unknown, def: number, max: number, min = 1): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return def;
  return Math.min(Math.max(Math.trunc(n), min), max);
}
