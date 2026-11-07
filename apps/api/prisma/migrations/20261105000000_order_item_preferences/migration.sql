-- Nullable columns preserve the meaning of existing orders; no default/backfill.
ALTER TABLE "OrderItem"
  ADD COLUMN "sugarLevel" INTEGER,
  ADD COLUMN "iceLevel" TEXT,
  ADD COLUMN "note" VARCHAR(200),
  ADD CONSTRAINT "OrderItem_sugarLevel_check"
    CHECK ("sugarLevel" IN (0, 50, 100)),
  ADD CONSTRAINT "OrderItem_iceLevel_check"
    CHECK ("iceLevel" IN ('NONE', 'LESS', 'NORMAL'));
