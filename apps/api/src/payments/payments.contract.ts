export type PaymentMethod = 'WALLET' | 'CARD';
export type SimulateResult = 'SUCCESS' | 'FAILURE';
export type PaymentOrderStatus = 'PENDING' | 'PAID' | 'PAYMENT_FAILED';

export interface PaymentRequest {
  orderId: number;
  method: PaymentMethod;
  simulateResult: SimulateResult;
}

export interface PaymentOrder {
  id: number;
  status: PaymentOrderStatus;
}

export interface PaymentOrdersStore {
  findOrderById(id: number): Promise<PaymentOrder | null>;
  updateOrderStatus(id: number, status: 'PAID' | 'PAYMENT_FAILED'): Promise<void>;
}

export const PAYMENT_ORDERS_STORE = Symbol('PAYMENT_ORDERS_STORE');