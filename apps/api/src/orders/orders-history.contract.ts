export interface OrderHistoryRecord {
  id: number;
  status: string;
  total: number;
  createdAt: Date;
  items: Array<{
    productId: number;
    quantity: number;
    size: string;
    toppings: string[];
    unitPrice: number;
    subtotal: number;
  }>;
}

export interface OrdersHistoryStore {
  findMine(userId: number): Promise<OrderHistoryRecord[]>;
}

export const ORDERS_HISTORY_STORE = Symbol('ORDERS_HISTORY_STORE');
