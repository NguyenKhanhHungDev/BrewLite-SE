import { expect, it, vi } from 'vitest';
import { OrdersExpirationService } from './orders.expiration.service.js';
import type { OrdersStore } from './orders.contract.js';
import type { PaymentsService } from '../payments/payments.service.js';

it('reconciles gateway results before expiring unpaid orders', async () => {
  const calls: string[] = [];
  const service = new OrdersExpirationService(
    {
      expirePendingOrders: async () => {
        calls.push('expire');
        return 0;
      },
    } as unknown as OrdersStore,
    {
      reconcilePendingZalopayBatch: async () => {
        calls.push('query');
        return 0;
      },
    } as unknown as PaymentsService,
  );
  await service.expireBatch();
  expect(calls).toEqual(['query', 'expire']);
});
it('does not expire orders after a failed reconciliation scan', async () => {
  const expirePendingOrders = vi.fn();
  const service = new OrdersExpirationService(
    { expirePendingOrders } as unknown as OrdersStore,
    {
      reconcilePendingZalopayBatch: async () => {
        throw new Error('DB unavailable');
      },
    } as unknown as PaymentsService,
  );
  expect(await service.expireBatch()).toBe(0);
  expect(expirePendingOrders).not.toHaveBeenCalled();
});
