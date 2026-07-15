export const ONBOARDING_SCHEMA_VERSION = 2 as const;

export const ONBOARDING_STEPS = ['safety', 'preferences', 'taste'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const SAFETY_STATUSES = ['none', 'declared'] as const;
export type SafetyStatus = (typeof SAFETY_STATUSES)[number];

// P0 corpus gate: these are the only EU allergens whose current recipe/ingredient
// coverage passed the live audit. Lupin and sulphites remain fail-closed at the API
// boundary until their corpus coverage is proven; accepting them would create a false
// safety promise even though the wider legacy lexicon knows their names.
export const SUPPORTED_ONBOARDING_ALLERGEN_IDS = [
  'gluten',
  'dairy',
  'egg',
  'nut',
  'peanut',
  'shellfish',
  'fish',
  'soy',
  'sesame',
  'mustard',
  'celery',
] as const;

export const DIET_PATTERNS = [
  'omnivore',
  'flexitarian',
  'vegetarian',
  'vegan',
] as const;
export type DietPattern = (typeof DIET_PATTERNS)[number];

export const WEEKDAY_TIME_BUCKETS = ['under_15', '15_30', '30_60', '60_plus'] as const;
export type WeekdayTimeBucket = (typeof WEEKDAY_TIME_BUCKETS)[number];

export const COOKS_FOR_COUNT_BANDS = ['1', '2', '3_4', '5_plus'] as const;
export type CooksForCountBand = (typeof COOKS_FOR_COUNT_BANDS)[number];

export const TASTE_LIKE_LIMIT = 3 as const;
export const TASTE_DISLIKE_LIMIT = 2 as const;

// Only expose constraints with an audited hard-serving gate. "Halal"/"kosher"
// would imply certification the product cannot make, while no-alcohol/no-beef do
// not yet have complete corpus enforcement. Expand only after a corpus + serving audit.
export const DIETARY_RULES = ['no_pork'] as const;
export type DietaryRule = (typeof DIETARY_RULES)[number];

export interface OnboardingV2View {
  schemaVersion: 2;
  revision: number;
  status: 'draft' | 'completed';
  completedAt: string | null;
  safety: {
    status: 'unknown' | SafetyStatus;
    allergyIds: string[];
    intoleranceIds: string[];
    dietaryRules: DietaryRule[];
  };
  preferences: {
    dietPattern: DietPattern | null;
    weekdayTimeBucket: WeekdayTimeBucket | null;
    cooksForCount: CooksForCountBand | null;
  };
  taste: {
    likedRecipeIds: string[];
    dislikedRecipeIds: string[];
  };
  updatedAt: string | null;
}

export interface OnboardingMutationResponse {
  revision: number;
  replayed: boolean;
}

export interface OnboardingCompleteResponse {
  profileRevision: number;
  completedAt: string;
  nextPath: '/';
  recommendationsEndpoint: '/recommendations?limit=3';
  replayed: boolean;
}
