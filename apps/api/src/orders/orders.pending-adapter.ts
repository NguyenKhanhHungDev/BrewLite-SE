import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type {
  OrderDraft,
  OrdersStore,
  ProductSnapshot,
  StoredOrderResult,
} from './orders.contract.js';

@Injectable()
export class OrdersPendingAdapter implements OrdersStore {
  async getProductById(_id: number): Promise<ProductSnapshot | null> {
    throw new ServiceUnavailableException(
      'Orders database adapter not integrated yet',
    );
  }

  async findOrderByIdempotencyKey(
    _userId: number,
    _key: string,
  ): Promise<StoredOrderResult | null> {
    throw new ServiceUnavailableException(
      'Orders database adapter not integrated yet',
    );
  }

  async saveOrder(_draft: OrderDraft): Promise<StoredOrderResult> {
    throw new ServiceUnavailableException(
      'Orders database adapter not integrated yet',
    );
  }
}
