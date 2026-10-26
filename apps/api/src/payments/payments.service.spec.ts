import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PaymentsService } from './payments.service.js';
import type {
  PayOnceInput,
  PaymentOrderStatus,
  PaymentOrdersStore,
  PaymentResult,
} from './payments.contract.js';

function makeTestService(
  initialStatus: PaymentOrderStatus = 'PENDING',
  ownerId = 10,
) {
  let currentStatus: PaymentOrderStatus = initialStatus;
  const savedKeys = new Map<
    string,
    { requestHash: string; result: PaymentResult }
  >();
  let dbUpdateCalls = 0;

  const store: PaymentOrdersStore = {
    payOnce: vi.fn(async (input: PayOnceInput) => {
      const existing = savedKeys.get(input.idempotencyKey);
      if (existing) {
        if (existing.requestHash !== input.requestHash) {
          throw new ConflictException(
            'Idempotency-Key already used with different request payload',
          );
        }
        return existing.result;
      }

      if (input.request.orderId !== 123) {
        throw new NotFoundException('Order not found');
      }
      if (input.userId !== ownerId) {
        throw new ForbiddenException('Order does not belong to current user');
      }
      if (currentStatus !== 'PENDING') {
        throw new BadRequestException('Only PENDING orders can be paid');
      }

      const nextStatus =
        input.request.simulateResult === 'SUCCESS' ? 'PAID' : 'PAYMENT_FAILED';
      currentStatus = nextStatus;
      dbUpdateCalls += 1;

      const result: PaymentResult = {
        orderId: input.request.orderId,
        status: nextStatus,
      };
      savedKeys.set(input.idempotencyKey, {
        requestHash: input.requestHash,
        result,
      });
      return result;
    }),
  };

  return {
    service: new PaymentsService(store),
    store,
    getDbUpdateCalls: () => dbUpdateCalls,
  };
}

describe('A1-08 & A1-10 PaymentsService', () => {
  it('WALLET SUCCESS sets PAID', async () => {
    const { service, getDbUpdateCalls } = makeTestService();
    const result = await service.pay(
      { orderId: 123, method: 'WALLET', simulateResult: 'SUCCESS' },
      'key-wallet-1',
      10,
    );
    expect(result).toEqual({ orderId: 123, status: 'PAID' });
    expect(getDbUpdateCalls()).toBe(1);
  });

  it('CARD FAILURE sets PAYMENT_FAILED', async () => {
    const { service, getDbUpdateCalls } = makeTestService();
    const result = await service.pay(
      { orderId: 123, method: 'CARD', simulateResult: 'FAILURE' },
      'key-card-1',
      10,
    );
    expect(result).toEqual({ orderId: 123, status: 'PAYMENT_FAILED' });
    expect(getDbUpdateCalls()).toBe(1);
  });

  it('returns cached result on duplicate Idempotency-Key with same payload without updating twice', async () => {
    const { service, getDbUpdateCalls } = makeTestService();
    const payload = {
      orderId: 123,
      method: 'WALLET',
      simulateResult: 'SUCCESS',
    };

    const first = await service.pay(payload, 'dup-key-1', 10);
    const second = await service.pay(payload, 'dup-key-1', 10);

    expect(first).toEqual({ orderId: 123, status: 'PAID' });
    expect(second).toEqual({ orderId: 123, status: 'PAID' });
    expect(getDbUpdateCalls()).toBe(1);
  });

  it('throws 409 Conflict on same Idempotency-Key with different payload', async () => {
    const { service } = makeTestService();
    await service.pay(
      { orderId: 123, method: 'WALLET', simulateResult: 'SUCCESS' },
      'conflict-key-1',
      10,
    );

    await expect(
      service.pay(
        { orderId: 123, method: 'CARD', simulateResult: 'SUCCESS' },
        'conflict-key-1',
        10,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects missing or empty Idempotency-Key', async () => {
    const { service } = makeTestService();
    await expect(
      service.pay(
        { orderId: 123, method: 'WALLET', simulateResult: 'SUCCESS' },
        '',
        10,
      ),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.pay(
        { orderId: 123, method: 'WALLET', simulateResult: 'SUCCESS' },
        undefined,
        10,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects missing userId or wrong order owner', async () => {
    const { service } = makeTestService('PENDING', 10);
    await expect(
      service.pay(
        { orderId: 123, method: 'WALLET', simulateResult: 'SUCCESS' },
        'key-auth-1',
        undefined,
      ),
    ).rejects.toThrow();

    await expect(
      service.pay(
        { orderId: 123, method: 'WALLET', simulateResult: 'SUCCESS' },
        'key-auth-2',
        999,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects unknown order', async () => {
    const { service } = makeTestService();
    await expect(
      service.pay(
        { orderId: 999, method: 'WALLET', simulateResult: 'SUCCESS' },
        'key-unknown',
        10,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects non-PENDING order when using a new key', async () => {
    const { service } = makeTestService('PAID');
    await expect(
      service.pay(
        { orderId: 123, method: 'CARD', simulateResult: 'SUCCESS' },
        'key-already-paid',
        10,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects invalid method, simulateResult or orderId', async () => {
    const { service } = makeTestService();
    await expect(
      service.pay(
        { orderId: 123, method: 'CASH', simulateResult: 'SUCCESS' },
        'key-invalid-1',
        10,
      ),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.pay(
        { orderId: 0, method: 'WALLET', simulateResult: 'SUCCESS' },
        'key-invalid-2',
        10,
      ),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.pay(
        { orderId: 123, method: 'WALLET', simulateResult: 'RANDOM' },
        'key-invalid-3',
        10,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});