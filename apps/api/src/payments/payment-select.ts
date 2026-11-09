// Public payment fields only: never expose hashes, payment URLs or admin notes.
export const safePaymentSelect = {
  id: true,
  orderId: true,
  amount: true,
  method: true,
  provider: true,
  status: true,
  transactionRef: true,
  providerTransactionId: true,
  createdAt: true,
  paidAt: true,
  creationStatus: true,
  lastQueriedAt: true,
} as const;
