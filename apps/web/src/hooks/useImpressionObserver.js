import { useEffect, useRef, useCallback } from 'react';
import apiClient from '../lib/apiClient';

/**
 * useImpressionObserver — honest recommendation-impression telemetry.
 *
 * A single shared IntersectionObserver watches the cards registered via `observe(recipeId)` (a stable ref
 * callback). A card qualifies when it is ≥50% visible for ≥1000ms; qualifying recipeIds are batched and sent
 * ONCE per page session to the real `POST /recommendations/impression` with the MEASURED `viewportMs`
 * (real dwell) + `visibleRatio` (real ratio) — never faked, never below the backend's threshold. De-duped via
 * a `reported` set. No-op when `enabled` is false or IntersectionObserver is unavailable (jsdom/SSR).
 */
const QUALIFY_MS = 1000;
const QUALIFY_RATIO = 0.5;

export function useImpressionObserver({ enabled = true, source = 'home' } = {}) {
  const observerRef = useRef(null);
  const nodes = useRef(new Map()); // node → { recipeId, ratio, since, timer }
  const reported = useRef(new Set()); // recipeIds already sent (max once per session)
  const pending = useRef(new Map()); // recipeId → { viewportMs, visibleRatio } awaiting flush
  const flushTimer = useRef(null);
  const refCallbacks = useRef(new Map()); // recipeId → stable ref callback

  const flush = useCallback(() => {
    if (pending.current.size === 0) return;
    const recipeIds = [...pending.current.keys()];
    const vals = [...pending.current.values()];
    const viewportMs = Math.max(...vals.map((v) => v.viewportMs));
    const visibleRatio = Math.max(...vals.map((v) => v.visibleRatio));
    pending.current.clear();
    apiClient.post('/recommendations/impression', { recipeIds, viewportMs, visibleRatio, source }).catch(() => {});
  }, [source]);

  const scheduleFlush = useCallback(() => {
    clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(flush, 600);
  }, [flush]);

  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const rec = nodes.current.get(e.target);
        if (!rec) continue;
        rec.ratio = e.intersectionRatio;
        if (e.isIntersecting && e.intersectionRatio >= QUALIFY_RATIO) {
          if (reported.current.has(rec.recipeId) || rec.timer) continue;
          rec.since = Date.now();
          rec.timer = setTimeout(() => {
            rec.timer = null;
            if (rec.ratio >= QUALIFY_RATIO && !reported.current.has(rec.recipeId)) {
              reported.current.add(rec.recipeId);
              pending.current.set(rec.recipeId, { viewportMs: Math.max(QUALIFY_MS, Date.now() - rec.since), visibleRatio: rec.ratio });
              scheduleFlush();
            }
          }, QUALIFY_MS);
        } else if (rec.timer) {
          clearTimeout(rec.timer);
          rec.timer = null;
          rec.since = 0;
        }
      }
    }, { threshold: [0, QUALIFY_RATIO, 1] });
    observerRef.current = io;
    for (const node of nodes.current.keys()) io.observe(node);
    return () => {
      io.disconnect();
      clearTimeout(flushTimer.current);
      for (const r of nodes.current.values()) clearTimeout(r.timer);
      observerRef.current = null;
    };
  }, [enabled, scheduleFlush]);

  const observe = useCallback((recipeId) => {
    if (!recipeId) return undefined;
    if (!refCallbacks.current.has(recipeId)) {
      refCallbacks.current.set(recipeId, (node) => {
        if (node) {
          nodes.current.set(node, { recipeId, ratio: 0, since: 0, timer: null });
          observerRef.current?.observe(node);
        }
      });
    }
    return refCallbacks.current.get(recipeId);
  }, []);

  return { observe };
}
