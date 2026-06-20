import type { RealTimeContext } from '../../context/real-time-context';

/**
 * L1 seam — the priors→learnable boundary for the ranker's component weights. The live ranker resolves a base
 * weight vector from (today) the experiment override or the static defaults; this interface lets a LEARNED or
 * COHORT-prior weight source be plugged in later WITHOUT touching the ranking math. A source returns a weight
 * vector, or null to defer to the next resolver / the static defaults.
 *
 * Wiring is intentionally absent today: RankingService injects it @Optional(), so with no provider registered
 * the behaviour is byte-identical to before. Turning learning on later is a one-line provider registration:
 *   { provide: L1_WEIGHT_SOURCE, useClass: LearnedWeightSource }
 */
export const L1_WEIGHT_SOURCE = 'L1_WEIGHT_SOURCE';

export interface WeightSource {
  resolve(userId: string, context?: RealTimeContext): Promise<Record<string, number> | null>;
}
