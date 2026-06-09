// packages/shared/types/recipe.types.ts

export interface RecipeIngredient {
  name: string;
  amount?: string | null;
  unit?: string | null;
  notes?: string | null;
}

export interface RecipeStep {
  title?: string;
  instruction: string;
  duration?: number;
  imageUrl?: string;
}

export interface Recipe {
  id: string;
  title: string;
  description?: string;
  category: string;
  region?: string;
  difficulty?: string;
  cookingTime?: number;
  servings?: number;
  imageUrl?: string;
  videoUrl?: string;
  authorId?: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  status?: string;
  prepTime?: string;
  totalTime?: string;
  tools: string[];
  tips: string[];
  faq: { question: string; answer?: string }[];
  mealType?: string;
  diet?: string;
  categories: string[];
  allergens: string[];
  occasion: string[];
  cost?: string;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
}