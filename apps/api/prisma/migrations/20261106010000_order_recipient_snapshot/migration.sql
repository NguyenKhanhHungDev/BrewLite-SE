-- Add recipient information as an order-time snapshot. Existing orders remain NULL.
ALTER TABLE "Order"
  ADD COLUMN "recipientName" TEXT,
  ADD COLUMN "recipientPhone" TEXT;
