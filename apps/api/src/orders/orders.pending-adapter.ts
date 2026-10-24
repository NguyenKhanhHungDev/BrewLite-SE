import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type {
  OrderDraft,
  OrdersStore,
  ProductSnapshot,
} from './orders.contract.js';

@Injectable()
export class OrdersPendingAdapter implements OrdersStore {
  async getProductById(_id: number): Promise<ProductSnapshot | null> {
    throw new ServiceUnavailableException(
      'Orders database adapter not integrated yet',
    );
  }

  async saveOrder(_draft: OrderDraft): Promise<{ id: number }> {
    throw new ServiceUnavailableException(
      'Orders database adapter not integrated yet',
    );
  }
}
