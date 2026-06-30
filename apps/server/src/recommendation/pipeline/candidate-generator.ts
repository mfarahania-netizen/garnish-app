// apps/server/src/recommendation/pipeline/candidate-generator.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FeatureStoreService } from '../../behavior-engine/feature-store/feature-store.service';
import { RecipeEmbeddingService } from '../../embeddings/recipe-embedding.service';
import { ProfileReadService } from '../../behavior-engine/profile/read/profile-read.service';
import { RecipeContentFeatureStore } from '../../recipes/search/recipe-content-feature-store.service';
import { RecipeSafetyFilterService } from '../../recipes/intelligence/recipe-safety-filter.service';
import { assessRecipeFit } from '../../recipes/intelligence/recipe-fit';
import { analyzeRecipeIntegrity } from '../../recipes/intelligence/recipe-integrity';

// COLDSTART-L4-14: full recipe shape needed for assessRecipeFit + analyzeRecipeIntegrity (allergy-safe fit).
const FIT_SELECT = {
  id: true, title: true, diet: true, difficulty: true, cookingTime: true, allergens: true, categories: true, region: true,
  containsPork: true, // authoritative no-pork/halal flag (avoid_constraint)
  ingredients: { select: { name: true, ingredient: { select: { allergens: true } } } },
} as const;

@Injectable()
export class CandidateGeneratorService {
  private readonly logger = new Logger(CandidateGeneratorService.name);

  constructor(
    private prisma: PrismaService,
    private featureStore: FeatureStoreService,
    private embeddingService: RecipeEmbeddingService,
    private profiles: ProfileReadService,
    private content: RecipeContentFeatureStore,
    private safety: RecipeSafetyFilterService,
  ) {}

  async generate(userId: string, limit = 50): Promise<string[]> {
    // P1-6 (recsys audit): generate the 8 candidate sources in PARALLEL and ISOLATE failures. Previously they
    // ran sequentially (8 serial DB round-trips) AND a single source throwing failed the ENTIRE recommendation
    // request. Promise.allSettled fixes both: parallel latency + a failing source degrades to an empty bucket
    // (logged) while the slate still serves. Input order is preserved → the quota logic is byte-identical when
    // all sources succeed.
    const sources: Array<{ source: string; run: () => Promise<string[]> }> = [
      { source: 'similar', run: () => this.getSimilarRecipes(userId) },
      { source: 'embedding', run: () => this.getEmbeddingSimilarRecipes(userId) },
      { source: 'collaborative', run: () => this.getCollaborativeRecipes(userId) },
      { source: 'trending', run: () => this.getTrendingRecipes() },
      { source: 'health', run: () => this.getHealthGoalRecipes(userId) },
      { source: 'seasonal', run: () => this.getSeasonalRecipes() },
      { source: 'inventory', run: () => this.getInventoryRecipes(userId) },
      { source: 'cold_start', run: () => this.getColdStartRecipes(userId) },
    ];
    const settled = await Promise.allSettled(sources.map((s) => s.run()));
    const buckets = sources.map((s, i) => {
      const r = settled[i];
      if (r.status === 'fulfilled') return { source: s.source, ids: r.value };
      this.logger.warn(`candidate source '${s.source}' failed (slate still serves): ${(r.reason as Error)?.message}`);
      return { source: s.source, ids: [] as string[] };
    });

    const target = Math.max(limit, 1);
    const quotas = new Map<string, number>();
    const activeBuckets = buckets.filter((bucket) => bucket.ids.length > 0);
    const baseQuota = Math.max(1, Math.floor(target / Math.max(activeBuckets.length || 1, 1)));

    for (const bucket of activeBuckets) {
      quotas.set(bucket.source, baseQuota);
    }

    let remainder = target - baseQuota * activeBuckets.length;
    for (const bucket of activeBuckets) {
      if (remainder <= 0) break;
      quotas.set(bucket.source, (quotas.get(bucket.source) || 0) + 1);
      remainder -= 1;
    }

    const candidates: string[] = [];
    const seen = new Set<string>();

    for (const bucket of buckets) {
      const quota = quotas.get(bucket.source) ?? 0;
      for (const recipeId of bucket.ids.slice(0, quota)) {
        if (seen.has(recipeId)) continue;
        seen.add(recipeId);
        candidates.push(recipeId);
        if (candidates.length >= target) return this.filterSafe(userId, candidates);
      }
    }

    if (candidates.length < target) {
      for (const bucket of buckets) {
        for (const recipeId of bucket.ids) {
          if (seen.has(recipeId)) continue;
          seen.add(recipeId);
          candidates.push(recipeId);
          if (candidates.length >= target) return this.filterSafe(userId, candidates);
        }
      }
    }

    return this.filterSafe(userId, candidates);
  }

