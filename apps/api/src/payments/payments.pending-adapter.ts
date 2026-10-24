import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type {
  PaymentOrder,
  PaymentOrdersStore,
} from './payments.contract.js';

@Injectable()
export class PaymentsPendingAdapter implements PaymentOrdersStore {
  async findOrderById(_id: number): Promise<PaymentOrder | null> {
    throw new ServiceUnavailableException('Orders database not integrated yet');
  }

  async updateOrderStatus(
    _id: number,
    _status: 'PAID' | 'PAYMENT_FAILED',
  ): Promise<void> {
    throw new ServiceUnavailableException('Orders database not integrated yet');
  }
}