# Garnish Coverage Matrix

> **GENERATED ARTIFACT — do not hand-edit.** Regenerate with `pnpm coverage:matrix`.
> Source of intent: `tools/coverage/coverage.registry.json` (the only hand-maintained coverage file).
> Source of truth: live code, parsed by `tools/coverage/coverage-scan.mjs`.

`Design (GES ref)` and `States(L/E/Err)` are not derivable from code and are tracked
via the GES / Figma Code Connect sync — emitted as `—` until that link exists.

## Counts

- models: **52**, Recipe fields: **37** (27 scalar + 10 relations)
- endpoints: **91** across **19** controllers (9 internal)
- frontend routes: **17** (11 protected), API call sites: **67**
- events: backend **117**, frontend **116**

## Endpoints

### AdminController

| Capability | Backend (endpoint) | Frontend (route/component) | Design (GES ref) | States(L/E/Err) | Status |
|---|---|---|---|---|---|
| getAIInteractionStats | `GET /admin/analytics/ai-interaction` _(jwt+roles(admin))_ | _(admin dashboard)_ | — | — | 🛠 admin |
| getBehaviorProfiles | `GET /admin/analytics/behavior-profiles` _(jwt+roles(admin))_ | _(admin dashboard)_ | — | — | 🛠 admin |
| getRecentEvents | `GET /admin/analytics/events` _(jwt+roles(admin))_ | _(admin dashboard)_ | — | — | 🛠 admin |
| getMealPlanningStats | `GET /admin/analytics/meal-planning` _(jwt+roles(admin))_ | _(admin dashboard)_ | — | — | 🛠 admin |
| getPageViewStats | `GET /admin/analytics/page-views` _(jwt+roles(admin))_ | _(admin dashboard)_ | — | — | 🛠 admin |
| getRecipeStats | `GET /admin/analytics/recipes-stats` _(jwt+roles(admin))_ | _(admin dashboard)_ | — | — | 🛠 admin |
| getTopSearchQueries | `GET /admin/analytics/search-queries` _(jwt+roles(admin))_ | _(admin dashboard)_ | — | — | 🛠 admin |
| getShoppingAnalytics | `GET /admin/analytics/shopping` _(jwt+roles(admin))_ | _(admin dashboard)_ | — | — | 🛠 admin |
| getAnalyticsStats | `GET /admin/analytics/stats` _(jwt+roles(admin))_ | _(admin dashboard)_ | — | — | 🛠 admin |
| getSystemHealth | `GET /admin/analytics/system-health` _(jwt+roles(admin))_ | _(admin dashboard)_ | — | — | 🛠 admin |
| getUserStats | `GET /admin/analytics/user-stats` _(jwt+roles(admin))_ | _(admin dashboard)_ | — | — | 🛠 admin |
| getDashboard | `GET /admin/dashboard` _(jwt+roles(admin))_ | _(admin dashboard)_ | — | — | 🛠 admin |
| getRecipes | `GET /admin/recipes` _(jwt+roles(admin))_ | _(admin dashboard)_ | — | — | 🛠 admin |
| approveRecipe | `PATCH /admin/recipes/:id/approve` _(jwt+roles(admin))_ | _(admin dashboard)_ | — | — | 🛠 admin |
| rejectRecipe | `PATCH /admin/recipes/:id/reject` _(jwt+roles(admin))_ | _(admin dashboard)_ | — | — | 🛠 admin |
| getTickets | `GET /admin/tickets` _(jwt+roles(admin))_ | _(admin dashboard)_ | — | — | 🛠 admin |
| respondToTicket | `POST /admin/tickets/:id/respond` _(jwt+roles(admin))_ | _(admin dashboard)_ | — | — | 🛠 admin |
| updateTicketStatus | `PATCH /admin/tickets/:id/status` _(jwt+roles(admin))_ | _(admin dashboard)_ | — | — | 🛠 admin |
| getUsers | `GET /admin/users` _(jwt+roles(admin))_ | _(admin dashboard)_ | — | — | 🛠 admin |

### AiController

| Capability | Backend (endpoint) | Frontend (route/component) | Design (GES ref) | States(L/E/Err) | Status |
|---|---|---|---|---|---|
| chat | `POST /ai/chat` _(jwt)_ | `ai-chat/AIChatPage` | — | — | ✅ mapped |

### AnalyticsController