  /**
   * HARD SAFETY GATE on the FULL merged candidate set (ALL users, ALL buckets) — the founder's
   * non-negotiable invariant. Previously only the cold-start bucket was allergy-filtered; once a user had
   * >5 events that bucket emptied and the other 7 buckets + the ranker applied NO allergen filter (guardian
   * H1). Reuses the living profile + assessRecipeFit; drops 'avoid_allergen' AND 'avoid_constraint'
   * (pork/halal/kosher — guardian H2). FAIL-CLOSED: if the profile can't load, surface NOTHING rather than
   * something unsafe. Preserves bucket order. generate() over-generates (limit×5) so the loss is absorbed.
   */
  private async filterSafe(userId: string, candidateIds: string[]): Promise<string[]> {
    // Delegates to the ONE reusable gate (RecipeSafetyFilterService) shared with the /recipes serving paths,
    // so the allergy/observance invariant is defined in exactly one place. Fail-closed for an authed user.
    return this.safety.safeIds(userId, candidateIds);
  }

  private async getSimilarRecipes(userId: string): Promise<string[]> {
    const recentViews = await this.prisma.userEvent.findMany({
      where: { userId, type: { in: ['recipe_view', 'favorite_add'] } },
      orderBy: { timestamp: 'desc' },
      take: 10,
    });

    const recipeIds = new Set<string>();
    for (const event of recentViews) {
      try {
        const p = JSON.parse(event.payload || '{}');
        if (p.recipeId) recipeIds.add(p.recipeId);
      } catch {}
    }

    if (recipeIds.size === 0) return [];

    const searchTerms = await this.prisma.searchTerm.findMany({
      where: { recipeId: { in: [...recipeIds] } },
      select: { term: true },
    });
    const terms = [...new Set(searchTerms.map(s => s.term))];

    const similarRecipes: { recipeId: string }[] = await this.prisma.searchTerm.findMany({
      where: { term: { in: terms }, recipeId: { notIn: [...recipeIds] } },
      select: { recipeId: true },
      take: 20,
    });

    return [...new Set(similarRecipes.map(s => s.recipeId))];
  }

