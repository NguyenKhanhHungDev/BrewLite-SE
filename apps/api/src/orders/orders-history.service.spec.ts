import { describe, expect, it, vi } from 'vitest';
import { OrdersHistoryService } from './orders-history.service.js';
import type { OrdersHistoryStore } from './orders-history.contract.js';

function makeHistoryService() {
  const findMine = vi.fn(async (userId: number) => {
    const allOrders = [
      {
        id: 20,
        status: 'PAID',
        total: 90000,
        createdAt: new Date('2026-10-26T10:00:00.000Z'),
        items: [],
      },
      {
        id: 19,
        status: 'PENDING',
        total: 45000,
        createdAt: new Date('2026-10-25T10:00:00.000Z'),
        items: [],
      },
      {
        id: 21,
        status: 'PENDING',
        total: 30000,
        createdAt: new Date('2026-10-26T11:00:00.000Z'),
        items: [],
      },
    ];
    return userId === 1
      ? allOrders.slice(0, 2)
      : allOrders.filter((order) => order.id === 21);
  });
  const store: OrdersHistoryStore = { findMine };
  return { service: new OrdersHistoryService(store), store, findMine };
}

describe('A1-09 OrdersHistoryService', () => {
  it('returns only the authenticated user orders', async () => {
    const { service, findMine } = makeHistoryService();
    const orders = await service.findMine(1);
    expect(orders.map((order) => order.id)).toEqual([20, 19]);
    expect(findMine).toHaveBeenCalledWith(1);
    expect(orders.every((order) => !('userId' in order))).toBe(true);
  });

  it('returns an empty array when a user has no orders', async () => {
    const store: OrdersHistoryStore = { findMine: vi.fn(async () => []) };
    const service = new OrdersHistoryService(store);
    await expect(service.findMine(99)).resolves.toEqual([]);
  });

  it('rejects an invalid authenticated user id', async () => {
    const { service } = makeHistoryService();
    await expect(service.findMine(0)).rejects.toThrow();
  });
});
