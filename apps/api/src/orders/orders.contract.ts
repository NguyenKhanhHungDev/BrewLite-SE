export type { OrderStatus } from './order-state.js';
export type Size = 'S' | 'M' | 'L';
export type Topping = 'PEARL' | 'CREAM';

export interface ProductSnapshot {
  id: number;
  price: number;
  stock: number;
}

export interface OrderLine {
  productId: number;
  quantity: number;
  size: Size;
  toppings: Topping[];
  unitPrice: number;
  subtotal: number;
}

export interface OrderDraft {
  userId: number;
  status: 'PENDING';
  total: number;
  discount: number;
  promoCode: string | null;
  idempotencyKey: string | null;
  idempotencyHash: string | null;
  items: OrderLine[];
}

export interface StoredOrderResult {
  id: number;
  status: string;
  total: number;
  idempotencyHash: string | null;
}

export interface OrdersStore {
  getProductById(id: number): Promise<ProductSnapshot | null>;
  findOrderByIdempotencyKey(
    userId: number,
    key: string,
  ): Promise<StoredOrderResult | null>;
  saveOrder(draft: OrderDraft): Promise<StoredOrderResult>;
}

export const ORDERS_STORE = Symbol('ORDERS_STORE');
