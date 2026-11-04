export type ZalopayPaymentStatus =
  'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'RECONCILIATION_REQUIRED';

export interface ClaimZalopayAttemptInput {
  userId: number;
  orderId: number;
  idempotencyKey: string;
  requestHash: string;
}

export interface ClaimZalopayAttemptResult {
  mode: 'NEW' | 'REPLAY';
  orderId: number;
  paymentId: number;
  amount: number;
  transactionRef: string;
  status: string;
  cachedPaymentUrl?: string | null;
  createdAt?: Date;
}

export interface SaveZalopayPaymentUrlInput {
  paymentId: number;
  transactionRef: string;
  paymentUrl: string;
}

export type ZalopayResolutionOutcome = 'SUCCESS' | 'FAILED' | 'CANCELLED';

export interface ApplyZalopayResolutionInput {
  transactionRef: string;
  appId: number;
  amountVnd: number;
  providerTransactionId?: string | null;
  outcome: ZalopayResolutionOutcome;
  reason?: string;
}

export interface ApplyZalopayResolutionResult {
  applied: boolean;
  duplicate: boolean;
  paymentStatus: string;
  orderStatus?: string;
}

export interface ZalopayCallbackResponse {
  return_code: number;
  return_message: string;
}

export interface OrderPaymentStatusResult {
  orderId: number;
  orderStatus: string;
  latestPayment: {
    paymentId: number;
    provider: string;
    transactionRef: string | null;
    amount: number;
    status: string;
    paidAt: Date | null;
    createdAt?: Date;
    creationStatus?: string;
  } | null;
}

export interface PendingZalopayAttempt {
  createdAt?: Date;
  paymentId: number;
  orderId: number;
  userId: number;
  transactionRef: string;
  amount: number;
}

export interface PaymentOrdersStore {
  markZalopayCreation(
    paymentId: number,
    transactionRef: string,
    status: 'REJECTED' | 'UNKNOWN',
  ): Promise<void>;
  claimZalopayAttempt(
    input: ClaimZalopayAttemptInput,
  ): Promise<ClaimZalopayAttemptResult>;
  saveZalopayPaymentUrl(input: SaveZalopayPaymentUrlInput): Promise<void>;
  applyZalopayResolution(
    input: ApplyZalopayResolutionInput,
  ): Promise<ApplyZalopayResolutionResult>;
  listPendingZalopayAttempts(limit?: number): Promise<PendingZalopayAttempt[]>;
  getOrderPaymentStatus(
    userId: number,
    orderId: number,
  ): Promise<OrderPaymentStatusResult>;
}

export const PAYMENT_ORDERS_STORE = Symbol('PAYMENT_ORDERS_STORE');
