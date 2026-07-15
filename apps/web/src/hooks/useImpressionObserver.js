import { useEffect, useRef, useCallback, useState } from 'react';
import apiClient from '../lib/apiClient';
import { ANALYTICS_RUNTIME_EVENT, hasAnalyticsConsent } from '../lib/analytics-init';

/**
 * useImpressionObserver — honest recommendation-impression telemetry.
 *
 * A single shared IntersectionObserver watches the cards registered via `observe(recipeId, requestId)`
 * (a stable ref callback). A card qualifies when it is >=50% visible for >=1000ms; qualifying recipeIds
 * are batched by requestId and sent ONCE per page session to the real `POST /recommendations/impression`
 * with the MEASURED `viewportMs` (real dwell) + `visibleRatio` (real ratio) — never faked, never below
 * the backend's threshold. De-duped via a `reported` set. No-op when `enabled` is false, analytics consent
 * is inactive, or IntersectionObserver is unavailable (jsdom/SSR).
 */
const QUALIFY_MS = 1000;
const QUALIFY_RATIO = 0.5;

export function useImpressionObserver({ enabled = true, source = 'home' } = {}) {
  const observerRef = useRef(null);
  const nodes = useRef(new Map()); // node -> { recipeId, requestId, ratio, since, timer }
  const reported = useRef(new Set()); // recipeIds accepted by the server (max once per session)
  const inFlight = useRef(new Set()); // recipeIds whose request has started but has not settled
  const pending = useRef(new Map()); // recipeId -> { viewportMs, visibleRatio, requestId } awaiting flush
  const flushTimer = useRef(null);
  const refCallbacks = useRef(new Map()); // `${recipeId}:${requestId}` -> stable ref callback
  const [consentActive, setConsentActive] = useState(() => hasAnalyticsConsent());

  const cancelQueued = useCallback(() => {
    clearTimeout(flushTimer.current);
    flushTimer.current = null;
    pending.current.clear();
    for (const rec of nodes.current.values()) {
      clearTimeout(rec.timer);
      rec.timer = null;
      rec.since = 0;
    }
  }, []);

  useEffect(() => {
    const syncConsent = () => {
      const active = hasAnalyticsConsent();
      if (!active) cancelQueued();
      setConsentActive(active);
    };
    globalThis.addEventListener?.(ANALYTICS_RUNTIME_EVENT, syncConsent);
    syncConsent();
    return () => globalThis.removeEventListener?.(ANALYTICS_RUNTIME_EVENT, syncConsent);
  }, [cancelQueued]);

  const flush = useCallback(() => {
    if (!enabled || !hasAnalyticsConsent()) {
      cancelQueued();
      return;
    }
    if (pending.current.size === 0) return;
    const groups = new Map();
    for (const [recipeId, val] of pending.current.entries()) {
      const key = val.requestId || '';
      if (!groups.has(key)) groups.set(key, { recipeIds: [], vals: [], requestId: val.requestId });
      const group = groups.get(key);
      group.recipeIds.push(recipeId);
      group.vals.push(val);
    }
    pending.current.clear();
    for (const group of groups.values()) {
      const viewportMs = Math.max(...group.vals.map((v) => v.viewportMs));
      const visibleRatio = Math.max(...group.vals.map((v) => v.visibleRatio));
      for (const recipeId of group.recipeIds) inFlight.current.add(recipeId);
      try {
        void apiClient.post('/recommendations/impression', {
          recipeIds: group.recipeIds,
          viewportMs,
          visibleRatio,
          source,
          ...(group.requestId ? { requestId: group.requestId } : {}),
        }).then((response) => {
          // A consent-denied 200 response is not a successful impression. Leave those ids eligible only for
          // a genuinely new visibility qualification after consent is active again; never retry here.
          if (response?.data?.accepted === false) return;
          for (const recipeId of group.recipeIds) reported.current.add(recipeId);
        }).catch(() => {
          // Transport failures are deliberately not retried. A later send requires a new observer qualification.
        }).finally(() => {
          for (const recipeId of group.recipeIds) inFlight.current.delete(recipeId);
        });
      } catch {
        for (const recipeId of group.recipeIds) inFlight.current.delete(recipeId);
      }
    }
  }, [cancelQueued, enabled, source]);

  const scheduleFlush = useCallback(() => {
    if (!enabled || !hasAnalyticsConsent()) {
      cancelQueued();
      return;
    }
    clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(flush, 600);
  }, [cancelQueued, enabled, flush]);

  useEffect(() => {
    if (!enabled || !consentActive || typeof IntersectionObserver === 'undefined') {
      cancelQueued();
      return undefined;
    }
    const io = new IntersectionObserver((entries) => {
      if (!hasAnalyticsConsent()) {
        cancelQueued();
        return;
      }
      for (const e of entries) {
        const rec = nodes.current.get(e.target);
        if (!rec) continue;
        rec.ratio = e.intersectionRatio;
        if (e.isIntersecting && e.intersectionRatio >= QUALIFY_RATIO) {
          if (
            reported.current.has(rec.recipeId)
            || pending.current.has(rec.recipeId)
            || inFlight.current.has(rec.recipeId)
            || rec.timer
          ) continue;
          rec.since = Date.now();
          rec.timer = setTimeout(() => {
            rec.timer = null;
            if (
              enabled
              && hasAnalyticsConsent()
              && rec.ratio >= QUALIFY_RATIO
              && !reported.current.has(rec.recipeId)
              && !pending.current.has(rec.recipeId)
              && !inFlight.current.has(rec.recipeId)
            ) {
              pending.current.set(rec.recipeId, {
                viewportMs: Math.max(QUALIFY_MS, Date.now() - rec.since),
                visibleRatio: rec.ratio,
                requestId: rec.requestId,
              });
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
      cancelQueued();
      observerRef.current = null;
    };
  }, [cancelQueued, consentActive, enabled, scheduleFlush]);

  const observe = useCallback((recipeId, requestId = null) => {
    if (!recipeId) return undefined;
    const key = `${recipeId}:${requestId || ''}`;
    if (!refCallbacks.current.has(key)) {
      let currentNode = null;
      refCallbacks.current.set(key, (node) => {
        if (currentNode && currentNode !== node) {
          const record = nodes.current.get(currentNode);
          if (record?.timer) clearTimeout(record.timer);
          observerRef.current?.unobserve(currentNode);
          nodes.current.delete(currentNode);
          pending.current.delete(recipeId);
          currentNode = null;
        }
        if (!node || node === currentNode) return;
        currentNode = node;
        nodes.current.set(node, { recipeId, requestId, ratio: 0, since: 0, timer: null });
        observerRef.current?.observe(node);
      });
    }
    return refCallbacks.current.get(key);
  }, []);

  return { observe };
}
