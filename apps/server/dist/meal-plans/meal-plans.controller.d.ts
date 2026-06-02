import { MealPlansService } from './meal-plans.service';
export declare class MealPlansController {
    private readonly mealPlansService;
    constructor(mealPlansService: MealPlansService);
    getCurrentPlan(req: any): Promise<({
        slots: ({
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
            } | null;
        } & {
            notes: string | null;
            mealType: string;
            id: string;
            recipeId: string | null;
            dayOfWeek: number;
            mealPlanId: string;
        })[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        weekStart: Date;
    }) | null>;
    savePlan(req: any, body: {
        weekStart: string;
        slots: any[];
    }): Promise<{
        slots: ({
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
            } | null;
        } & {
            notes: string | null;
            mealType: string;
            id: string;
            recipeId: string | null;
            dayOfWeek: number;
            mealPlanId: string;
        })[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        weekStart: Date;
    }>;
    generatePlan(req: any): Promise<{
        slots: ({
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
            } | null;
        } & {
            notes: string | null;
            mealType: string;
            id: string;
            recipeId: string | null;
            dayOfWeek: number;
            mealPlanId: string;
        })[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        weekStart: Date;
    }>;
}
