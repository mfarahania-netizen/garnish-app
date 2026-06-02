import { PrismaService } from '../prisma/prisma.service';
export declare class FavoritesService {
    private prisma;
    constructor(prisma: PrismaService);
    getFavorites(userId: string): Promise<({
        recipe: {
            title: string;
            imageUrl: string | null;
            description: string | null;
            category: string;
            region: string | null;
            difficulty: string | null;
            cookingTime: number | null;
            servings: number | null;
            videoUrl: string | null;
            isPublic: boolean;
            status: string | null;
            prepTime: string | null;
            totalTime: string | null;
            mealType: string | null;
            diet: string | null;
            cost: string | null;
            tools: string | null;
            tips: string | null;
            faq: string | null;
            categories: string | null;
            allergens: string | null;
            occasion: string | null;
            id: string;
            authorId: string | null;
            createdAt: Date;
            updatedAt: Date;
            adminNote: string | null;
        };
    } & {
        id: string;
        recipeId: string;
        userId: string;
        addedAt: Date;
    })[]>;
    addFavorite(userId: string, recipeId: string): Promise<{
        id: string;
        recipeId: string;
        userId: string;
        addedAt: Date;
    }>;
    removeFavorite(userId: string, recipeId: string): Promise<{
        id: string;
        recipeId: string;
        userId: string;
        addedAt: Date;
    }>;
}
