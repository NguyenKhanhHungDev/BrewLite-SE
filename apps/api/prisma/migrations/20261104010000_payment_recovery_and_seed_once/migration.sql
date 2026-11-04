ALTER TABLE "Payment" ADD COLUMN "creationStatus" TEXT NOT NULL DEFAULT 'UNKNOWN', ADD COLUMN "lastQueriedAt" TIMESTAMP(3);
UPDATE "Payment" SET "creationStatus" = 'READY' WHERE "paymentUrl" IS NOT NULL;
CREATE TABLE "SeedRun" ("id" TEXT NOT NULL, "initializedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "SeedRun_pkey" PRIMARY KEY ("id"));
-- Preserve existing, possibly renamed demo records.
INSERT INTO "SeedRun" ("id") SELECT 'brewlite-demo-v1'
WHERE EXISTS (SELECT 1 FROM "Ingredient") OR EXISTS (SELECT 1 FROM "Recipe");
