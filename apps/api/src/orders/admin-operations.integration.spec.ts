import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import type { INestApplication } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { PrismaClient } from '../generated/prisma/client.js';
import { OrderCancellationService } from './order-cancellation.service.js';
import { PaymentsPrismaAdapter } from '../payments/payments.prisma-adapter.js';
import { PaymentAdminService } from '../payments/payment-admin.service.js';
import { ZalopayService } from '../payments/zalopay.service.js';
import { PAYMENT_ORDERS_STORE } from '../payments/payments.contract.js';

const target = process.env.OPERATIONS_TEST_DATABASE_URL;
describe.skipIf(!target)('Admin operations PostgreSQL + HTTP', () => {
  let db: PrismaClient,
    app: INestApplication,
    cancel: OrderCancellationService,
    paymentStore: PaymentsPrismaAdapter,
    details: PaymentAdminService;
  let adminId: number,
    userId: number,
    adminToken: string,
    customerToken: string;
  const gateway = {
    getValidatedConfig: () => ({ appId: 123 }),
    querySandboxOrder: async () => ({ return_code: 3, is_processing: true }),
  };
  beforeAll(async () => {
    const url = new URL(target!);
    if (
      !['127.0.0.1', 'localhost'].includes(url.hostname) ||
      !/^\/brewlite_huy_test_operations$/.test(url.pathname)
    )
      throw new Error('Dedicated local operations test database required');
    process.env.DATABASE_URL = target;
    process.env.JWT_SECRET = 'operations-isolated-test-secret';
    const { OrdersModule } = await import('./orders.module.js');
    const { AuthModule } = await import('../auth/auth.module.js');
    const module = await Test.createTestingModule({
      imports: [OrdersModule, AuthModule],
    })
      .overrideProvider(ZalopayService)
      .useValue(gateway)
      .compile();
    app = module.createNestApplication();
    await app.init();
    db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: target! }),
    });
    adminId = (
      await db.user.create({
        data: {
          email: `admin-${randomUUID()}@test.local`,
          passwordHash: 'unused',
          role: 'ADMIN',
          name: 'Admin',
        },
      })
    ).id;
    userId = (
      await db.user.create({
        data: {
          email: `client-${randomUUID()}@test.local`,
          passwordHash: 'unused',
          name: 'Khach Needle',
        },
      })
    ).id;
    const jwt = module.get(JwtService);
    adminToken = jwt.sign({ sub: adminId });
    customerToken = jwt.sign({ sub: userId, role: 'ADMIN', isAdmin: true });
    cancel = module.get(OrderCancellationService);
    paymentStore = module.get(PAYMENT_ORDERS_STORE);
    details = module.get(PaymentAdminService);
  });
  afterAll(async () => {
    await app?.close();
    await db?.$disconnect();
  });
  const admin = () => ({ Authorization: `Bearer ${adminToken}` });
  async function order(status = 'PENDING') {
    const ingredient = await db.ingredient.create({
      data: {
        name: `Stock-${randomUUID()}`,
        unit: 'g',
        stock: 100,
        reserved: 5,
      },
    });
    const row = await db.order.create({
      data: {
        userId,
        status,
        total: 10000,
        recipientName: 'Nguoi Nhan',
        
        ingredientUses: {
          create: {
            ingredientId: ingredient.id,
            quantity: 5,
            status: 'RESERVED',
          },
        },
      },
    });
    return { ...row, ingredientId: ingredient.id };
  }
  async function payment(
    orderId: number,
    status = 'PENDING',
    creationStatus = 'READY',
  ) {
    return db.payment.create({
      data: {
        orderId,
        userId,
        amount: 10000,
        provider: 'ZALOPAY',
        method: 'ZALOPAY',
        status,
        creationStatus,
        transactionRef: `ops-${randomUUID()}`,
      },
    });
  }
  it('protects every new route with real JWT and database role checks', async () => {
    for (const [method, path] of [
      ['get', '/payments/admin/transactions'],
      ['get', '/payments/admin/transactions/1'],
      ['patch', '/payments/admin/transactions/1/note'],
      ['post', '/payments/admin/transactions/1/recheck'],
      ['post', '/admin/orders/1/cancel'],
    ] as const) {
      await request(app.getHttpServer())[method](path).send({}).expect(401);
      await request(app.getHttpServer())
        [method](path)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({})
        .expect(403);
    }
  });
  it('validates reason, cancels concurrently once, releases once and persists actor audit', async () => {
    const row = await order();
    for (const body of [
      { reason: '' },
      { reason: 'x'.repeat(301) },
      { reason: 'ok', status: 'PAID' },
    ])
      await request(app.getHttpServer())
        .post(`/admin/orders/${row.id}/cancel`)
        .set(admin())
        .send(body)
        .expect(400);
    const responses = await Promise.all(
      [1, 2].map(() =>
        request(app.getHttpServer())
          .post(`/admin/orders/${row.id}/cancel`)
          .set(admin())
          .send({ reason: ' Khách yêu cầu ' }),
      ),
    );
    expect(responses.map((r) => r.status).sort((a, b) => a - b)).toEqual([
      201, 409,
    ]);
    expect(await db.order.findUnique({ where: { id: row.id } })).toMatchObject({
      status: 'CANCELLED',
      cancellationReason: 'Khách yêu cầu',
      cancelledById: adminId,
      cancelledAt: expect.any(Date),
    });
    expect(
      await db.ingredient.findUnique({ where: { id: row.ingredientId } }),
    ).toMatchObject({ stock: 100, reserved: 0, version: 1 });
    expect(
      await db.orderIngredient.findFirst({ where: { orderId: row.id } }),
    ).toMatchObject({ status: 'RELEASED' });
  });
  it('refuses unresolved gateway attempts, reconciliation and paid orders without stock changes', async () => {
    for (const [status, creation] of [
      ['PENDING', 'CREATING'],
      ['PENDING', 'UNKNOWN'],
      ['PENDING', 'READY'],
      ['SUCCESS', 'READY'],
      ['RECONCILIATION_REQUIRED', 'READY'],
    ]) {
      const row = await order();
      await payment(row.id, status, creation);
      await expect(
        cancel.cancel(row.id, adminId, { reason: 'Khách hủy' }),
      ).rejects.toMatchObject({ status: 409 });
      expect(
        await db.ingredient.findUnique({ where: { id: row.ingredientId } }),
      ).toMatchObject({ reserved: 5 });
    }
    const paid = await order('PAID');
    await expect(
      cancel.cancel(paid.id, adminId, { reason: 'Khách hủy' }),
    ).rejects.toMatchObject({ status: 409 });
    const failed = await order('PAYMENT_FAILED');
    await payment(failed.id, 'FAILED', 'REJECTED');
    await expect(
      cancel.cancel(failed.id, adminId, { reason: 'Khách hủy' }),
    ).resolves.toMatchObject({ status: 'CANCELLED' });
  });
  it('serializes cancellation versus creation and settlement using the same Order lock', async () => {
    const row = await order();
    const result = await Promise.allSettled([
      cancel.cancel(row.id, adminId, { reason: 'Hủy cạnh tranh' }),
      paymentStore.claimZalopayAttempt({
        userId,
        orderId: row.id,
        idempotencyKey: randomUUID(),
        requestHash: 'test-race',
      }),
    ]);
    expect(result.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const current = await db.order.findUniqueOrThrow({
      where: { id: row.id },
      include: { payments: true },
    });
    if (current.status === 'CANCELLED')
      expect(current.payments).toHaveLength(0);
    else
      expect(current.payments[0]).toMatchObject({
        status: 'PENDING',
        creationStatus: 'CREATING',
      });
    const settling = await order();
    const p = await payment(settling.id);
    const settled = await Promise.allSettled([
      cancel.cancel(settling.id, adminId, { reason: 'Không được hủy' }),
      paymentStore.applyZalopayResolution({
        transactionRef: p.transactionRef!,
        appId: 123,
        amountVnd: 10000,
        outcome: 'SUCCESS',
      }),
    ]);
    expect(settled[0].status).toBe('rejected');
    expect(settled[1].status).toBe('fulfilled');
    expect(
      await db.order.findUnique({ where: { id: settling.id } }),
    ).toMatchObject({ status: 'PAID' });
    expect(
      await db.ingredient.findUnique({ where: { id: settling.ingredientId } }),
    ).toMatchObject({ stock: 95, reserved: 0 });
  });
  it('filters before paging with exact counts, Vietnam day boundaries and literal SQL search', async () => {
    const marker = `Date-${randomUUID()}`;
    const a = await order();
    await db.order.update({
      where: { id: a.id },
      data: {
        recipientName: marker,
        createdAt: new Date('2026-11-08T17:00:00Z'),
      },
    });
    await payment(a.id, 'SUCCESS');
    const b = await order();
    await db.order.update({
      where: { id: b.id },
      data: {
        recipientName: marker,
        createdAt: new Date('2026-11-09T16:59:59Z'),
      },
    });
    await payment(b.id, 'FAILED', 'REJECTED');
    const c = await order();
    await db.order.update({
      where: { id: c.id },
      data: {
        recipientName: marker,
        createdAt: new Date('2026-11-09T17:00:00Z'),
      },
    });
    await payment(c.id, 'FAILED', 'REJECTED');
    const result = await request(app.getHttpServer())
      .get('/admin/orders')
      .set(admin())
      .query({
        search: marker,
        dateFrom: '2026-11-09',
        dateTo: '2026-11-09',
        paymentStatus: 'FAILED',
        limit: 1,
      })
      .expect(200);
    expect(result.body).toMatchObject({ total: 1, totalPages: 1 });
    expect(result.body.data[0].id).toBe(b.id);
    const none = await request(app.getHttpServer())
      .get('/admin/orders')
      .set(admin())
      .query({ search: "' OR 1=1 --" })
      .expect(200);
    expect(none.body.total).toBe(0);
    const absent = await request(app.getHttpServer())
      .get('/admin/orders')
      .set(admin())
      .query({ search: String(a.id), paymentStatus: 'NONE' })
      .expect(200);
    expect(absent.body.total).toBe(0);
  });
  it('lists all payment statuses, filters/counts/pages and keeps notes out of customer history', async () => {
    const row = await order();
    const p = await payment(row.id, 'RECONCILIATION_REQUIRED');
    const response = await request(app.getHttpServer())
      .get('/payments/admin/transactions')
      .set(admin())
      .query({
        status: 'RECONCILIATION_REQUIRED',
        search: p.transactionRef,
        limit: 1,
      })
      .expect(200);
    expect(response.body).toMatchObject({ total: 1, totalPages: 1 });
    expect(response.body.data[0].id).toBe(p.id);
    const note = await request(app.getHttpServer())
      .patch(`/payments/admin/transactions/${p.id}/note`)
      .set(admin())
      .send({ note: 'Kiểm tra tại quầy' })
      .expect(200);
    expect(note.body).toMatchObject({
      adminNote: 'Kiểm tra tại quầy',
      adminNoteUpdatedById: adminId,
      status: 'RECONCILIATION_REQUIRED',
    });
    expect(note.body.order.payments).toHaveLength(1);
    const own = await request(app.getHttpServer())
      .get(`/payments/${row.id}/details`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    expect(own.body.payments[0]).not.toHaveProperty('adminNote');
    expect(own.body.payments[0]).not.toHaveProperty('adminNoteUpdatedById');
    const all = await request(app.getHttpServer())
      .get('/payments/admin/transactions')
      .set(admin())
      .query({ status: 'ALL', search: String(row.id) })
      .expect(200);
    expect(all.body.data.some((v: { id: number }) => v.id === p.id)).toBe(true);
    await request(app.getHttpServer())
      .patch(`/payments/admin/transactions/${p.id}/note`)
      .set(admin())
      .send({ note: 'x'.repeat(1001) })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/payments/admin/transactions/${p.id}/note`)
      .set(admin())
      .send({ note: 'x', status: 'SUCCESS' })
      .expect(400);
    expect(await db.payment.findUnique({ where: { id: p.id } })).toMatchObject({
      status: 'RECONCILIATION_REQUIRED',
      adminNote: 'Kiểm tra tại quầy',
    });
    expect(await details.adminTransaction(p.id)).not.toHaveProperty(
      'paymentUrl',
    );
  });
  it('recheck uses gateway, preserves manual reconciliation and reports unavailable503', async () => {
    const row = await order();
    const p = await payment(row.id, 'RECONCILIATION_REQUIRED');
    const res = await request(app.getHttpServer())
      .post(`/payments/admin/transactions/${p.id}/recheck`)
      .set(admin())
      .send({})
      .expect(201);
    expect(res.body).toMatchObject({
      result: 'MANUAL_RESOLUTION_REQUIRED',
      payment: { status: 'RECONCILIATION_REQUIRED' },
    });
    gateway.querySandboxOrder = async () => {
      throw new Error('gateway offline');
    };
    await request(app.getHttpServer())
      .post(`/payments/admin/transactions/${p.id}/recheck`)
      .set(admin())
      .send({})
      .expect(503);
    expect(await db.payment.findUnique({ where: { id: p.id } })).toMatchObject({
      status: 'RECONCILIATION_REQUIRED',
    });
  });
});
