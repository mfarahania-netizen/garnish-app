import { useState, useCallback } from 'react';
import { useAnalytics } from './useAnalytics';

/**
 * useDismissRecommendation — FI-STEP-1 "learn from rejection". A user dismissing a recommended dish emits
 * `recommendation_dismiss` (keyed to recipeId) — which the backend already routes to the recommendation
 * processor → applyNegativeFeedback → UserBehaviorSignal → the LIVE ranker (lowers the dish for this user).
 * Returns `dismissed` (a Set for optimistic removal so the user sees their feedback land) + `dismiss(recipeId)`.
 */
export function useDismissRecommendation() {
  const { trackEvent } = useAnalytics();
  const [dismissed, setDismissed] = useState(() => new Set());

  const dismiss = useCallback((recipeId) => {
    if (!recipeId) return;
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(recipeId);
      return next;
    });
    trackEvent('recommendation_dismiss', { recipeId });
  }, [trackEvent]);

  return { dismissed, dismiss };
}
