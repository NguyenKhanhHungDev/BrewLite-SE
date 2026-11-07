import { Injectable, OnModuleDestroy, NotFoundException } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

// Explicit allowlist: never expose gateway payloads, URLs, hashes or credentials.
export const safePaymentSelect = {
  id: true,
  orderId: true,
  amount: true,
  method: true,
  provider: true,
  status: true,
  transactionRef: true,
  providerTransactionId: true,
  createdAt: true,
  paidAt: true,
  creationStatus: true,
  lastQueriedAt: true,
} as const;

@Injectable()
export class PaymentDetailsService implements OnModuleDestroy {
  private readonly db: PrismaClient;
  constructor() {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is missing');
    this.db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    });
  }
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
  async reconciliation(page: number) {
    const where = { status: 'RECONCILIATION_REQUIRED' };
    const [total, payments] = await this.db.$transaction(
      [
        this.db.payment.count({ where }),
        this.db.payment.findMany({
          where,
          skip: (page - 1) * 20,
          take: 20,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: {
            ...safePaymentSelect,
            order: { select: { id: true, status: true } },
          },
        }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    return { page, pageSize: 20, total, payments };
  }
  async onModuleDestroy() {
    await this.db.$disconnect();
  }
}
