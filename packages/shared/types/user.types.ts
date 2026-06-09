// packages/shared/types/user.types.ts

export interface UserPreferences {
  id: string;
  diet?: string | null;
  skillLevel?: string | null;
  budget?: string | null;
  allergies: string[];
  cuisine: string[];
  healthGoals: string[];
  updatedAt: string;
}