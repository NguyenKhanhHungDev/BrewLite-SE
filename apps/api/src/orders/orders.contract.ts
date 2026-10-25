export type OrderStatus = 'PENDING' | 'PAID' | 'PAYMENT_FAILED';
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
  items: OrderLine[];
}

export interface OrdersStore {
  getProductById(id: number): Promise<ProductSnapshot | null>;
  saveOrder(draft: OrderDraft): Promise<{ id: number }>;
}

export const ORDERS_STORE = Symbol('ORDERS_STORE');
