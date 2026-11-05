import type { OrderPreferences } from './order-preferences.js';

export type { OrderStatus } from './order-state.js';
export type Size = 'S' | 'M' | 'L';
export type Topping = 'PEARL' | 'CREAM';

export interface IngredientSnapshot {
  id: number;
  name: string;
  unit: string;
  stock: number;
  reserved: number;
  version: number;
}

export interface RecipeIngredientSnapshot {
  ingredientId: number;
  quantity: number;
  ingredient: IngredientSnapshot;
}

export interface RecipeSnapshot {
  id: number;
  name: string;
  price: number;
  isActive: boolean;
  ingredients: RecipeIngredientSnapshot[];
}

export interface ToppingIngredientSnapshot {
  pearl: IngredientSnapshot | null;
  cream: IngredientSnapshot | null;
}

export interface OrderLine extends OrderPreferences {
  /** Client keeps the legacy productId field; it now contains Recipe.id. */
  productId: number;
  recipeName: string;
  basePrice: number;
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

export interface OrderDetailRecord {
  id: number;
  status: string;
  total: number;
  createdAt: Date;
  expiresAt: Date | null;
  items: Array<OrderPreferences & {
    recipeId: number | null;
    recipeName: string;
    productId: number | null;
    quantity: number;
    size: string;
    toppings: string[];
    unitPrice: number;
    subtotal: number;
  }>;
}

export interface AdminOrderRecord extends OrderDetailRecord {
  userEmail: string;
  paymentStatus: string | null;
}

export interface AdminOrderPage {
  data: AdminOrderRecord[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface OrdersStore {
  getRecipeById(id: number): Promise<RecipeSnapshot | null>;
  getToppingIngredients(): Promise<ToppingIngredientSnapshot>;
  findOrderByIdempotencyKey(
    userId: number,
    key: string,
  ): Promise<StoredOrderResult | null>;
  saveOrder(draft: OrderDraft): Promise<StoredOrderResult>;
  findOrderForUser(
    orderId: number,
    userId: number,
  ): Promise<OrderDetailRecord | null>;
  findAdminOrder(orderId: number): Promise<AdminOrderRecord | null>;
  listAdminOrders(page: number, limit: number): Promise<AdminOrderPage>;
  expirePendingOrders(batchSize: number): Promise<number>;
}

export const ORDERS_STORE = Symbol('ORDERS_STORE');
