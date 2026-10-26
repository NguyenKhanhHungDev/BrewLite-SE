import 'dotenv/config';
import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import type { LoyaltyAwardResult, LoyaltyStore } from './loyalty.contract.js';
import { pointsForPaidOrder } from './loyalty.service.js';

@Injectable()
export class LoyaltyPrismaAdapter implements LoyaltyStore, OnModuleDestroy {
  private readonly prisma: PrismaClient;

  constructor() {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is missing');
    this.prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    });
  }

  async awardPaidOrder(orderId: number): Promise<LoyaltyAwardResult> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          userId: true,
          status: true,
          total: true,
          loyaltyAwarded: true,
        },
      });
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
      if (order.status !== 'PAID' || order.loyaltyAwarded) {
        return { awarded: false, points: 0 };
      }

      const points = pointsForPaidOrder(order.total);
      // Claim the award atomically: concurrent retries can only claim once.
      const claim = await tx.order.updateMany({
        where: { id: orderId, status: 'PAID', loyaltyAwarded: false },
        data: { loyaltyAwarded: true },
      });
      if (claim.count !== 1) return { awarded: false, points: 0 };

      if (points > 0) {
        await tx.user.update({
          where: { id: order.userId },
          data: { loyaltyPoints: { increment: points } },
        });
      }
      return { awarded: true, points };
    });
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}
