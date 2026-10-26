import 'dotenv/config';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '../generated/prisma/client.js';
import { PaymentsPrismaAdapter } from './payments.prisma-adapter.js';
import { PaymentsService } from './payments.service.js';

describe('A1-08 & A1-10 Payments PostgreSQL Integration', () => {
  let db: PrismaClient;
  let adapter: PaymentsPrismaAdapter;
  let service: PaymentsService;
  let testUserId: number;
  let otherUserId: number;
  const createdOrderIds: number[] = [];

  beforeAll(async () => {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is required to run integration tests');
    }

    db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    });
    adapter = new PaymentsPrismaAdapter();
    service = new PaymentsService(adapter);

    const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const user1 = await db.user.create({
      data: {
        email: `thang.payment.${uniqueSuffix}@brewlite.test`,
        passwordHash: 'hashed_password_placeholder',
        
      },
    });
    testUserId = user1.id;

    const user2 = await db.user.create({
      data: {
        email: `other.payment.${uniqueSuffix}@brewlite.test`,
        passwordHash: 'hashed_password_placeholder',
      },
    });
    otherUserId = user2.id;
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
    if (testUserId || otherUserId) {
      await db.user.deleteMany({
        where: {
          id: { in: [testUserId, otherUserId].filter(Boolean) },
        },
      });
    }
    await adapter.onModuleDestroy();
    await db.$disconnect();
  });

  async function createPendingOrder(userId = testUserId, total = 45000) {
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

  it('1. WALLET SUCCESS persists PAID status and creates exactly 1 Payment record', async () => {
    const order = await createPendingOrder();
    const key = `it-success-${order.id}-${Date.now()}`;

    const res = await service.pay(
      { orderId: order.id, method: 'WALLET', simulateResult: 'SUCCESS' },
      key,
      testUserId,
    );

    expect(res).toEqual({ orderId: order.id, status: 'PAID' });

    const dbOrder = await db.order.findUnique({ where: { id: order.id } });
    const payments = await db.payment.findMany({
      where: { orderId: order.id },
    });

    expect(dbOrder?.status).toBe('PAID');
    expect(payments).toHaveLength(1);
    expect(payments[0]?.amount).toBe(45000);
    expect(payments[0]?.idempotencyKey).toBe(key);
  });

  it('2. Duplicate request with same Idempotency-Key returns same result and keeps Payment count = 1', async () => {
    const order = await createPendingOrder();
    const key = `it-dup-${order.id}-${Date.now()}`;
    const payload = {
      orderId: order.id,
      method: 'WALLET',
      simulateResult: 'SUCCESS',
    };

    const first = await service.pay(payload, key, testUserId);
    const second = await service.pay(payload, key, testUserId);

    expect(first).toEqual({ orderId: order.id, status: 'PAID' });
    expect(second).toEqual({ orderId: order.id, status: 'PAID' });

    const count = await db.payment.count({ where: { idempotencyKey: key } });
    expect(count).toBe(1);
  });

  it('3. Concurrent Promise.all with same Idempotency-Key creates only 1 Payment record in DB', async () => {
    const order = await createPendingOrder();
    const key = `it-concurrent-${order.id}-${Date.now()}`;
    const payload = {
      orderId: order.id,
      method: 'CARD',
      simulateResult: 'SUCCESS',
    };

    const [res1, res2] = await Promise.all([
      service.pay(payload, key, testUserId),
      service.pay(payload, key, testUserId),
    ]);

    expect(res1).toEqual({ orderId: order.id, status: 'PAID' });
    expect(res2).toEqual({ orderId: order.id, status: 'PAID' });

    const count = await db.payment.count({ where: { idempotencyKey: key } });
    const dbOrder = await db.order.findUnique({ where: { id: order.id } });

    expect(count).toBe(1);
    expect(dbOrder?.status).toBe('PAID');
  });

  it('4. Same Idempotency-Key with different payload throws 409 ConflictException', async () => {
    const order = await createPendingOrder();
    const key = `it-conflict-${order.id}-${Date.now()}`;

    await service.pay(
      { orderId: order.id, method: 'WALLET', simulateResult: 'SUCCESS' },
      key,
      testUserId,
    );

    await expect(
      service.pay(
        { orderId: order.id, method: 'CARD', simulateResult: 'SUCCESS' },
        key,
        testUserId,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('5. Rejects paying an already PAID order when using a new Idempotency-Key', async () => {
    const order = await createPendingOrder();
    const key1 = `it-paid-1-${order.id}-${Date.now()}`;
    const key2 = `it-paid-2-${order.id}-${Date.now()}`;

    await service.pay(
      { orderId: order.id, method: 'WALLET', simulateResult: 'SUCCESS' },
      key1,
      testUserId,
    );

    await expect(
      service.pay(
        { orderId: order.id, method: 'WALLET', simulateResult: 'SUCCESS' },
        key2,
        testUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('6. CARD FAILURE sets Order status to PAYMENT_FAILED and records failed Payment', async () => {
    const order = await createPendingOrder();
    const key = `it-fail-${order.id}-${Date.now()}`;

    const res = await service.pay(
      { orderId: order.id, method: 'CARD', simulateResult: 'FAILURE' },
      key,
      testUserId,
    );

    expect(res).toEqual({ orderId: order.id, status: 'PAYMENT_FAILED' });

    const dbOrder = await db.order.findUnique({ where: { id: order.id } });
    const payment = await db.payment.findUnique({
      where: { idempotencyKey: key },
    });

    expect(dbOrder?.status).toBe('PAYMENT_FAILED');
    expect(payment?.status).toBe('PAYMENT_FAILED');
  });

  it('7. Rejects payment if Order belongs to another user', async () => {
    const order = await createPendingOrder(testUserId);
    const key = `it-wrong-owner-${order.id}-${Date.now()}`;

    await expect(
      service.pay(
        { orderId: order.id, method: 'WALLET', simulateResult: 'SUCCESS' },
        key,
        otherUserId,
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});