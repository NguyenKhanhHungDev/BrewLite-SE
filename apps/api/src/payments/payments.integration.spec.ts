import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { PaymentsPrismaAdapter } from './payments.prisma-adapter.js';
import { OrdersPrismaAdapter } from '../orders/orders.prisma-adapter.js';

const url = process.env.PAYMENTS_TEST_DATABASE_URL;
describe.skipIf(!url)('Payments on an isolated PostgreSQL database', () => {
  let prisma: PrismaClient;
  let payments: PaymentsPrismaAdapter;
  let orders: OrdersPrismaAdapter;
  const users: number[] = [];
  const ingredients: number[] = [];
  const originalUrl = process.env.DATABASE_URL;

  beforeAll(() => {
    const target = new URL(url!);
    if (
      !['db', 'localhost', '127.0.0.1'].includes(target.hostname) ||
      !/^\/brewlite_payment_test_[a-z0-9_]+$/.test(target.pathname)
    ) {
      throw new Error('Use a dedicated local brewlite_payment_test_* database');
    }
    process.env.DATABASE_URL = url;
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url! }),
    });
    payments = new PaymentsPrismaAdapter();
    orders = new OrdersPrismaAdapter();
  });
  afterAll(async () => {
    if (prisma) {
      await prisma.payment.deleteMany({ where: { userId: { in: users } } });
      await prisma.order.deleteMany({ where: { userId: { in: users } } });
      await prisma.user.deleteMany({ where: { id: { in: users } } });
      await prisma.ingredient.deleteMany({
        where: { id: { in: ingredients } },
      });
      await prisma.$disconnect();
    }
    await payments?.onModuleDestroy();
    await orders?.onModuleDestroy();
    if (originalUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalUrl;
  });

  async function fixture(expired = false) {
    const user = await prisma.user.create({
      data: {
        email: randomUUID() + '@example.test',
        passwordHash: 'test-only',
      },
    });
    users.push(user.id);
    const ingredient = await prisma.ingredient.create({
      data: { name: randomUUID(), unit: 'g', stock: 100, reserved: 20 },
    });
    ingredients.push(ingredient.id);
    const order = await prisma.order.create({
      data: {
        userId: user.id,
        total: 50000,
        expiresAt: new Date(Date.now() + (expired ? -60_000 : 15 * 60_000)),
        ingredientUses: {
          create: [
            { ingredientId: ingredient.id, quantity: 20, status: 'RESERVED' },
          ],
        },
      },
    });
    return { user, ingredient, order };
  }
  function input(f: Awaited<ReturnType<typeof fixture>>, key = randomUUID()) {
    return {
      userId: f.user.id,
      orderId: f.order.id,
      idempotencyKey: key,
      requestHash: 'same-request',
    };
  }
  function resolve(ref: string, outcome: 'SUCCESS' | 'FAILED' = 'SUCCESS') {
    return payments.applyZalopayResolution({
      transactionRef: ref,
      appId: 554,
      amountVnd: 50000,
      outcome,
      providerTransactionId: 'sandbox-test',
    });
  }

  it('allows one active attempt under concurrent different keys', async () => {
    const f = await fixture();
    const results = await Promise.allSettled([
      payments.claimZalopayAttempt(input(f)),
      payments.claimZalopayAttempt(input(f)),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(await prisma.payment.count({ where: { orderId: f.order.id } })).toBe(
      1,
    );
  });
  it('replays the persisted URL through a newly created adapter', async () => {
    const f = await fixture();
    const request = input(f);
    const attempt = await payments.claimZalopayAttempt(request);
    await payments.saveZalopayPaymentUrl({
      paymentId: attempt.paymentId,
      transactionRef: attempt.transactionRef,
      paymentUrl: 'https://sandbox.zalopay.vn/test',
    });
    const restarted = new PaymentsPrismaAdapter();
    try {
      expect(
        (await restarted.claimZalopayAttempt(request)).cachedPaymentUrl,
      ).toBe('https://sandbox.zalopay.vn/test');
    } finally {
      await restarted.onModuleDestroy();
    }
  });
  it('consumes inventory and awards loyalty once under duplicate concurrent success', async () => {
    const f = await fixture();
    const attempt = await payments.claimZalopayAttempt(input(f));
    const results = await Promise.all([
      resolve(attempt.transactionRef),
      resolve(attempt.transactionRef),
    ]);
    expect(results.filter((r) => r.applied)).toHaveLength(1);
    expect(
      await prisma.ingredient.findUnique({ where: { id: f.ingredient.id } }),
    ).toMatchObject({ stock: 80, reserved: 0 });
    expect(
      await prisma.user.findUnique({ where: { id: f.user.id } }),
    ).toMatchObject({ loyaltyPoints: 5 });
  });
  it('preserves an unresolved reservation at expiry, then honors verified success', async () => {
    const f = await fixture();
    const attempt = await payments.claimZalopayAttempt(input(f));
    await prisma.order.update({
      where: { id: f.order.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    await orders.expirePendingOrders(50);
    expect(
      await prisma.order.findUnique({ where: { id: f.order.id } }),
    ).toMatchObject({ status: 'PENDING' });
    expect((await resolve(attempt.transactionRef)).paymentStatus).toBe(
      'SUCCESS',
    );
    expect(
      await prisma.order.findUnique({ where: { id: f.order.id } }),
    ).toMatchObject({ status: 'PAID' });
    expect(
      await prisma.ingredient.findUnique({ where: { id: f.ingredient.id } }),
    ).toMatchObject({ stock: 80, reserved: 0 });
  });
  it('retries a definite creation rejection using the same key and a fresh reference', async () => {
    const f = await fixture();
    const request = input(f);
    const first = await payments.claimZalopayAttempt(request);
    await payments.markZalopayCreation(
      first.paymentId,
      first.transactionRef,
      'REJECTED',
    );
    const second = await payments.claimZalopayAttempt(request);
    expect(second.mode).toBe('NEW');
    expect(second.paymentId).toBe(first.paymentId);
    expect(second.transactionRef).not.toBe(first.transactionRef);
  });
  it('releases ingredients once for final failure', async () => {
    const f = await fixture();
    const attempt = await payments.claimZalopayAttempt(input(f));
    await resolve(attempt.transactionRef, 'FAILED');
    await resolve(attempt.transactionRef, 'FAILED');
    expect(
      await prisma.ingredient.findUnique({ where: { id: f.ingredient.id } }),
    ).toMatchObject({ stock: 100, reserved: 0 });
    expect(
      await prisma.order.findUnique({ where: { id: f.order.id } }),
    ).toMatchObject({ status: 'PAYMENT_FAILED' });
  });
  it('routes a success discovered after final failure to reconciliation without consuming stock', async () => {
    const f = await fixture();
    const attempt = await payments.claimZalopayAttempt(input(f));
    await resolve(attempt.transactionRef, 'FAILED');
    expect((await resolve(attempt.transactionRef)).paymentStatus).toBe(
      'RECONCILIATION_REQUIRED',
    );
    expect(
      await prisma.ingredient.findUnique({ where: { id: f.ingredient.id } }),
    ).toMatchObject({ stock: 100, reserved: 0 });
    expect(
      await prisma.user.findUnique({ where: { id: f.user.id } }),
    ).toMatchObject({ loyaltyPoints: 0 });
  });
  it('rotates background scans instead of querying the oldest pending row forever', async () => {
    const a = await fixture();
    const b = await fixture();
    const first = await payments.claimZalopayAttempt(input(a));
    const second = await payments.claimZalopayAttempt(input(b));
    await payments.markZalopayCreation(
      first.paymentId,
      first.transactionRef,
      'UNKNOWN',
    );
    await payments.markZalopayCreation(
      second.paymentId,
      second.transactionRef,
      'UNKNOWN',
    );
    // Hide other fixtures from this scheduling assertion without deleting them.
    await prisma.payment.updateMany({
      where: { id: { notIn: [first.paymentId, second.paymentId] } },
      data: { lastQueriedAt: new Date(Date.now() + 60_000) },
    });
    const scan1 = await payments.listPendingZalopayAttempts(1);
    const scan2 = await payments.listPendingZalopayAttempts(1);
    expect(scan1[0].paymentId).not.toBe(scan2[0].paymentId);
  });
  it('rolls back a mismatched amount and keeps the reservation', async () => {
    const f = await fixture();
    const attempt = await payments.claimZalopayAttempt(input(f));
    await expect(
      payments.applyZalopayResolution({
        transactionRef: attempt.transactionRef,
        appId: 554,
        amountVnd: 1,
        outcome: 'SUCCESS',
      }),
    ).rejects.toThrow('Amount mismatch');
    expect(
      await prisma.payment.findUnique({ where: { id: attempt.paymentId } }),
    ).toMatchObject({ status: 'PENDING' });
    expect(
      await prisma.ingredient.findUnique({ where: { id: f.ingredient.id } }),
    ).toMatchObject({ stock: 100, reserved: 20 });
  });
  it('still expires unpaid orders with no unresolved gateway attempt', async () => {
    const f = await fixture(true);
    await orders.expirePendingOrders(50);
    expect(
      await prisma.order.findUnique({ where: { id: f.order.id } }),
    ).toMatchObject({ status: 'CANCELLED' });
    expect(
      await prisma.ingredient.findUnique({ where: { id: f.ingredient.id } }),
    ).toMatchObject({ stock: 100, reserved: 0 });
  });
});
