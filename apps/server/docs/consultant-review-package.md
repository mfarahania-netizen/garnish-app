# Garnish Recommendation Review Package

Generated for the test user:

- userId: `76722b8e-0063-48c0-8031-71f306aad907`
- phone: `09123456789`
- dataset: phase-one recipes v0.5.4
- active recipes: 122
- ingredient dictionary: 1008 verified ingredients
- recipe ingredient lines: 1223
- linked ingredient lines: 1223
- ingredient coverage: 100%

## Curl Commands

```cmd
curl.exe -H "Authorization: Bearer <TOKEN>" "http://localhost:3000/recommendations?limit=10"
curl.exe -H "Authorization: Bearer <TOKEN>" "http://localhost:3000/review-report"
curl.exe -H "Authorization: Bearer <TOKEN>" "http://localhost:3000/feature-vector"
curl.exe -H "Authorization: Bearer <TOKEN>" "http://localhost:3000/exposure-memory"
```

Viewport-qualified impression tracking:

```powershell
$headers = @{ Authorization = "Bearer <TOKEN>" }
$body = @{
  recipeIds = @(
    "garnish_recipe_fa_2094_845c07e3",
    "garnish_recipe_fa_1084_8f35205e",
    "garnish_recipe_fa_2071_5391bddf",
    "garnish_recipe_fa_1334_8963bd85",
    "garnish_recipe_fa_1820_41034bbe"
  )
  viewportMs = 1500
  visibleRatio = 0.75
  source = "consultant_review_curl"
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/recommendations/impression" -Headers $headers -ContentType "application/json" -Body $body
```

## Recommendation Evidence

Top recommendation sample after ingredient-intelligence polish:

```json
{
  "title": "پیتزا مرغ و پستو",
  "finalScore": 0.6,
  "scores": {
    "tasteAffinity": 0.69,
    "behaviorFit": 0.43,
    "outcomeFit": 0.71,
    "novelty": 0.4,
    "recency": 1,
    "recipeUnderstanding": 0.7,
    "ingredientIntelligence": 0.83,
    "exposurePenalty": 0
  },
  "contributions": {
    "tasteAffinity": 31,
    "behaviorFit": 16,
    "outcomeFit": 20,
    "recipeUnderstanding": 12,
    "ingredientIntelligence": 12
  },
  "matchedSignals": [
    "ingredient_likes_chicken_fit",
    "ingredient_likes_mushroom_fit",
    "ingredient_dictionary_linked",
    "ingredient_profile_depth",
    "ingredient_nutrition_coverage"
  ]
}
```

## Review Report Evidence

Current review report highlights:

```json
{
  "reviewReadinessScore": 94,
  "reviewStatus": "consultant_ready",
  "recommendationQuality": 67,
  "recommendationReward": 90.2,
  "impressions": 81,
  "clicks": 31,
  "saves": 6,
  "cooks": 6,
  "clickThroughRate": 0.38,
  "dataMaturity": {
    "dataMaturity": "warming_up",
    "confidenceLevel": "reliable",
    "behavioralReliability": 0.74
  }
}
```

Ingredient intelligence:

```json
{
  "dictionaryCount": 1008,
  "recipeIngredientLines": 1223,
  "linkedRecipeIngredientLines": 1223,
  "coverage": 1,
  "ready": true
}
```

Ranking evidence:

```json
{
  "personalizationDrivers": [
    "outcomeFit",
    "behaviorFit",
    "tasteAffinity",
    "ingredientIntelligence",
    "recipeUnderstanding"
  ],
  "hasRecipeUnderstanding": true,
  "hasIngredientIntelligence": true,
  "hasBehaviorSignals": true,
  "hasExposureMemory": true,
  "ingredientCoverage": 1,
  "readyForConsultantReview": true
}
```

## What Changed Since The Previous Weak Output

- The previous generic score set (`health`, `taste`, `behavior`) has been replaced by feature-based ranking.
- Recipe ingredients are now linked to canonical verified ingredients through Prisma relations.
- Ranking uses verified ingredient intelligence instead of only recipe title/category text.
- Recommendation fetch does not create fake impressions.
- Real viewport-qualified impressions are tracked through `POST /recommendations/impression`.
- Review diagnostics now expose ingredient coverage, feature drivers, exposure memory, and readiness evidence.

## Current Watch Items

- The test user is still in `warming_up` data maturity, not long-term production maturity.
- Exposure memory exists for the new v0.5.4 recipes, but long-term repeated exposure penalties need more real sessions.
- Some top-level outcome signals remain strong; future real user feedback should continue balancing outcome, taste, and behavior.
