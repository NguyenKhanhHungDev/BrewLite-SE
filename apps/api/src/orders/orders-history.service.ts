import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  ORDERS_HISTORY_STORE,
  type OrderHistoryRecord,
  type OrdersHistoryStore,
} from './orders-history.contract.js';

@Injectable()
export class OrdersHistoryService {
  constructor(
    @Inject(ORDERS_HISTORY_STORE) private readonly store: OrdersHistoryStore,
  ) {}

  async findMine(userId: number): Promise<OrderHistoryRecord[]> {
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new UnauthorizedException('Authenticated user is required');
    }
    return this.store.findMine(userId);
  }
}
