export type PaymentMethod = 'WALLET' | 'CARD' | 'ZALOPAY' | 'VNPAY';
export type SimulateResult = 'SUCCESS' | 'FAILURE';

export type PaymentOrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'PAYMENT_FAILED'
  | 'CANCELLED'
  | 'EXPIRED';

export type ZalopayPaymentStatus =
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'
  | 'RECONCILIATION_REQUIRED';

export interface PaymentRequest {
  orderId: number;
  method: 'WALLET' | 'CARD';
  simulateResult: SimulateResult;
}

export interface PaymentResult {
  orderId: number;
  status: 'PAID' | 'PAYMENT_FAILED';
}

export interface PayOnceInput {
  userId: number;
  idempotencyKey: string;
  requestHash: string;
  request: PaymentRequest;
}

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
  paymentStatus: ZalopayPaymentStatus | string;
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
  } | null;
}

export interface PendingZalopayAttempt {
  paymentId: number;
  orderId: number;
  userId: number;
  transactionRef: string;
  amount: number;
}

export interface PaymentOrdersStore {
  payOnce?(input: PayOnceInput): Promise<PaymentResult>;
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