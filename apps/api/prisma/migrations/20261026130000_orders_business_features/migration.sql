-- Additive migration for Phat's order history, idempotency, promotion and loyalty work.
-- Existing orders remain valid and keep their current totals.
ALTER TABLE "User"
  ADD COLUMN "loyaltyPoints" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Order"
  ADD COLUMN "discount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "promoCode" TEXT,
  ADD COLUMN "loyaltyAwarded" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "idempotencyHash" TEXT;

CREATE UNIQUE INDEX "Order_userId_idempotencyKey_key"
  ON "Order"("userId", "idempotencyKey");
