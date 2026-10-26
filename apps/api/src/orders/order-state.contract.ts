import type { OrderStatus } from './order-state.js';

export interface OrderStateStore {
  findStatusById(orderId: number): Promise<string | null>;
  transitionIfCurrent(
    orderId: number,
    currentStatus: OrderStatus,
    nextStatus: OrderStatus,
  ): Promise<boolean>;
}

export const ORDER_STATE_STORE = Symbol('ORDER_STATE_STORE');
