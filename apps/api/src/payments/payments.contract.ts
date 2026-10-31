export type PaymentMethod = 'WALLET' | 'CARD';
export type SimulateResult = 'SUCCESS' | 'FAILURE';
export type PaymentOrderStatus = 'PENDING' | 'PAID' | 'PAYMENT_FAILED';
export type VnpayPaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

export interface PaymentRequest {
  orderId: number;
  method: PaymentMethod;
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

export interface CreateVnpayPaymentRecordInput {
  userId: number;
  orderId: number;
  transactionRef: string;
}

export interface CreateVnpayPaymentRecordResult {
  orderId: number;
  paymentId: number;
  amount: number;
  transactionRef: string;
}

export interface VnpayIpnProcessInput {
  transactionRef: string;
  amountVnd: number;
  responseCode: string;
  transactionStatus: string;
  providerTransactionId?: string;
}

export interface VnpayIpnResponse {
  RspCode: string;
  Message: string;
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

export interface PaymentOrdersStore {
  payOnce(input: PayOnceInput): Promise<PaymentResult>;
  createVnpayPayment?(
    input: CreateVnpayPaymentRecordInput,
  ): Promise<CreateVnpayPaymentRecordResult>;
  processVnpayIpn?(input: VnpayIpnProcessInput): Promise<VnpayIpnResponse>;
  getOrderPaymentStatus?(
    userId: number,
    orderId: number,
  ): Promise<OrderPaymentStatusResult>;
}

export const PAYMENT_ORDERS_STORE = Symbol('PAYMENT_ORDERS_STORE');