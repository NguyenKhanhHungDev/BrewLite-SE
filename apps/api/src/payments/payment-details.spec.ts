import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import {
  PaymentDetailsService,
  safePaymentSelect,
} from './payment-details.service.js';
import { PaymentDetailsController } from './payment-details.controller.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AdminGuard } from '../auth/admin.guard.js';

describe('Payment details', () => {
  function service(db: unknown) {
    return Object.assign(Object.create(PaymentDetailsService.prototype), {
      db,
    }) as PaymentDetailsService;
  }
  it('filters by authenticated owner and rejects missing / foreign orders', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    await expect(
      service({ order: { findFirst } }).forOrder(7, 8),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(findFirst.mock.calls[0][0].where).toEqual({ id: 8, userId: 7 });
  });
  it('returns all attempts and the persisted deadline without leaking fields', async () => {
    const expiresAt = new Date('2026-11-07T10:00:00Z');
    const payments = [
      { id: 2, status: 'PENDING' },
      { id: 1, status: 'FAILED' },
    ];
    const findFirst = vi
      .fn()
      .mockResolvedValue({ id: 8, status: 'PENDING', expiresAt, payments });
    const result = await service({ order: { findFirst } }).forOrder(7, 8);
    expect(result.payments).toEqual(payments);
    expect(result.orderExpiresAt).toBe(expiresAt);
    expect(Object.keys(safePaymentSelect)).not.toEqual(
      expect.arrayContaining(['requestHash', 'paymentUrl', 'idempotencyKey']),
    );
    expect(findFirst.mock.calls[0][0].select.payments.select).toEqual(
      safePaymentSelect,
    );
  });
  it('filters reconciliation before pagination in a consistent transaction', async () => {
    const count = vi.fn().mockResolvedValue(21);
    const findMany = vi.fn().mockResolvedValue([{ id: 2 }]);
    const transaction = vi.fn(async (queries: Promise<unknown>[]) =>
      Promise.all(queries),
    );
    const result = await service({
      payment: { count, findMany },
      $transaction: transaction,
    }).reconciliation(2);
    expect(result.total).toBe(21);
    expect(findMany.mock.calls[0][0]).toMatchObject({
      where: { status: 'RECONCILIATION_REQUIRED' },
      skip: 20,
      take: 20,
    });
  });
  it('protects routes with JWT and reconciliation with AdminGuard', () => {
    expect(
      Reflect.getMetadata('__guards__', PaymentDetailsController),
    ).toContain(JwtAuthGuard);
    expect(
      Reflect.getMetadata(
        '__guards__',
        Object.getOwnPropertyDescriptor(
          PaymentDetailsController.prototype,
          'reconciliation',
        )!.value,
      ),
    ).toContain(AdminGuard);
  });
  it('rejects invalid pages and order IDs', () => {
    const controller = new PaymentDetailsController(
      {} as PaymentDetailsService,
    );
    for (const page of ['0', '-1', '1.5', 'x', '1000001'])
      expect(() => controller.reconciliation(page)).toThrow(
        BadRequestException,
      );
    expect(() => controller.forOrder({ user: { id: 1 } }, -1)).toThrow(
      BadRequestException,
    );
  });
});
