import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentReadDatabase } from './payment-read-database.js';
import { safePaymentSelect } from './payment-select.js';

/** Customer read access is always restricted to the authenticated order owner. */
@Injectable()
export class PaymentDetailsService {
  constructor(private readonly db: PaymentReadDatabase) {}
  async forOrder(userId: number, orderId: number) {
    const order = await this.db.order.findFirst({
      where: { id: orderId, userId },
      select: {
        id: true,
        status: true,
        expiresAt: true,
        payments: {
          select: safePaymentSelect,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        },
      },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
    return {
      orderId: order.id,
      orderStatus: order.status,
      orderExpiresAt: order.expiresAt,
      serverTime: new Date(),
      payments: order.payments,
    };
  }
}
