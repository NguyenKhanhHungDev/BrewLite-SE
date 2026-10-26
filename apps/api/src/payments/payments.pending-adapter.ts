import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type {
  PayOnceInput,
  PaymentOrdersStore,
  PaymentResult,
} from './payments.contract.js';

@Injectable()
export class PaymentsPendingAdapter implements PaymentOrdersStore {
  async payOnce(_input: PayOnceInput): Promise<PaymentResult> {
    throw new ServiceUnavailableException('Orders database not integrated yet');
  }
}