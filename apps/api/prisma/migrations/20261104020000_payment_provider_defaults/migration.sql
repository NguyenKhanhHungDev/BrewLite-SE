-- Only change defaults for new payments; preserve historical payment data.
ALTER TABLE "Payment"
ALTER COLUMN "provider" SET DEFAULT 'ZALOPAY',
ALTER COLUMN "method" SET DEFAULT 'ZALOPAY';
