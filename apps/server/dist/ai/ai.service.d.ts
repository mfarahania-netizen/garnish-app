import { PrismaService } from '../prisma/prisma.service';
export declare class AiService {
    private prisma;
    constructor(prisma: PrismaService);
    handlePrompt(prompt: string, userId?: string): Promise<string>;
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
