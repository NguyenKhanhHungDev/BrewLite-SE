export type OrderStatus = 'PENDING' | 'PAID' | 'PAYMENT_FAILED';

export interface ProductSnapshot {
  id: number;
  price: number;
}

export interface OrderLine {
  productId: number;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface OrderDraft {
  userId: number;
  status: 'PENDING';
  total: number;
  items: OrderLine[];
}

export interface OrdersStore {
  getProductById(id: number): Promise<ProductSnapshot | null>;
  saveOrder(draft: OrderDraft): Promise<{ id: number }>;
}

export const ORDERS_STORE = Symbol('ORDERS_STORE');