| Capability | Backend (endpoint) | Frontend (route/component) | Design (GES ref) | States(L/E/Err) | Status |
|---|---|---|---|---|---|
| trackEvent | `POST /analytics/event` _(jwt)_ | `_global/useAnalytics` | — | — | ✅ mapped |

### AuthController

| Capability | Backend (endpoint) | Frontend (route/component) | Design (GES ref) | States(L/E/Err) | Status |
|---|---|---|---|---|---|
| login | `POST /auth/login` _(throttler)_ | `auth/AuthPage` | — | — | ✅ mapped |
| register | `POST /auth/register` _(throttler)_ | `auth/AuthPage` | — | — | ✅ mapped |

### FavoritesController

| Capability | Backend (endpoint) | Frontend (route/component) | Design (GES ref) | States(L/E/Err) | Status |
|---|---|---|---|---|---|
| findAll | `GET /favorites` _(jwt)_ | `favorites/FavoritesPage` | — | — | ✅ mapped |
| remove | `DELETE /favorites/:recipeId` _(jwt)_ | `favorites/FavoritesPage` | — | — | ✅ mapped |
| add | `POST /favorites/:recipeId` _(jwt)_ | `favorites/FavoritesPage` | — | — | ✅ mapped |

### MealPlansController

| Capability | Backend (endpoint) | Frontend (route/component) | Design (GES ref) | States(L/E/Err) | Status |
|---|---|---|---|---|---|
| getCurrentPlan | `GET /meal-plans` _(jwt)_ | `plan/PlanPage` | — | — | ✅ mapped |
| savePlan | `POST /meal-plans` _(jwt)_ | `plan/PlanPage` | — | — | ✅ mapped |
| generatePlan | `POST /meal-plans/generate` _(jwt)_ | `plan/PlanPage` | — | — | ✅ mapped |
| addMealSlot | `POST /meal-plans/slots` _(jwt)_ | `plan/PlanPage` | — | — | ✅ mapped |
| removeMealSlot | `DELETE /meal-plans/slots/:dayOfWeek/:mealType` _(jwt)_ | `plan/PlanPage` | — | — | ✅ mapped |

### NotificationsController

| Capability | Backend (endpoint) | Frontend (route/component) | Design (GES ref) | States(L/E/Err) | Status |
|---|---|---|---|---|---|
| findAll | `GET /notifications` _(jwt)_ | `notifications/NotificationsPage` | — | — | ✅ mapped |
| remove | `DELETE /notifications/:id` _(jwt)_ | `notifications/NotificationsPage` | — | — | ✅ mapped |
| markAsRead | `PATCH /notifications/:id/read` _(jwt)_ | `notifications/NotificationsPage` | — | — | ✅ mapped |
| generate | `POST /notifications/generate` _(jwt)_ | `notifications/NotificationsPage` | — | — | ✅ mapped |

### RecipesController

| Capability | Backend (endpoint) | Frontend (route/component) | Design (GES ref) | States(L/E/Err) | Status |
|---|---|---|---|---|---|
| findAll | `GET /recipes` | `recipes/RecipesPage` | — | — | ✅ mapped |
| create | `POST /recipes` _(jwt)_ | `add-recipe/AddRecipePage` | — | — | ✅ mapped |
| findOne | `GET /recipes/:id` | `recipe-detail/RecipeDetailPage` | — | — | ✅ mapped |
| update | `PATCH /recipes/:id` _(jwt)_ | _(none — E-recipe-edit-ui)_ | — | — | 🕓 deferred |
| getMyRecipes | `GET /recipes/my` _(jwt)_ | `my-recipes/MyRecipesPage` | — | — | ✅ mapped |
| search | `GET /recipes/search` | `recipes/RecipesPage` | — | — | ✅ mapped |

### RecommendationActivationReviewController

| Capability | Backend (endpoint) | Frontend (route/component) | Design (GES ref) | States(L/E/Err) | Status |
|---|---|---|---|---|---|
| dryRun | `POST /internal/recommendation-shadow/activation-review/dry-run` _(jwt+roles(admin))_ | _(none — internal)_ | — | — | ⚙️ internal |
| summary | `GET /internal/recommendation-shadow/activation-review/summary` _(jwt+roles(admin))_ | _(none — internal)_ | — | — | ⚙️ internal |

### RecommendationController

