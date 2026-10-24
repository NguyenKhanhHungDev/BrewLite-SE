import { describe, expect, it, vi } from 'vitest';
import { PaymentsService } from './payments.service.js';
import type { PaymentOrdersStore } from './payments.contract.js';

function makeTestService(status: 'PENDING' | 'PAID' | 'PAYMENT_FAILED' = 'PENDING') {
  const store: PaymentOrdersStore = {
    findOrderById: vi.fn(async (id: number) =>
      id === 123 ? { id, status } : null),
    updateOrderStatus: vi.fn(async () => undefined),
  };
  return { service: new PaymentsService(store), store };
}

describe('A1-08 PaymentsService', () => {
  it('WALLET SUCCESS sets PAID', async () => {
    const { service, store } = makeTestService();
    const result = await service.pay({
      orderId: 123, method: 'WALLET', simulateResult: 'SUCCESS',
    });
    expect(result).toEqual({ orderId: 123, status: 'PAID' });
    expect(store.updateOrderStatus).toHaveBeenCalledWith(123, 'PAID');
  });

  it('CARD FAILURE sets PAYMENT_FAILED', async () => {
    const { service, store } = makeTestService();
    const result = await service.pay({
      orderId: 123, method: 'CARD', simulateResult: 'FAILURE',
    });
    expect(result).toEqual({ orderId: 123, status: 'PAYMENT_FAILED' });
    expect(store.updateOrderStatus).toHaveBeenCalledWith(123, 'PAYMENT_FAILED');
  });

  it('rejects unknown order', async () => {
    const { service } = makeTestService();
    await expect(service.pay({
      orderId: 999, method: 'WALLET', simulateResult: 'SUCCESS',
    })).rejects.toThrow();
  });

  it('rejects non-PENDING order', async () => {
    const { service } = makeTestService('PAID');
    await expect(service.pay({
      orderId: 123, method: 'CARD', simulateResult: 'SUCCESS',
    })).rejects.toThrow();
  });

  it('rejects invalid method', async () => {
    const { service } = makeTestService();
    await expect(service.pay({
      orderId: 123, method: 'CASH', simulateResult: 'SUCCESS',
    })).rejects.toThrow();
  });

  it('rejects invalid simulateResult or orderId', async () => {
    const { service } = makeTestService();
    await expect(service.pay({
      orderId: 0, method: 'WALLET', simulateResult: 'SUCCESS',
    })).rejects.toThrow();
    await expect(service.pay({
      orderId: 123, method: 'WALLET', simulateResult: 'RANDOM',
    })).rejects.toThrow();
  });
});