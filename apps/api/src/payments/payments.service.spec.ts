import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
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
  initialStatus: PaymentOrderStatus | 'COMPLETED' = 'PENDING',
  ownerId = 10,
) {
  let currentStatus: string = initialStatus;
  let loyaltyPoints = 0;
  let loyaltyAwarded = false;
  let dbTxCount = 0;

  const savedByUserKey = new Map<
    string,
    {
      userId: number;
      orderId: number;
      method: string;
      requestHash: string;
      result: PaymentResult;
    }
  >();

  const store: PaymentOrdersStore = {
    payOnce: vi.fn(async (input: PayOnceInput) => {
      if (input.request.orderId !== 123) {
        throw new NotFoundException('Order not found');
      }
      if (input.userId !== ownerId) {
        throw new ForbiddenException('Order does not belong to current user');
      }

      const mapKey = `${input.userId}:${input.idempotencyKey}`;
      const existing = savedByUserKey.get(mapKey);
      if (existing) {
        if (
          existing.orderId !== input.request.orderId ||
          existing.method !== input.request.method ||
          existing.requestHash !== input.requestHash
        ) {
          throw new ConflictException(
            'Idempotency-Key already used with different request parameters',
          );
        }
        return existing.result;
      }

      if (currentStatus !== 'PENDING' && currentStatus !== 'PAYMENT_FAILED') {
        throw new ConflictException(
          `Order in status ${currentStatus} cannot be paid`,
        );
      }

      const nextStatus: 'PAID' | 'PAYMENT_FAILED' =
        input.request.simulateResult === 'SUCCESS' ? 'PAID' : 'PAYMENT_FAILED';
      currentStatus = nextStatus;
      dbTxCount += 1;

      if (nextStatus === 'PAID' && !loyaltyAwarded) {
        loyaltyAwarded = true;
        loyaltyPoints += 4;
      }

      const result: PaymentResult = {
        orderId: input.request.orderId,
        status: nextStatus,
      };
      savedByUserKey.set(mapKey, {
        userId: input.userId,
        orderId: input.request.orderId,
        method: input.request.method,
        requestHash: input.requestHash,
        result,
      });
      return result;
    }),
  };

  return {
    service: new PaymentsService(store),
    getDbTxCount: () => dbTxCount,
    getLoyaltyPoints: () => loyaltyPoints,
  };
}

describe('A1-08 & A1-10 PaymentsService', () => {
  it('WALLET SUCCESS sets PAID and awards loyalty points once', async () => {
    const { service, getDbTxCount, getLoyaltyPoints } = makeTestService();
    const res = await service.pay(10, 'key-wallet-1', {
      orderId: 123,
      method: 'WALLET',
      simulateResult: 'SUCCESS',
    });
    expect(res).toEqual({ orderId: 123, status: 'PAID' });
    expect(getDbTxCount()).toBe(1);
    expect(getLoyaltyPoints()).toBe(4);
  });

  it('CARD FAILURE sets PAYMENT_FAILED and does not award points', async () => {
    const { service, getDbTxCount, getLoyaltyPoints } = makeTestService();
    const res = await service.pay(10, 'key-card-fail', {
      orderId: 123,
      method: 'CARD',
      simulateResult: 'FAILURE',
    });
    expect(res).toEqual({ orderId: 123, status: 'PAYMENT_FAILED' });
    expect(getDbTxCount()).toBe(1);
    expect(getLoyaltyPoints()).toBe(0);
  });

  it('allows retry after PAYMENT_FAILED with a new key and awards points on SUCCESS', async () => {
    const { service, getDbTxCount, getLoyaltyPoints } = makeTestService();
    const first = await service.pay(10, 'key-try-1', {
      orderId: 123,
      method: 'CARD',
      simulateResult: 'FAILURE',
    });
    expect(first).toEqual({ orderId: 123, status: 'PAYMENT_FAILED' });
    expect(getLoyaltyPoints()).toBe(0);

    const second = await service.pay(10, 'key-try-2', {
      orderId: 123,
      method: 'WALLET',
      simulateResult: 'SUCCESS',
    });
    expect(second).toEqual({ orderId: 123, status: 'PAID' });
    expect(getDbTxCount()).toBe(2);
    expect(getLoyaltyPoints()).toBe(4);
  });

  it('replays same result on duplicate user + key + payload without re-running transaction', async () => {
    const { service, getDbTxCount, getLoyaltyPoints } = makeTestService();
    const payload = {
      orderId: 123,
      method: 'WALLET',
      simulateResult: 'SUCCESS',
    };
    const r1 = await service.pay(10, 'key-replay', payload);
    const r2 = await service.pay(10, 'key-replay', payload);

    expect(r1).toEqual({ orderId: 123, status: 'PAID' });
    expect(r2).toEqual({ orderId: 123, status: 'PAID' });
    expect(getDbTxCount()).toBe(1);
    expect(getLoyaltyPoints()).toBe(4);
  });

  it('throws 409 Conflict when same key is reused with different payload', async () => {
    const { service } = makeTestService();
    await service.pay(10, 'key-conflict', {
      orderId: 123,
      method: 'WALLET',
      simulateResult: 'SUCCESS',
    });
    await expect(
      service.pay(10, 'key-conflict', {
        orderId: 123,
        method: 'CARD',
        simulateResult: 'SUCCESS',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects missing/invalid JWT userId or wrong order owner', async () => {
    const { service } = makeTestService('PENDING', 10);
    await expect(
      service.pay(undefined, 'key-1', {
        orderId: 123,
        method: 'WALLET',
        simulateResult: 'SUCCESS',
      }),
    ).rejects.toThrow(UnauthorizedException);

    await expect(
      service.pay(999, 'key-1', {
        orderId: 123,
        method: 'WALLET',
        simulateResult: 'SUCCESS',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects missing, empty, or overly long Idempotency-Key', async () => {
    const { service } = makeTestService();
    const body = { orderId: 123, method: 'WALLET', simulateResult: 'SUCCESS' };
    await expect(service.pay(10, undefined, body)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.pay(10, '   ', body)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.pay(10, 'k'.repeat(201), body)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects paying an already PAID order with a new key (409)', async () => {
    const { service } = makeTestService('PAID', 10);
    await expect(
      service.pay(10, 'new-key-on-paid', {
        orderId: 123,
        method: 'WALLET',
        simulateResult: 'SUCCESS',
      }),
    ).rejects.toThrow(ConflictException);
  });
});