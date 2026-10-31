/*
  Warnings:

  - A unique constraint covering the columns `[transactionRef]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'VNPAY',
ADD COLUMN     "providerTransactionId" TEXT,
ADD COLUMN     "transactionRef" TEXT,
ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "idempotencyKey" DROP NOT NULL,
ALTER COLUMN "requestHash" DROP NOT NULL,
ALTER COLUMN "method" SET DEFAULT 'VNPAY',
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- CreateIndex
CREATE UNIQUE INDEX "Payment_transactionRef_key" ON "Payment"("transactionRef");
