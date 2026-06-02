-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "name" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "diet" TEXT,
    "allergies" TEXT NOT NULL DEFAULT '[]',
    "skillLevel" TEXT,
    "cuisine" TEXT NOT NULL DEFAULT '[]',
    "budget" TEXT,
    "healthGoals" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "region" TEXT,
    "difficulty" TEXT,
    "cookingTime" INTEGER,
    "servings" INTEGER,
    "imageUrl" TEXT,
    "videoUrl" TEXT,
    "authorId" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT DEFAULT 'pending',
    "adminNote" TEXT,
    "prepTime" TEXT,
    "totalTime" TEXT,
    "tools" TEXT DEFAULT '[]',
    "tips" TEXT DEFAULT '[]',
    "faq" TEXT DEFAULT '[]',
    "mealType" TEXT,
    "diet" TEXT,
    "categories" TEXT DEFAULT '[]',
    "allergens" TEXT DEFAULT '[]',
    "occasion" TEXT DEFAULT '[]',
    "cost" TEXT,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeIngredient" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" TEXT,
    "unit" TEXT,
    "notes" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeStep" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "title" TEXT,
    "instruction" TEXT NOT NULL,
    "duration" INTEGER,
    "imageUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RecipeStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Nutrition" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "calories" DOUBLE PRECISION,
    "protein" DOUBLE PRECISION,
    "carbs" DOUBLE PRECISION,
    "fat" DOUBLE PRECISION,
    "fiber" DOUBLE PRECISION,

    CONSTRAINT "Nutrition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchTerm" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "term" TEXT NOT NULL,

    CONSTRAINT "SearchTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FavoriteRecipe" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteRecipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealSlot" (
    "id" TEXT NOT NULL,
    "mealPlanId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "mealType" TEXT NOT NULL,
    "recipeId" TEXT,
    "notes" TEXT,

    CONSTRAINT "MealSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShoppingList" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShoppingList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShoppingItem" (
    "id" TEXT NOT NULL,
    "shoppingListId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" TEXT,
    "unit" TEXT,
    "isChecked" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShoppingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "data" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketReply" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isStaff" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "device" TEXT,
    "ip" TEXT,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionId" TEXT,
    "page" TEXT,
    "duration" INTEGER,
    "payload" TEXT,
    "enrichment" TEXT,

    CONSTRAINT "UserEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBehaviorProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "favoriteFoods" TEXT DEFAULT '[]',
    "dislikedFoods" TEXT DEFAULT '[]',
    "budgetRange" TEXT,
    "shoppingPattern" TEXT DEFAULT '[]',
    "mealTiming" TEXT DEFAULT '{}',
    "cookingSkill" TEXT,
    "healthGoals" TEXT DEFAULT '[]',
    "motivationStyle" TEXT,
    "consistencyScore" DOUBLE PRECISION DEFAULT 0.0,
    "churnRiskScore" DOUBLE PRECISION DEFAULT 0.0,
    "familySize" INTEGER DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserBehaviorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Nutrition_recipeId_key" ON "Nutrition"("recipeId");

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteRecipe_userId_recipeId_key" ON "FavoriteRecipe"("userId", "recipeId");

-- CreateIndex
CREATE INDEX "UserEvent_userId_type_timestamp_idx" ON "UserEvent"("userId", "type", "timestamp");

-- CreateIndex
CREATE INDEX "UserEvent_timestamp_idx" ON "UserEvent"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "UserBehaviorProfile_userId_key" ON "UserBehaviorProfile"("userId");

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeStep" ADD CONSTRAINT "RecipeStep_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nutrition" ADD CONSTRAINT "Nutrition_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchTerm" ADD CONSTRAINT "SearchTerm_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteRecipe" ADD CONSTRAINT "FavoriteRecipe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteRecipe" ADD CONSTRAINT "FavoriteRecipe_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealSlot" ADD CONSTRAINT "MealSlot_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealSlot" ADD CONSTRAINT "MealSlot_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingList" ADD CONSTRAINT "ShoppingList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingItem" ADD CONSTRAINT "ShoppingItem_shoppingListId_fkey" FOREIGN KEY ("shoppingListId") REFERENCES "ShoppingList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketReply" ADD CONSTRAINT "TicketReply_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEvent" ADD CONSTRAINT "UserEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEvent" ADD CONSTRAINT "UserEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "UserSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBehaviorProfile" ADD CONSTRAINT "UserBehaviorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
