import type { RealTimeContext } from '../../context/real-time-context';

/**
 * L1 step 4 seam — the per-(recipe × cohort) LEARNED-PRIOR boundary. Sibling to L1_WEIGHT_SOURCE: where that
 * seam owns the component WEIGHTS, this one owns the per-candidate `recipePrior` component VALUE. The two
 * compose orthogonally (per L1_PLAN.md step 4): a future LearnedWeightSource raises the `recipePrior` weight
 * from 0 while this source supplies the value.
 *
 * `valuesForSlate` is BATCHED — one call per rank for the whole candidate set (no N+1). It returns a map of
 * recipeId → component value in [0,1] (0.5 = neutral, the same midpoint effortFit/skillFit use), or `null` to
 * defer (the ranker then uses the neutral 0.5 for every candidate → byte-identical).
 *
 * Wiring is intentionally absent today: RankingService injects it @Optional(), so with no provider registered
 * the behaviour is byte-identical to before. Turning it on later is a one-line provider registration:
 *   { provide: L1_RECIPE_PRIOR_SOURCE, useClass: RecipePriorService }
 * and it still contributes nothing until the `recipePrior` WEIGHT is raised above 0 via L1_WEIGHT_SOURCE.
 */
export const L1_RECIPE_PRIOR_SOURCE = 'L1_RECIPE_PRIOR_SOURCE';

export interface RecipePriorSource {
  valuesForSlate(
    userId: string,
    recipeIds: string[],
    context?: RealTimeContext,
  ): Promise<Map<string, number> | null>;
}
