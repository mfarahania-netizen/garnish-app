import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
export declare class AiService {
    private prisma;
    private cacheManager;
    constructor(prisma: PrismaService, cacheManager: Cache);
    handlePrompt(prompt: string, userId?: string): Promise<string>;
    private buildWhereClause;
    private findConceptKey;
    private getHealthySuggestions;
    private expandConcept;
    private analyzeUserIntent;
    private extractIngredients;
    private isGreeting;
    private describeFilters;
    private mealLabel;
    private formatRecipes;
    private getRandomRecipes;
}
