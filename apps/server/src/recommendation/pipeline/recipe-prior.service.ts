import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { RealTimeContext } from '../../context/real-time-context';
import { deriveCohortKey, facetsFromUser, activeOccasionKey } from './cohort-key';
import { hierarchicalPrior, shrink, DEFAULT_KAPPA } from './prior-shrinkage';
import type { RecipePriorSource } from './recipe-prior.source';

/**
 * L1 step 4 — READ path for the learned per-(recipe × scope) prior. Pure read, NO writes. Given a slate it
 * returns each recipe's `recipePrior` component VALUE in [0,1] (0.5 = neutral) by hierarchically shrinking the
 * person → cohort → population reward deviations (prior-shrinkage). Default OFF + many fail-safes: the ranker
 * must stay byte-identical until this is deliberately turned on AND a non-zero weight is set.
 *
 * Cold-start neutrality: rows store CENTERED deviations, so an empty/neutral table yields posterior 0 → 0.5 for
 * every candidate (a constant cannot reorder). The cohortKey is derived with the SHARED facetsFromUser mapper so
 * it matches what the learner wrote.
 */
@Injectable()
export class RecipePriorService implements RecipePriorSource {
  constructor(private readonly prisma: PrismaService) {}

  /** Env kill-switch (default OFF) — read at call time so it is testable + flippable without redeploy. */
  static enabled(): boolean {
    return String(process.env.L1_RECIPE_PRIOR_ENABLED ?? '').trim().toLowerCase() === 'true';
  }

  async valuesForSlate(
    userId: string,
    recipeIds: string[],
    context?: RealTimeContext,
  ): Promise<Map<string, number> | null> {
    if (!RecipePriorService.enabled() || !userId || !recipeIds?.length) return null;

    const repo = (this.prisma as any).recipePrior;
    if (!repo?.findMany) return null; // table/client absent → neutral (byte-identical)

    const cohortKey = await this.resolveCohortKey(userId, context);

    // Build the scope filter — only include the cohort clause when we actually have a cohort key.
    const or: Array<{ scope: string; scopeKey: string }> = [
      { scope: 'population', scopeKey: '' },
      { scope: 'person', scopeKey: userId },
    ];
    if (cohortKey) or.push({ scope: 'cohort', scopeKey: cohortKey });

    const rows: Array<{ recipeId: string; scope: string; n: number; mean: number; populationMu: number }> =
      await repo
        .findMany({
          where: { recipeId: { in: recipeIds }, OR: or },
          select: { recipeId: true, scope: true, n: true, mean: true, populationMu: true },
        })
        .catch(() => []);

    const byRecipe = new Map<string, typeof rows>();
    for (const r of rows) {
      const list = byRecipe.get(r.recipeId) ?? [];
      list.push(r);
      byRecipe.set(r.recipeId, list);
    }

    const out = new Map<string, number>();
    for (const id of recipeIds) {
      const g = byRecipe.get(id) ?? [];
      const pop = g.find((r) => r.scope === 'population');
      const coh = g.find((r) => r.scope === 'cohort');
      const per = g.find((r) => r.scope === 'person');
      // Base = the curated populationMu refined by the LEARNED population reward (empirical-Bayes): with no
      // population data this returns the curated anchor unchanged → "n=0 ⇒ exactly the curated prior" (and 0
      // when unauthored → neutral). Then shrink toward cohort, then person — the full population→cohort→person
      // hierarchy, each level pulling only as far as its evidence (n) allows.
      const popBase = shrink(pop?.populationMu ?? 0, pop ? { n: pop.n, mean: pop.mean } : null, DEFAULT_KAPPA);
      const posterior = hierarchicalPrior({
        populationMu: popBase,
        cohort: coh ? { n: coh.n, mean: coh.mean } : null,
        person: per ? { n: per.n, mean: per.mean } : null,
        kappa: DEFAULT_KAPPA,
      });
      const dev = Math.max(-1, Math.min(1, Number.isFinite(posterior) ? posterior : 0));
      out.set(id, 0.5 + 0.5 * dev); // neutral posterior 0 → 0.5, same midpoint as effortFit/skillFit
    }
    return out;
  }

  /** Resolve the current user's cohort key via the SHARED mapper (matches the learner). Fail-safe → '' (population). */
  private async resolveCohortKey(userId: string, context?: RealTimeContext): Promise<string> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { locale: true, country: true, preferences: { select: { diet: true, skillLevel: true } } },
      });
      const facets = facetsFromUser(user, activeOccasionKey(context));
      return deriveCohortKey(facets) ?? '';
    } catch {
      return '';
    }
  }
}
