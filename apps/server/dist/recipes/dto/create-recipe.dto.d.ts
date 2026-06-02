declare class IngredientDto {
    name: string;
    amount?: string;
    unit?: string;
    notes?: string;
}
declare class StepDto {
    title?: string;
    instruction: string;
    duration?: number;
    imageUrl?: string;
}
export declare class CreateRecipeDto {
    title: string;
    description?: string;
    category: string;
    region?: string;
    difficulty?: string;
    cookingTime?: number;
    servings?: number;
    imageUrl?: string;
    videoUrl?: string;
    isPublic?: boolean;
    status?: string;
    prepTime?: string;
    totalTime?: string;
    mealType?: string;
    diet?: string;
    cost?: string;
    tools?: string[];
    tips?: string[];
    faq?: string[];
    categories?: string[];
    allergens?: string[];
    occasion?: string[];
    ingredients?: IngredientDto[];
    steps?: StepDto[];
}
export {};
