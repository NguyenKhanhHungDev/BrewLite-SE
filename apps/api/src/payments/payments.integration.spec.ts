import 'dotenv/config';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '../generated/prisma/client.js';
import { PaymentsPrismaAdapter } from './payments.prisma-adapter.js';
import { PaymentsService } from './payments.service.js';

const runDb = process.env.RUN_DB_INTEGRATION === '1';

describe.skipIf(!runDb)('Payments PostgreSQL Integration (A1-08 & A1-10)', () => {
  let db: PrismaClient;
  let adapter: PaymentsPrismaAdapter;
  let service: PaymentsService;
  let user1Id: number;
  let user2Id: number;
  const createdOrderIds: number[] = [];

  beforeAll(async () => {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is required');

    db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    });
    adapter = new PaymentsPrismaAdapter();
    service = new PaymentsService(adapter);

    const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const u1 = await db.user.create({
      data: {
        email: `thang.it1.${suffix}@example.test`,
        passwordHash: 'hash_placeholder',
      },
    });
    const u2 = await db.user.create({
      data: {
        email: `thang.it2.${suffix}@example.test`,
        passwordHash: 'hash_placeholder',
      },
    });
    user1Id = u1.id;
    user2Id = u2.id;
  });

  afterAll(async () => {
    if (createdOrderIds.length > 0) {
      await db.payment.deleteMany({
        where: { orderId: { in: createdOrderIds } },
      });
      await db.order.deleteMany({
        where: { id: { in: createdOrderIds } },
      });
    }
    if (user1Id || user2Id) {
      await db.user.deleteMany({
        where: { id: { in: [user1Id, user2Id].filter(Boolean) } },
      });
    }
    await adapter.onModuleDestroy();
    await db.$disconnect();
  });

  async function createOrder(userId = user1Id, total = 45000) {
    const order = await db.order.create({
      data: {
        userId,
        status: 'PENDING',
        total,
      },
    });
    createdOrderIds.push(order.id);
    return order;
  }

  it('persists PAID, records amount = Order.total, and awards loyalty points once on replay', async () => {
    const order = await createOrder(user1Id, 45000);
    const key = `it-replay-${order.id}-${Date.now()}`;
    const beforeUser = await db.user.findUniqueOrThrow({ where: { id: user1Id } });

    const body = {
      orderId: order.id,
      method: 'WALLET',
      simulateResult: 'SUCCESS',
    };
    const r1 = await service.pay(user1Id, key, body);
    const r2 = await service.pay(user1Id, key, body);

    expect(r1).toEqual({ orderId: order.id, status: 'PAID' });
    expect(r2).toEqual({ orderId: order.id, status: 'PAID' });

    const afterUser = await db.user.findUniqueOrThrow({ where: { id: user1Id } });
    const payments = await db.payment.findMany({ where: { orderId: order.id } });
    expect(payments).toHaveLength(1);
    expect(payments[0]?.amount).toBe(45000);
    expect(afterUser.loyaltyPoints - beforeUser.loyaltyPoints).toBe(4);
  });

  it('handles concurrent requests with same Idempotency-Key (single Payment row & single points award)', async () => {
    const order = await createOrder(user1Id, 30000);
    const key = `it-concurrent-same-${order.id}-${Date.now()}`;
    const beforeUser = await db.user.findUniqueOrThrow({ where: { id: user1Id } });

    const body = {
      orderId: order.id,
      method: 'CARD',
      simulateResult: 'SUCCESS',
    };
    const [r1, r2] = await Promise.all([
      service.pay(user1Id, key, body),
      service.pay(user1Id, key, body),
    ]);

    expect(r1).toEqual({ orderId: order.id, status: 'PAID' });
    expect(r2).toEqual({ orderId: order.id, status: 'PAID' });

    const count = await db.payment.count({
      where: { userId: user1Id, idempotencyKey: key },
    });
    const afterUser = await db.user.findUniqueOrThrow({ where: { id: user1Id } });
    expect(count).toBe(1);
    expect(afterUser.loyaltyPoints - beforeUser.loyaltyPoints).toBe(3);
  });

  it('allows only one payment when two different keys race on the same Order', async () => {
    const order = await createOrder(user1Id, 20000);
    const keyA = `it-race-a-${order.id}-${Date.now()}`;
    const keyB = `it-race-b-${order.id}-${Date.now()}`;

    const results = await Promise.allSettled([
      service.pay(user1Id, keyA, {
        orderId: order.id,
        method: 'WALLET',
        simulateResult: 'SUCCESS',
      }),
      service.pay(user1Id, keyB, {
        orderId: order.id,
        method: 'CARD',
        simulateResult: 'SUCCESS',
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const payments = await db.payment.findMany({ where: { orderId: order.id } });
    expect(payments).toHaveLength(1);
  });

  it('supports retry from PAYMENT_FAILED to PAID using a new key and awards points only on PAID', async () => {
    const order = await createOrder(user1Id, 50000);
    const failKey = `it-fail-${order.id}-${Date.now()}`;
    const successKey = `it-retry-ok-${order.id}-${Date.now()}`;
    const beforeUser = await db.user.findUniqueOrThrow({ where: { id: user1Id } });

    const failRes = await service.pay(user1Id, failKey, {
      orderId: order.id,
      method: 'CARD',
      simulateResult: 'FAILURE',
    });
    expect(failRes).toEqual({ orderId: order.id, status: 'PAYMENT_FAILED' });

    const midUser = await db.user.findUniqueOrThrow({ where: { id: user1Id } });
    expect(midUser.loyaltyPoints).toBe(beforeUser.loyaltyPoints);

    const okRes = await service.pay(user1Id, successKey, {
      orderId: order.id,
      method: 'WALLET',
      simulateResult: 'SUCCESS',
    });
    expect(okRes).toEqual({ orderId: order.id, status: 'PAID' });

    const afterUser = await db.user.findUniqueOrThrow({ where: { id: user1Id } });
    expect(afterUser.loyaltyPoints - beforeUser.loyaltyPoints).toBe(5);
  });

  it('blocks another user from paying or replaying an order they do not own (403)', async () => {
    const order = await createOrder(user1Id, 25000);
    const key = `it-owner-${order.id}-${Date.now()}`;

    await expect(
      service.pay(user2Id, key, {
        orderId: order.id,
        method: 'WALLET',
        simulateResult: 'SUCCESS',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws 409 Conflict when reusing key with different payload', async () => {
    const order = await createOrder(user1Id, 25000);
    const key = `it-diff-${order.id}-${Date.now()}`;

    await service.pay(user1Id, key, {
      orderId: order.id,
      method: 'WALLET',
      simulateResult: 'SUCCESS',
    });

    await expect(
      service.pay(user1Id, key, {
        orderId: order.id,
        method: 'CARD',
        simulateResult: 'SUCCESS',
      }),
    ).rejects.toThrow(ConflictException);
  });
});