| Capability | Backend (endpoint) | Frontend (route/component) | Design (GES ref) | States(L/E/Err) | Status |
|---|---|---|---|---|---|
| getRecommendations | `GET /recommendations` _(jwt)_ | `home/HomePage` | — | — | ✅ mapped |
| buildIdentity | `POST /recommendations/build-identity` _(jwt+roles(admin))_ | _(admin dashboard)_ | — | — | 🛠 admin |
| buildSnapshots | `POST /recommendations/build-snapshots` _(jwt+roles(admin))_ | _(admin dashboard)_ | — | — | 🛠 admin |
| compareScenarios | `GET /recommendations/compare` _(jwt)_ | _(admin dashboard)_ | — | — | 🛠 admin |
| debugFeatures | `GET /recommendations/debug-features` _(jwt+roles(admin))_ | _(none — internal)_ | — | — | ⚙️ internal |
| getEmbedding | `GET /recommendations/embedding/:recipeId` _(jwt+roles(admin))_ | _(none — internal)_ | — | — | ⚙️ internal |
| trackImpression | `POST /recommendations/impression` _(jwt)_ | _(none — E-recommendation-impression-api)_ | — | — | 🕓 deferred |
| getLifestyle | `GET /recommendations/lifestyle` _(jwt)_ | _(none — E-recommendation-lifestyle)_ | — | — | 🕓 deferred |
| runSignalDetector | `POST /recommendations/run-signal-detector` _(jwt+roles(admin))_ | _(admin dashboard)_ | — | — | 🛠 admin |
| testPenalty | `GET /recommendations/test-penalty/:recipeId` _(jwt+roles(admin))_ | _(none — internal)_ | — | — | ⚙️ internal |

### RecommendationDiagnosticsController

| Capability | Backend (endpoint) | Frontend (route/component) | Design (GES ref) | States(L/E/Err) | Status |
|---|---|---|---|---|---|
| getAttribution | `GET /attribution` _(jwt+roles(admin))_ | _(admin dashboard)_ | — | — | 🛠 admin |
| getExposureMemory | `GET /exposure-memory` _(jwt+roles(admin))_ | _(admin dashboard)_ | — | — | 🛠 admin |
| getFeatureImportance | `GET /feature-importance` _(jwt+roles(admin))_ | _(admin dashboard)_ | — | — | 🛠 admin |
| getFeatureVector | `GET /feature-vector` _(jwt+roles(admin))_ | _(admin dashboard)_ | — | — | 🛠 admin |
| getGovernance | `GET /governance` _(jwt+roles(admin))_ | _(admin dashboard)_ | — | — | 🛠 admin |
| getLifestyle | `GET /lifestyle` _(jwt+roles(admin))_ | _(admin dashboard)_ | — | — | 🛠 admin |
| getMetrics | `GET /metrics` _(jwt+roles(admin))_ | _(admin dashboard)_ | — | — | 🛠 admin |
| getOutcomes | `GET /outcomes` _(jwt+roles(admin))_ | _(admin dashboard)_ | — | — | 🛠 admin |
| getRecommendationQuality | `GET /recommendation-quality` _(jwt+roles(admin))_ | _(admin dashboard)_ | — | — | 🛠 admin |
| getRecommendationReward | `GET /recommendation-reward` _(jwt+roles(admin))_ | _(admin dashboard)_ | — | — | 🛠 admin |
| getReport | `GET /report` _(jwt+roles(admin))_ | _(admin dashboard)_ | — | — | 🛠 admin |
| getReviewReport | `GET /review-report` _(jwt+roles(admin))_ | _(admin dashboard)_ | — | — | 🛠 admin |
| getSignals | `GET /signals` _(jwt+roles(admin))_ | _(admin dashboard)_ | — | — | 🛠 admin |
| getSummary | `GET /summary` _(jwt+roles(admin))_ | _(admin dashboard)_ | — | — | 🛠 admin |

### RecommendationExperimentExecutionController

| Capability | Backend (endpoint) | Frontend (route/component) | Design (GES ref) | States(L/E/Err) | Status |
|---|---|---|---|---|---|
| run | `POST /internal/recommendation-shadow/experiment-execution/run` _(jwt+roles(admin))_ | _(none — internal)_ | — | — | ⚙️ internal |
| summary | `GET /internal/recommendation-shadow/experiment-execution/summary` _(jwt+roles(admin))_ | _(none — internal)_ | — | — | ⚙️ internal |

### RecommendationFounderReviewController