  private async getEmbeddingSimilarRecipes(userId: string): Promise<string[]> {
    const recentViews = await this.prisma.userEvent.findMany({
      where: { userId, type: 'recipe_view' },
      orderBy: { timestamp: 'desc' },
      take: 3,
      select: { payload: true },
    });

    const recentRecipeIds = recentViews
      .flatMap((event) => {
        try {
          const payload = JSON.parse(event.payload || '{}');
          return payload.recipeId ? [payload.recipeId] : [];
        } catch {
          return [];
        }
      })
      .filter(Boolean);

    if (recentRecipeIds.length === 0) return [];

    const allRecipes = await this.prisma.recipe.findMany({
      where: { isPublic: true, status: 'active' }, // advisor audit: exclude unreviewed UGC (byte-identical today)
      select: { id: true },
      take: 50,
    });

    const recentEmbeddings = await Promise.all(
      recentRecipeIds.map((recipeId) => this.embeddingService.getEmbedding(recipeId)),
    );

    const scored = await Promise.all(
      allRecipes.map(async (recipe) => {
        if (recentRecipeIds.includes(recipe.id)) return null;
        const embedding = await this.embeddingService.getEmbedding(recipe.id);
        if (embedding.length === 0) return null;

        const similarity = recentEmbeddings.reduce((best, current) => {
          return Math.max(best, this.embeddingService.cosineSimilarity(current, embedding));
        }, 0);

        return { recipeId: recipe.id, similarity };
      }),
    );

    return scored
      .filter((item): item is { recipeId: string; similarity: number } => !!item && item.similarity > 0.25)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10)
      .map((item) => item.recipeId);
  }

  private async getCollaborativeRecipes(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { healthGoals: { select: { healthGoal: { select: { name: true } } } } },
    });
    if (!user || user.healthGoals.length === 0) return [];

    const goalNames = user.healthGoals.map(g => g.healthGoal.name);
    const similarUsers = await this.prisma.userHealthGoal.findMany({
      where: { healthGoal: { name: { in: goalNames } }, userId: { not: userId } },
      select: { userId: true },
      take: 10,
    });

    if (similarUsers.length === 0) return [];

    const similarUserIds = similarUsers.map(u => u.userId);
    const favoriteRecipes: { recipeId: string }[] = await this.prisma.favoriteRecipe.findMany({
      where: { userId: { in: similarUserIds } },
      select: { recipeId: true },
      take: 20,
    });

    return [...new Set(favoriteRecipes.map(f => f.recipeId))];
  }

  private async getTrendingRecipes(): Promise<string[]> {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const trending = await this.prisma.userEvent.groupBy({
      by: ['payload'],
      where: { type: 'recipe_view', timestamp: { gte: oneWeekAgo } },
      _count: { payload: true },
      orderBy: { _count: { payload: 'desc' } },
      take: 10,
    });

    const recipeIds: string[] = [];
    for (const item of trending) {
      try {
        const p = JSON.parse((item.payload as string) || '{}');
        if (p.recipeId) recipeIds.push(p.recipeId);
      } catch {}
    }
    return recipeIds;
  }

  private async getHealthGoalRecipes(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { healthGoals: { select: { healthGoal: { select: { name: true } } } } },
    });
    if (!user || user.healthGoals.length === 0) return [];

    const goalNames = user.healthGoals.map(g => g.healthGoal.name);
    const recipes = await this.prisma.recipe.findMany({
      where: {
        status: 'active', isPublic: true, // advisor audit: exclude unreviewed UGC
        OR: goalNames.map((goal) => ({ categories: { contains: goal } })),
      },
      select: { id: true },
      take: 10,
    });

    return recipes.map(r => r.id);
  }

  private async getSeasonalRecipes(): Promise<string[]> {
    const recipes = await this.prisma.recipe.findMany({
      where: {
        status: 'active', isPublic: true, // advisor audit: exclude unreviewed UGC
        categories: { contains: 'فصل' },
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      select: { id: true },
      take: 10,
    });
    return recipes.map(r => r.id);
  }

  private async getInventoryRecipes(userId: string): Promise<string[]> {
    const shoppingItems = await this.prisma.shoppingItem.findMany({
      where: { shoppingList: { userId } },
      select: { name: true },
      take: 20,
    });

    if (shoppingItems.length === 0) return [];

    const ingredientNames = shoppingItems.map(i => i.name);
    const recipes: { recipeId: string }[] = await this.prisma.recipeIngredient.findMany({
      where: { name: { in: ingredientNames } },
      select: { recipeId: true },
      take: 20,
    });

    return [...new Set(recipes.map(r => r.recipeId))];
  }

  private async getColdStartRecipes(userId: string): Promise<string[]> {
    const hasBehaviorHistory = await this.prisma.userEvent.count({
      where: { userId, timestamp: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    });
    if (hasBehaviorHistory > 5) return [];
    const candidates = await this.coldStartCandidates(userId);
    return candidates.map((c) => c.recipeId);
  }

  /**
   * COLDSTART-L4-14: profile-grounded, ALLERGY-SAFE, content-aware, fit-ranked cold-start.
   *
   * Reads the canonical living profile (declared diet/effort/skill + the reconciled HARD allergy set) via
   * getLivingUserProfile — NOT raw `user.preferences` — and ranks by genuine fit (assessRecipeFit), never
   * by `createdAt`. Declared allergies are a HARD filter: an allergen-conflicting recipe (recommendation
   * 'avoid_allergen', fitScore 0) is NEVER returned. Content-similar neighbours (S9 RecipeContentFeatureStore)
   * augment the set, filtered the same allergy-safe way. Explainable (per-pick fit reasons). Deterministic.
   */
  async coldStartCandidates(userId: string): Promise<Array<{ recipeId: string; fitScore: number; recommendation: string; reasons: string[] }>> {
    let profile: any;
    try {
      profile = await this.profiles.getLivingUserProfile(userId);
    } catch {
      return []; // cannot establish the safe allergy set → surface nothing rather than something unsafe
    }
    if (!profile) return [];

    // Narrow the pool by declared diet (best-effort); the allergy HARD filter + fit ranking do the real work,
    // so even a broad pool stays safe.
    const where = this.coldStartWhere(profile);
    // When the user declared a cuisine-style lean, fetch BOTH regions explicitly so the soft style boost in
    // assessRecipeFit can actually surface the preferred one — otherwise the pool's default ordering (persian-first
    // in the DB) starves international (≈half the corpus) and the lean can't move the slate. The non-preferred
    // region STAYS in the pool (never hidden — only the rank shifts). No declared style → plain take-50 (unchanged).
    const cuisineStyle = String(profile?.declared?.dimensions?.['context.cuisine_style']?.value ?? '');
    let pool: any[] = [];
    if (cuisineStyle === 'traditional' || cuisineStyle === 'modern') {
      const pref = cuisineStyle === 'traditional' ? 'persian' : 'international';
      const other = cuisineStyle === 'traditional' ? 'international' : 'persian';
      const [a, b] = await Promise.all([
        this.prisma.recipe.findMany({ where: { ...where, region: pref }, select: FIT_SELECT, take: 35 }),
        this.prisma.recipe.findMany({ where: { ...where, region: other }, select: FIT_SELECT, take: 25 }),
      ]);
      pool = [...a, ...b];
    }
    if (pool.length === 0) pool = await this.prisma.recipe.findMany({ where, select: FIT_SELECT, take: 50 });
    if (pool.length === 0) pool = await this.prisma.recipe.findMany({ where: { isPublic: true, status: 'active' }, select: FIT_SELECT, take: 50 });

    let ranked = this.fitRank(pool, profile);

    // content augmentation (S9): neighbours of the best-fit anchor, fit-filtered the same allergy-safe way
    const anchor = ranked[0]?.recipeId;
    if (anchor) {
      try {
        const { neighbors } = await this.content.neighbors(anchor, 10);
        const have = new Set(ranked.map((r) => r.recipeId));
        const extraIds = neighbors.map((n) => n.recipeId).filter((id) => !have.has(id));
        if (extraIds.length) {
          const extra = await this.prisma.recipe.findMany({ where: { id: { in: extraIds }, status: 'active', isPublic: true }, select: FIT_SELECT });
          ranked = ranked.concat(this.fitRank(extra, profile));
        }
      } catch { /* content store unavailable → fit-ranked pool only */ }
    }

    ranked.sort((a, b) => b.fitScore - a.fitScore || a.recipeId.localeCompare(b.recipeId));
    return ranked.slice(0, 20);
  }

  /** assessRecipeFit each recipe; HARD-drop allergen conflicts (the cold-start safety fix). */
  private fitRank(recipes: any[], profile: any) {
    return recipes
      .map((r) => {
        const derived = analyzeRecipeIntegrity(r).derivedAllergens.allergens;
        const fit = assessRecipeFit(r, profile, derived);
        return { recipeId: r.id, fitScore: fit.fitScore, recommendation: fit.recommendation, reasons: (fit.reasons ?? []).slice(0, 3) };
      })
      .filter((x) => x.recommendation !== 'avoid_allergen' && x.recommendation !== 'avoid_constraint'); // declared allergies + observance (pork) never surfaced
  }

  /** Best-effort soft pool filter from the declared/reconciled profile (NOT the allergy set — that's the hard fit filter). */
  private coldStartWhere(profile: any): any {
    const where: any = { isPublic: true, status: 'active' }; // advisor audit: cold-start pool excludes unreviewed UGC
    const diet = profile?.reconciled?.dimensions?.['dietary_pattern']?.reconciledValue ?? profile?.declared?.dimensions?.['dietary.pattern']?.value;
    if (typeof diet === 'string' && diet.length) where.diet = diet;
    return where;
  }
}
