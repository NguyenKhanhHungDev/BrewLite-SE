ALTER TABLE "Order" ADD COLUMN "cancellationReason" VARCHAR(300), ADD COLUMN "cancelledAt" TIMESTAMP(3), ADD COLUMN "cancelledById" INTEGER;
ALTER TABLE "Order" ADD CONSTRAINT "Order_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD COLUMN "adminNote" VARCHAR(1000), ADD COLUMN "adminNoteUpdatedAt" TIMESTAMP(3), ADD COLUMN "adminNoteUpdatedById" INTEGER;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_adminNoteUpdatedById_fkey" FOREIGN KEY ("adminNoteUpdatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "InventoryMovement" (
 "id" SERIAL PRIMARY KEY, "ingredientId" INTEGER NOT NULL, "actorId" INTEGER NOT NULL,
 "kind" TEXT NOT NULL, "delta" INTEGER NOT NULL, "stockBefore" INTEGER NOT NULL, "stockAfter" INTEGER NOT NULL,
 "reason" VARCHAR(300) NOT NULL, "idempotencyKey" TEXT, "requestHash" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "InventoryMovement_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "InventoryMovement_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "InventoryMovement_valid_stock" CHECK ("stockBefore" >= 0 AND "stockAfter" >= 0 AND "delta"::BIGINT = "stockAfter"::BIGINT - "stockBefore"::BIGINT),
 CONSTRAINT "InventoryMovement_valid_kind" CHECK ("kind" IN ('RESTOCK','ADJUST'))
);
CREATE UNIQUE INDEX "InventoryMovement_actorId_idempotencyKey_key" ON "InventoryMovement"("actorId", "idempotencyKey");
CREATE INDEX "InventoryMovement_ingredientId_createdAt_idx" ON "InventoryMovement"("ingredientId", "createdAt");