| Capability | Backend (endpoint) | Frontend (route/component) | Design (GES ref) | States(L/E/Err) | Status |
|---|---|---|---|---|---|
| evidencePack | `POST /internal/recommendation-shadow/founder-review/evidence-pack` _(jwt+roles(admin))_ | _(none — internal)_ | — | — | ⚙️ internal |
| summary | `GET /internal/recommendation-shadow/founder-review/summary` _(jwt+roles(admin))_ | _(none — internal)_ | — | — | ⚙️ internal |

### RecommendationLabController

| Capability | Backend (endpoint) | Frontend (route/component) | Design (GES ref) | States(L/E/Err) | Status |
|---|---|---|---|---|---|
| run | `POST /internal/recommendation-shadow/lab/run` _(jwt+roles(admin))_ | _(none — internal)_ | — | — | ⚙️ internal |
| summary | `GET /internal/recommendation-shadow/lab/summary` _(jwt+roles(admin))_ | _(none — internal)_ | — | — | ⚙️ internal |

### RecommendationShadowControlPlaneController

| Capability | Backend (endpoint) | Frontend (route/component) | Design (GES ref) | States(L/E/Err) | Status |
|---|---|---|---|---|---|
| summary | `GET /internal/recommendation-shadow/control-plane/summary` _(jwt+roles(admin))_ | _(none — internal)_ | — | — | ⚙️ internal |

### ShoppingListController

| Capability | Backend (endpoint) | Frontend (route/component) | Design (GES ref) | States(L/E/Err) | Status |
|---|---|---|---|---|---|
| getList | `GET /shopping-list` _(jwt)_ | `shopping-list/ShoppingListPage` | — | — | ✅ mapped |
| addItems | `POST /shopping-list/items` _(jwt)_ | `shopping-list/ShoppingListPage` | — | — | ✅ mapped |
| removeItem | `DELETE /shopping-list/items/:id` _(jwt)_ | `shopping-list/ShoppingListPage` | — | — | ✅ mapped |
| toggleItem | `PATCH /shopping-list/items/:id` _(jwt)_ | `shopping-list/ShoppingListPage` | — | — | ✅ mapped |

### SupportController

| Capability | Backend (endpoint) | Frontend (route/component) | Design (GES ref) | States(L/E/Err) | Status |
|---|---|---|---|---|---|
| getTickets | `GET /support/tickets` _(jwt)_ | `support/SupportPage` | — | — | ✅ mapped |
| createTicket | `POST /support/tickets` _(jwt)_ | `support/SupportPage` | — | — | ✅ mapped |
| getTicket | `GET /support/tickets/:id` _(jwt)_ | _(none — E-support-ticket-detail)_ | — | — | 🕓 deferred |
| closeTicket | `PATCH /support/tickets/:id/close` _(jwt)_ | `support/SupportPage` | — | — | ✅ mapped |
| addReply | `POST /support/tickets/:id/replies` _(jwt)_ | `support/SupportPage` | — | — | ✅ mapped |

### UploadController

| Capability | Backend (endpoint) | Frontend (route/component) | Design (GES ref) | States(L/E/Err) | Status |
|---|---|---|---|---|---|
| uploadAvatar | `POST /upload/avatar` _(jwt)_ | `profile/ProfilePage` | — | — | ✅ mapped |

### UsersController

| Capability | Backend (endpoint) | Frontend (route/component) | Design (GES ref) | States(L/E/Err) | Status |
|---|---|---|---|---|---|
| grantConsent | `POST /users/consent` _(jwt)_ | `_global/ConsentModal` | — | — | ✅ mapped |
| deleteAccount | `DELETE /users/me` _(jwt)_ | _(none — E-gdpr-self-service)_ | — | — | 🕓 deferred |
| getProfile | `GET /users/me` _(jwt)_ | `profile/ProfilePage` | — | — | ✅ mapped |
| updateProfile | `PATCH /users/me` _(jwt)_ | `profile/ProfilePage` | — | — | ✅ mapped |
| exportMe | `GET /users/me/export` _(jwt)_ | _(none — E-gdpr-self-service)_ | — | — | 🕓 deferred |
| getPreferences | `GET /users/preferences` _(jwt)_ | `preferences/PreferencesPage` | — | — | ✅ mapped |
| updatePreferences | `PUT /users/preferences` _(jwt)_ | `preferences/PreferencesPage` | — | — | ✅ mapped |

## Recipe fields (tracked entity)

