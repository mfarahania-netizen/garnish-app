/**
 * L1 step 4 — empirical-Bayes hierarchical shrinkage, the math heart of the cold-start prior. Pure + DB-free.
 *
 * A brand-new Europe/Holland user (zero history) must still get an excellent, deterministic slate on request #1.
 * We hold a curated POPULATION prior per recipe, refine it toward a COHORT estimate (region/diet/skill), then
 * toward the PERSON — but each level only pulls the estimate as far as its evidence (n) justifies. With no
 * cohort/person data the result is exactly the population prior (no thin-sample variance), and as real data
 * accrues the same formula auto-shifts trust population → cohort → person. κ governs the curated→learned pace.
 */
export interface PriorStat {
  n: number; // observation count behind `mean`
  mean: number; // observed mean score at this level
}

export const DEFAULT_KAPPA = 10; // prior strength: with n=κ the estimate sits halfway between prior and observed

/** Shrink an observed stat toward a prior: (κ·prior + n·x̄)/(κ + n). n≤0 → the prior, unchanged (deterministic
 *  cold-start). n≫κ → approaches the observed mean. Never divides by zero. */
export function shrink(prior: number, stat: PriorStat | null | undefined, kappa: number = DEFAULT_KAPPA): number {
  const n = stat && Number.isFinite(stat.n) ? stat.n : 0;
  const mean = stat && Number.isFinite(stat.mean) ? stat.mean : 0;
  if (n <= 0) return prior;
  const k = Number.isFinite(kappa) && kappa > 0 ? kappa : 0;
  return (k * prior + n * mean) / (k + n);
}

/** Hierarchical prior for one recipe: population → (shrink) cohort → (shrink) person. With no cohort/person
 *  evidence it returns the curated population prior (the Europe cold-start), and personalizes as data arrives. */
export function hierarchicalPrior(input: {
  populationMu: number;
  cohort?: PriorStat | null;
  person?: PriorStat | null;
  kappa?: number;
}): number {
  const kappa = input.kappa ?? DEFAULT_KAPPA;
  const base = Number.isFinite(input.populationMu) ? input.populationMu : 0;
  let eff = base;
  eff = shrink(eff, input.cohort, kappa); // pull toward the cohort only as far as cohort evidence allows
  eff = shrink(eff, input.person, kappa); // then toward the person only as far as personal evidence allows
  return eff;
}
