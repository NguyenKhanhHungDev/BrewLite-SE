export type PaymentMethod = 'WALLET' | 'CARD';
export type SimulateResult = 'SUCCESS' | 'FAILURE';
export type PaymentOrderStatus = 'PENDING' | 'PAID' | 'PAYMENT_FAILED';

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

export interface PaymentOrdersStore {
  payOnce(input: PayOnceInput): Promise<PaymentResult>;
}

export const PAYMENT_ORDERS_STORE = Symbol('PAYMENT_ORDERS_STORE');