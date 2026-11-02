import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type {
  AdminOrderPage,
  AdminOrderRecord,
  OrderDetailRecord,
  OrderDraft,
  OrdersStore,
  RecipeSnapshot,
  StoredOrderResult,
  ToppingIngredientSnapshot,
} from './orders.contract.js';

@Injectable()
export class OrdersPendingAdapter implements OrdersStore {
  private unavailable(): never {
    throw new ServiceUnavailableException('Orders database adapter not integrated yet');
  }

  async getRecipeById(_id: number): Promise<RecipeSnapshot | null> {
    return this.unavailable();
  }

  async getToppingIngredients(): Promise<ToppingIngredientSnapshot> {
    return this.unavailable();
  }

  async findOrderByIdempotencyKey(_userId: number, _key: string): Promise<StoredOrderResult | null> {
    return this.unavailable();
  }

  async saveOrder(_draft: OrderDraft): Promise<StoredOrderResult> {
    return this.unavailable();
  }

  async findOrderForUser(_orderId: number, _userId: number): Promise<OrderDetailRecord | null> {
    return this.unavailable();
  }

  async findAdminOrder(_orderId: number): Promise<AdminOrderRecord | null> {
    return this.unavailable();
  }

  async listAdminOrders(_page: number, _limit: number): Promise<AdminOrderPage> {
    return this.unavailable();
  }

  async expirePendingOrders(_batchSize: number): Promise<number> {
    return this.unavailable();
  }
}
