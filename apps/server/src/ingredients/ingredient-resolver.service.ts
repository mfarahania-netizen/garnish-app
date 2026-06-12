import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildResolverIndex,
  resolveWithIndex,
  ResolverIndex,
  ResolveResult,
} from './ingredient-resolver.core';

/**
 * IngredientResolverService (E11, Part 3 Layer 5).
 *
 * Runtime "free text -> ingredientId" resolver. Loads every ingredient's
 * aliases/names/code from the DB once at boot, builds normalized lookup indexes,
 * and resolves arbitrary input (recipes, AI, search). On a miss it raises a
 * `resolve_miss` signal (EventType.RESOLVE_MISS) — a system-level data-quality
 * marker logged + counted (no user/PII context; not routed through the canonical
 * event envelope, which is out of scope here).
 */
@Injectable()
export class IngredientResolverService implements OnModuleInit {
  private readonly logger = new Logger('IngredientResolver');
  private index: ResolverIndex = {
    alias: new Map(),
    name: new Map(),
    code: new Map(),
    size: 0,
  };
  private resolveMissCount = 0;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.reload();
  }

  /** Rebuild the in-memory index from the DB (call after a data import). */
  async reload(): Promise<void> {
    const ingredients = await this.prisma.ingredient.findMany({
      select: { id: true, nameFa: true, nameEn: true, code: true, recipeInputAliases: true },
    });
    this.index = buildResolverIndex(ingredients);
    this.logger.log(
      `Resolver index built: ${this.index.size} ingredients, ` +
        `${this.index.alias.size} aliases, ${this.index.name.size} names, ${this.index.code.size} codes`,
    );
  }

  resolve(rawText: string): ResolveResult {
    const result = resolveWithIndex(this.index, rawText);
    if (result.matchType === 'miss') {
      this.resolveMissCount += 1;
      // EventType.RESOLVE_MISS — data-quality signal for unresolved ingredient text.
      this.logger.debug(`resolve_miss normalized="${result.normalized}"`);
    }
    return result;
  }

  resolveMany(texts: string[]): ResolveResult[] {
    return texts.map((t) => this.resolve(t));
  }

  getStats() {
    return {
      ingredients: this.index.size,
      aliases: this.index.alias.size,
      names: this.index.name.size,
      codes: this.index.code.size,
      resolveMissCount: this.resolveMissCount,
    };
  }
}