| Capability | Backend (model field) | Frontend (route/component) | Design (GES ref) | States(L/E/Err) | Status |
|---|---|---|---|---|---|
| Recipe.adminNote ⚠︎ | `Recipe.adminNote` _(String?)_ | _(admin dashboard)_ | — | — | 🛠 admin |
| Recipe.allergens | `Recipe.allergens` _(String?)_ | `recipe-detail/FeaturesCard` | — | — | ✅ mapped |
| Recipe.author ⚠︎ | `Recipe.author` _(relation)_ | _(none — debt)_ | — | — | 🔴 must-render (debt) |
| Recipe.authorId ⚠︎ | `Recipe.authorId` _(String?)_ | _(none — internal)_ | — | — | ⚙️ internal |
| Recipe.categories ⚠︎ | `Recipe.categories` _(String?)_ | _(none — debt)_ | — | — | 🔴 must-render (debt) |
| Recipe.category | `Recipe.category` _(String)_ | `recipe-detail/RecipeHero` | — | — | ✅ mapped |
| Recipe.cookingTime | `Recipe.cookingTime` _(Int?)_ | `recipe-detail/TimingCard` | — | — | ✅ mapped |
| Recipe.cost | `Recipe.cost` _(String?)_ | `recipe-detail/FeaturesCard` | — | — | ✅ mapped |
| Recipe.createdAt ⚠︎ | `Recipe.createdAt` _(DateTime)_ | _(none — E-recipe-metadata)_ | — | — | 🕓 deferred |
| Recipe.description | `Recipe.description` _(String?)_ | `recipe-detail/RecipeDetailPage` | — | — | ✅ mapped |
| Recipe.diet | `Recipe.diet` _(String?)_ | `recipe-detail/FeaturesCard` | — | — | ✅ mapped |
| Recipe.difficulty | `Recipe.difficulty` _(String?)_ | `recipe-detail/FeaturesCard` | — | — | ✅ mapped |
| Recipe.faq | `Recipe.faq` _(String?)_ | `recipe-detail/FaqSection` | — | — | ✅ mapped |
| Recipe.id | `Recipe.id` _(String)_ | `recipe-detail/RecipeDetailPage` | — | — | ✅ mapped |
| Recipe.imageUrl ⚠︎ | `Recipe.imageUrl` _(String?)_ | `recipe-card/RecipeCard` | — | — | ✅ mapped |
| Recipe.isPublic ⚠︎ | `Recipe.isPublic` _(Boolean)_ | _(none — internal)_ | — | — | ⚙️ internal |
| Recipe.mealType | `Recipe.mealType` _(String?)_ | `recipe-detail/FeaturesCard` | — | — | ✅ mapped |
| Recipe.occasion | `Recipe.occasion` _(String?)_ | `recipe-detail/FeaturesCard` | — | — | ✅ mapped |
| Recipe.prepTime | `Recipe.prepTime` _(String?)_ | `recipe-detail/TimingCard` | — | — | ✅ mapped |
| Recipe.region | `Recipe.region` _(String?)_ | `recipe-detail/FeaturesCard` | — | — | ✅ mapped |
| Recipe.servings | `Recipe.servings` _(Int?)_ | `recipe-detail/TimingCard` | — | — | ✅ mapped |
| Recipe.status ⚠︎ | `Recipe.status` _(String?)_ | _(admin dashboard)_ | — | — | 🛠 admin |
| Recipe.tips | `Recipe.tips` _(String?)_ | `recipe-detail/TipsSection` | — | — | ✅ mapped |
| Recipe.title | `Recipe.title` _(String)_ | `recipe-detail/RecipeHero` | — | — | ✅ mapped |
| Recipe.tools | `Recipe.tools` _(String?)_ | `recipe-detail/ToolsSection` | — | — | ✅ mapped |
| Recipe.totalTime | `Recipe.totalTime` _(String?)_ | `recipe-detail/TimingCard` | — | — | ✅ mapped |
| Recipe.updatedAt ⚠︎ | `Recipe.updatedAt` _(DateTime)_ | _(none — internal)_ | — | — | ⚙️ internal |
| Recipe.videoUrl ⚠︎ | `Recipe.videoUrl` _(String?)_ | _(none — E-recipe-media)_ | — | — | 🕓 deferred |

> ⚠︎ = not found by the (heuristic) recipe-detail render scan.

## Events

- shared (defined both sides): **116**
- backend-only (orphan): `resolve_miss`
- frontend-only (orphan): _(none)_

