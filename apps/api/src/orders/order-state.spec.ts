import { describe, expect, it, vi } from 'vitest';
import { OrderStateService } from './order-state.service.js';
import {
  assertTransition,
  getAllowedTransitions,
  type OrderStatus,
} from './order-state.js';
import type { OrderStateStore } from './order-state.contract.js';
import type { LoyaltyService } from '../loyalty/loyalty.service.js';

describe('A1-10 Order State Machine', () => {
  it('allows every defined edge in the state machine', () => {
    const transitions = getAllowedTransitions();
    for (const [from, destinations] of Object.entries(transitions) as [
      OrderStatus,
      readonly OrderStatus[],
    ][]) {
      for (const to of destinations)
        expect(() => assertTransition(from, to)).not.toThrow();
    }
  });

  it.each([
    ['PENDING', 'COMPLETED'],
    ['COMPLETED', 'PENDING'],
    ['CANCELLED', 'PAID'],
    ['PAID', 'CANCELLED'],
    ['READY', 'PREPARING'],
  ] as const)('rejects %s -> %s', (from, to) => {
    expect(() => assertTransition(from, to)).toThrow();
  });

  it('uses compare-and-set so concurrent stale transitions fail', async () => {
    const transitionIfCurrent = vi.fn(async () => false);
    const store: OrderStateStore = {
      findStatusById: vi.fn(async () => 'PENDING'),
      transitionIfCurrent,
    };
    const loyalty = {
      awardPaidOrder: vi.fn(async () => ({ awarded: false, points: 0 })),
    } as unknown as LoyaltyService;
    const service = new OrderStateService(store, loyalty);
    await expect(service.transition(42, 'PAID')).rejects.toThrow();
    expect(transitionIfCurrent).toHaveBeenCalledWith(42, 'PENDING', 'PAID');
  });

  it('awards loyalty points only after a successful transition to PAID', async () => {
    const store: OrderStateStore = {
      findStatusById: vi.fn(async () => 'PENDING'),
      transitionIfCurrent: vi.fn(async () => true),
    };
    const awardPaidOrder = vi.fn(async () => ({ awarded: true, points: 9 }));
    const loyalty = { awardPaidOrder } as unknown as LoyaltyService;
    const service = new OrderStateService(store, loyalty);
    await expect(service.transition(42, 'PAID')).resolves.toEqual({
      orderId: 42,
      status: 'PAID',
    });
    expect(awardPaidOrder).toHaveBeenCalledWith(42);
  });
});
