🏛️ GARNISH DATA CONSTITUTION (GDC v2.1 FINAL)
Version: 2.1
Status: Production Standard
Validity: 20 Years
Path: garnish-app/docs/DATA_CONSTITUTION.md

🎯 PURPOSE
This document defines the single source of truth for all recipe data, behavioral tracking, and recommendation intelligence in the Garnish Food Intelligence System.

All systems (Backend, Frontend, AI, Analytics) MUST strictly follow this standard.

🧱 SECTION 1: RECIPE STANDARD (GRCS v1.1)
1.1 Core Identity
json
{
  "id": "uuid",
  "title": "string",
  "description": "string",
  "language": "fa | en | ar | tr | de | fr",
  "status": "draft | review | published | archived",
  "source": {
    "type": "manual | ai | imported",
    "authorId": "uuid"
  },
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
1.2 Classification
json
{
  "category": "enum",
  "cuisine": "enum",
  "cookingMethod": "enum",
  "experienceTags": ["string"]
}
Cooking Methods: grill, oven_baked, fried, stewed, steamed, no_cook, one_pot, pressure_cooker, slow_cooker, air_fryer

Experience Tags: party_food, nature_cooking, travel_food, picnic_food, quick_meal, family_meal, comfort_food, impressive, budget, healthy, high_protein, low_fat, vegan, gluten_free, dairy_free

1.3 Intent Layer (IMPORTANT)
Defines the purpose of the recipe.

json
{
  "intentTags": [
    "weight_loss",
    "muscle_gain",
    "winter_food",
    "summer_food",
    "energy_boost",
    "post_workout",
    "fasting",
    "detox",
    "mood_booster",
    "kids_friendly",
    "elderly_friendly"
  ]
}
1.4 Diet & Allergens
json
{
  "dietTypes": [
    "omnivore",
    "vegetarian",
    "vegan",
    "keto",
    "low_carb",
    "halal",
    "gluten_free",
    "dairy_free"
  ],
  "allergens": [
    "dairy",
    "gluten",
    "nuts",
    "eggs",
    "soy",
    "seafood",
    "sesame"
  ]
}
1.5 Nutrition Model (Per 100g + Serving Context)
json
{
  "nutrition": {
    "per100g": {
      "calories": 0,
      "protein": 0,
      "fat": 0,
      "carbs": 0,
      "fiber": 0,
      "sugar": 0,
      "sodium": 0
    },
    "consumptionContext": {
      "perServingCalories": 0,
      "portionType": "light | medium | heavy",
      "servingSize": "string"
    }
  },
  "yield": {
    "servings": 4
  }
}
1.6 Time & Effort
json
{
  "time": {
    "prepMinutes": 0,
    "cookMinutes": 0,
    "totalMinutes": 0
  },
  "effortLevel": 1,
  "difficulty": "easy | medium | hard"
}
1.7 Ingredients
json
{
  "ingredients": [
    {
      "ingredientId": "uuid",
      "name": "string",
      "amount": "string",
      "unit": "string",
      "importance": 1,
      "optional": false
    }
  ]
}
1.8 Steps
json
{
  "steps": [
    {
      "order": 1,
      "instruction": "string",
      "timeMinutes": 0,
      "difficulty": 1,
      "risk": "low | medium | high"
    }
  ]
}
1.9 Additional Knowledge
json
{
  "tools": ["string"],
  "tips": ["string"],
  "faq": [
    {
      "question": "string",
      "answer": "string"
    }
  ],
  "substitutions": [
    {
      "original": "string",
      "replaceWith": "string",
      "impact": "low | medium | high"
    }
  ],
  "commonIssues": [
    {
      "problem": "string",
      "cause": "string",
      "solution": "string"
    }
  ],
  "notes": "string"
}
🚫 RULE
The behavior field MUST NOT exist in the Recipe model.

All behavioral data is stored in:
👉 UserRecipeInteraction

📊 SECTION 2: BEHAVIORAL EVENT SYSTEM
All user interactions MUST follow this schema.

json
{
  "eventType": "string",
  "userId": "string",
  "recipeId": "string",
  "timestamp": "ISO-8601",
  "metadata": {}
}
Core Events:
recipe_view, favorite_add, favorite_remove, mealplan_add, mealplan_generate, shopping_item_add, shopping_item_toggle, search_query, recommendation_click, recommendation_save, recommendation_cook, recommendation_dismiss, recommendation_ignore, ai_chat_started, ai_message_send

Abuse Prevention & Validation:
Each event MUST include:

Validation rules

Rate limits

Confidence score

📈 SECTION 3: USER RECIPE INTERACTION MODEL
json
{
  "userId": "string",
  "recipeId": "string",
  "completionRate": 0.0,
  "dropOffStep": 0,
  "retryRate": 0.0,
  "saveRate": 0.0,
  "averageRating": 0.0
}
⚙️ SECTION 4: IMPLEMENTATION RULES
Backend (NestJS)

Enums MUST be enforced via DTOs

Validation via class-validator

No free-text for controlled fields

Frontend (React)

All dropdowns MUST use shared constants

No manual enum duplication

Strict type consistency required

🧠 FINAL PRINCIPLES
Recipe data MUST be immutable

Behavior data MUST be separated

Intent data MUST drive recommendation

Nutrition MUST support both per-100g and per-serving analysis

Every ingredient MUST have a unique ingredientId

Recipe lifecycle MUST be tracked via status

Source metadata MUST be preserved for quality control

Yield MUST be explicit for accurate per-serving calculations