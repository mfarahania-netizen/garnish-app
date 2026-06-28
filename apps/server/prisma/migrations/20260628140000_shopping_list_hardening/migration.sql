-- AlterTable
ALTER TABLE "ShoppingItem" ADD COLUMN     "checkedAt" TIMESTAMP(3),
ADD COLUMN     "ingredientId" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "source" TEXT;

-- CreateIndex
CREATE INDEX "ShoppingItem_shoppingListId_idx" ON "ShoppingItem"("shoppingListId");

-- CreateIndex
CREATE UNIQUE INDEX "ShoppingList_userId_key" ON "ShoppingList"("userId");
