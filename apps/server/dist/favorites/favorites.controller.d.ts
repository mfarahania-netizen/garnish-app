import { FavoritesService } from './favorites.service';
export declare class FavoritesController {
    private readonly favoritesService;
    constructor(favoritesService: FavoritesService);
    findAll(req: any): Promise<({
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
    add(req: any, recipeId: string): Promise<{
        id: string;
        recipeId: string;
        userId: string;
        addedAt: Date;
    }>;
    remove(req: any, recipeId: string): Promise<{
        id: string;
        recipeId: string;
        userId: string;
        addedAt: Date;
    }>;
}
