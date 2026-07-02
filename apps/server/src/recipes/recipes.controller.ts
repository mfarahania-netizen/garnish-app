import { Controller, Get, Post, Param, Body, Req, UseGuards, Patch, Query, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OptionalJwtGuard } from '../auth/optional-jwt.guard';
import { RecipesService } from './recipes.service';
import { RecipeRichnessService } from './intelligence/recipe-richness.service';
import { RecipeSearchService } from './search/recipe-search.service';
import { RecipeSafetyFilterService } from './intelligence/recipe-safety-filter.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { SearchRecipesDto } from './dto/search-recipes.dto'; // ← جدید

// Fold common Persian spelling variants so a famous dish is found by its most-typed spelling: قورمه↔قرمه (Iran's most
// famous stew — the corpus indexes «قرمه‌سبزی»), plus the Arabic→Persian letter folds. Applied to every search query.
function normalizeSearchQuery(q?: string): string {
  return String(q ?? '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/ة/g, 'ه').replace(/قورمه/g, 'قرمه').trim();
}

@Controller('recipes')
export class RecipesController {
  constructor(
    private readonly recipesService: RecipesService,
    private readonly richness: RecipeRichnessService,
    private readonly searchService: RecipeSearchService,
    private readonly safety: RecipeSafetyFilterService,
  ) {}

  // OptionalJwtGuard: anonymous allowed, but a logged-in user's declared allergies/observance HARD-filter
  // the popular/fresh rails (Home/Discover read this) — guardian H1 rework. Anonymous → unfiltered (no profile).
  @Get()
  @UseGuards(OptionalJwtGuard)
  async findAll(
    @Req() req,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('category') category?: string,
    @Query('meal') meal?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1); // clamp ≥1 — a negative page made skip negative → Prisma 500
    const limitNum = Math.min(1000, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;
    const userId = req.user?.userId;
    if (userId) {
      const all = await this.recipesService.findAll(0, 1000, category, meal);
      const safe = await this.safety.filter(userId, all.data);
      return {
        ...all,
        data: safe.slice(skip, skip + limitNum),
        total: safe.length,
        page: pageNum,
        pageSize: limitNum,
      };
    }
    return this.recipesService.findAll(skip, limitNum, category, meal);
  }

  /**
   * SEARCH-L4-08: deterministic semantic search (TF-IDF). Public/anonymous base ranking. Backward
   * compatible — returns a recipe[] (ranked by relevance) with an added `_search {score, matchedTerms}`;
   * falls back to the legacy contains-search if the corpus index is empty. Honest empty (no fabrication).
   */
  @Get('search')
  @UseGuards(OptionalJwtGuard)
  async search(@Req() req, @Query() query: SearchRecipesDto) {
    const limitNum = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 10)); // P1-6: clamp — a negative/huge limit was unbounded
    const userId = req.user?.userId;
    const q = normalizeSearchQuery(query.q); // قورمه→قرمه + Arabic folds so famous dishes are found by their common spelling
    const searchLimit = userId ? Math.min(500, Math.max(limitNum * 20, limitNum)) : limitNum;
    const ranked = await this.searchService.search(q, { limit: searchLimit });
    if (ranked.resultStatus !== 'ok') {
      // legacy fallback keeps behavior for empty_query and lets contains catch anything the index missed
      const fallbackLimit = userId ? Math.min(500, Math.max(limitNum * 20, limitNum)) : limitNum;
      const fallback = await this.safety.filter(userId, await this.recipesService.search(q, fallbackLimit));
      return fallback.slice(0, limitNum);
    }
    const ordered = await this.recipesService.findByIdsOrdered(ranked.results.map((r) => r.recipeId));
    const whyById = new Map(ranked.results.map((r) => [r.recipeId, { score: r.score, matchedTerms: r.why.matchedTerms }]));
    const mapped = ordered.map((recipe: any) => ({ ...recipe, _search: whyById.get(recipe.id) ?? null }));
    const filtered = await this.safety.filter(userId, mapped); // HARD safety filter for a logged-in user (anonymous → unfiltered)
    return filtered.slice(0, limitNum);
  }

  /** SEARCH-L4-08: "similar recipes" / more-like-this — deterministic nearest neighbors + WHY. Optional auth. */
  @Get(':id/similar')
  @UseGuards(OptionalJwtGuard)
  async similar(@Req() req, @Param('id') id: string, @Query('limit') limit?: string) {
    const res = await this.searchService.similar(id, { limit: limit ? parseInt(limit, 10) : undefined });
    const results = await this.safety.filter(req.user?.userId, res.results, 'recipeId'); // allergy-safe for a logged-in user
    return { ...res, results };
  }

  @Get('my')
  @UseGuards(AuthGuard('jwt'))
  getMyRecipes(@Req() req) {
    return this.recipesService.getMyRecipes(req.user.userId);
  }

  // P0-1 (recsys audit): the HARD allergy/observance gate must hold on the DIRECT recipe link too, not just the
  // rails/search. Anonymous → unfiltered (no declared profile — documented policy); a logged-in user whose
  // profile conflicts (avoid_allergen / avoid_constraint) is blocked by the SAME gate as /recommendations.
  @Get(':id')
  @UseGuards(OptionalJwtGuard)
  async findOne(@Param('id') id: string, @Req() req) {
    const recipe = await this.recipesService.findOne(id); // 404s for missing/unpublished
    const userId = req.user?.userId;
    if (userId && !(await this.safety.safeIds(userId, [id])).length) {
      throw new ForbiddenException('recipe_unsafe_for_profile');
    }
    return recipe;
  }

  /**
   * RECIPE-L4-07: consolidated rich read — full recipe + integrity + personalized fit + safety +
   * grounded substitution swaps, in ONE authed call (reuses getLivingUserProfile + S1 substitutions).
   * Owner/authed; declared allergies stay a hard safety filter (never softened).
   */
  @Get(':id/full')
  @UseGuards(AuthGuard('jwt'))
  async getFull(@Param('id') id: string, @Req() req) {
    // P0-1: block the FULL body (ingredients + steps) when the recipe conflicts with the user's allergy/observance
    // profile — getRichRecipe computes a fit but never refused to serve it. The cook page reads this endpoint, so
    // blocking here also stops an unsafe recipe from entering cook/step mode (acceptance criterion).
    if (!(await this.safety.safeIds(req.user.userId, [id])).length) {
      throw new ForbiddenException('recipe_unsafe_for_profile');
    }
    return this.richness.getRichRecipe(id, req.user.userId);
  }

  /**
   * Phase-4 cascade — recompute the personalized recipe for the session {servings, swaps, removed}:
   * grounded nutrition (source-locked) + swap allergen re-gate. Read-only; never mutates the recipe,
   * the profile, or the allergy filter. Returns null-safe coverage instead of fabricated numbers.
   */
  @Post(':id/personalize')
  @UseGuards(AuthGuard('jwt'))
  async personalize(
    @Param('id') id: string,
    @Req() req,
    @Body() body: { servings?: number; swaps?: { from: string; to: string }[]; removed?: string[] },
  ) {
    // P0-5 (re-audit): the personalization cascade is a user-facing recipe read (it returns ingredients +
    // grounded nutrition + swaps) — it must hold the SAME hard allergy/observance gate as GET /:id/full.
    // Without it a profile-conflicting recipe could still be personalized via a direct POST, breaking the
    // "every user-facing recipe path is allergy-safe" invariant.
    if (!(await this.safety.safeIds(req.user.userId, [id])).length) {
      throw new ForbiddenException('recipe_unsafe_for_profile');
    }
    return this.richness.personalize(id, req.user.userId, body ?? {});
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Req() req, @Body() createRecipeDto: CreateRecipeDto) {
    return this.recipesService.create(req.user.userId, createRecipeDto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  update(@Param('id') id: string, @Req() req, @Body() updateRecipeDto: UpdateRecipeDto) {
    return this.recipesService.update(id, req.user.userId, updateRecipeDto);
  }
}
