import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  LOYALTY_STORE,
  type LoyaltyAwardResult,
  type LoyaltyStore,
} from './loyalty.contract.js';

export function pointsForPaidOrder(paidTotal: number): number {
  if (!Number.isSafeInteger(paidTotal) || paidTotal < 0) {
    throw new BadRequestException('Tổng tiền thanh toán không hợp lệ');
  }
  return Math.floor(paidTotal / 10_000);
}

@Injectable()
export class LoyaltyService {
  constructor(@Inject(LOYALTY_STORE) private readonly store: LoyaltyStore) {}

  async awardPaidOrder(orderId: number): Promise<LoyaltyAwardResult> {
    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      throw new BadRequestException('orderId phải là số nguyên dương');
    }
    return this.store.awardPaidOrder(orderId);
  }
}
