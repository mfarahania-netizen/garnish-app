import { PrismaService } from '../prisma/prisma.service';
export declare class MealPlansService {
    private prisma;
    constructor(prisma: PrismaService);
    getCurrentPlan(userId: string): Promise<({
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
    savePlan(userId: string, weekStart: string, slots: {
        dayOfWeek: number;
        mealType: string;
        recipeId?: string;
        notes?: string;
    }[]): Promise<{
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
    generateSmartPlan(userId: string): Promise<{
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
    addMealSlot(userId: string, dayOfWeek: number, mealType: string, recipeId: string): Promise<{
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
    }>;
    removeMealSlot(userId: string, dayOfWeek: number, mealType: string): Promise<import("@prisma/client").Prisma.BatchPayload | null>;
}
