import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '../generated/prisma/client.js';
import type { OrderStateService as OrderStateServiceType } from './order-state.service.js';
import type { LoyaltyService as LoyaltyServiceType } from '../loyalty/loyalty.service.js';

describe.skipIf(process.env.RUN_DB_INTEGRATION !== '1')(
  'Phat: real PostgreSQL order state + loyalty',
  () => {
    let prisma!: PrismaClient;
    let moduleRef!: TestingModule;
    let state!: OrderStateServiceType;
    let loyalty!: LoyaltyServiceType;
    let userId!: number;

    beforeAll(async () => {
      const url = process.env.DATABASE_URL;
      if (!url || !process.env.JWT_SECRET) {
        throw new Error('Set DATABASE_URL and JWT_SECRET in apps/api/.env');
      }

      // Import sau khi kiểm tra .env để không khởi tạo AuthModule quá sớm.
      const { OrdersModule } = await import('./orders.module.js');
      const { OrderStateService } = await import('./order-state.service.js');
      const { LoyaltyService } = await import('../loyalty/loyalty.service.js');
      moduleRef = await Test.createTestingModule({
        imports: [OrdersModule],
      }).compile();
      state = moduleRef.get(OrderStateService);
      loyalty = moduleRef.get(LoyaltyService);

      prisma = new PrismaClient({
        adapter: new PrismaPg({ connectionString: url }),
      });
      const user = await prisma.user.create({
        data: {
          email: `phat-test-${randomUUID()}@example.test`,
          passwordHash: 'test-only-not-for-login',
        },
      });
      userId = user.id;
    });

    afterAll(async () => {
      if (prisma) {
        if (userId) {
          await prisma.order.deleteMany({ where: { userId } });
          await prisma.user.delete({ where: { id: userId } });
        }
        await prisma.$disconnect();
      }
      if (moduleRef) await moduleRef.close();
    });

    async function makeOrder(status: string, total: number) {
      return prisma.order.create({
        data: { userId, status, total },
      });
    }

    it('rejects invalid transitions and accepts the full valid flow', async () => {
      const order = await makeOrder('PENDING', 90000);

      // Sai: không được nhảy thẳng PENDING -> COMPLETED.
      await expect(state.transition(order.id, 'COMPLETED')).rejects.toThrow();
      expect((await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
      })).status).toBe('PENDING');

      // Đúng: PENDING -> PAID -> PREPARING -> READY -> COMPLETED.
      await expect(state.transition(order.id, 'PAID'))
      .resolves.toMatchObject({ status: 'PAID' });

      const paid = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
      });
      expect(paid.loyaltyAwarded).toBe(true);
      expect((await prisma.user.findUniqueOrThrow({
        where: { id: userId },
      })).loyaltyPoints).toBe(9);

      // Xử lý lại cùng đơn: không tăng thêm điểm.
      await expect(loyalty.awardPaidOrder(order.id))
      .resolves.toMatchObject({ awarded: false, points: 0 });

      for (const next of ['PREPARING', 'READY', 'COMPLETED'] as const) {
        await state.transition(order.id, next);
      }
      await expect(state.transition(order.id, 'PAID')).rejects.toThrow();
      expect((await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
      })).status).toBe('COMPLETED');
    });

    it('never rewards PAYMENT_FAILED', async () => {
      const order = await makeOrder('PAYMENT_FAILED', 70000);
      const before = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
      });

      await expect(loyalty.awardPaidOrder(order.id))
      .resolves.toMatchObject({ awarded: false, points: 0 });

      const after = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
      });
      expect(after.loyaltyPoints).toBe(before.loyaltyPoints);
    });

    it('awards only once for concurrent requests', async () => {
      const order = await makeOrder('PAID', 90000);
      const before = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
      });

      const results = await Promise.all([
        loyalty.awardPaidOrder(order.id),
        loyalty.awardPaidOrder(order.id),
      ]);

      const after = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
      });
      expect(results.filter((result) => result.awarded)).toHaveLength(1);
      expect(after.loyaltyPoints - before.loyaltyPoints).toBe(9);
      expect((await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
      })).loyaltyAwarded).toBe(true);
    });
  },
);
