/**
 * Canonical realized-outcome reward values — the SINGLE source of truth shared by RecommendationRewardService
 * and the L1 RecipePriorLearnerService, so the prior learns on exactly the reward scale the rest of the
 * recommendation system uses. cook_complete is treated as a cook (the no-lost-signals union folds organic cooks
 * into the prior). Pure.
 */
export function eventRewardValue(eventType: string): number {
  switch (eventType) {
    case 'recommendation_cook':
    case 'cook_complete':
      return 1;
    case 'recommendation_save':
      return 0.6;
    case 'recommendation_click':
      return 0.2;
    case 'recommendation_dismiss':
      return -0.8;
    case 'recommendation_ignore':
      return -0.4;
    default:
      return 0;
  }
}
