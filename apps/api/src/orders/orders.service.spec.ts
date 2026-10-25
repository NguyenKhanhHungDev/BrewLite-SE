import { describe, expect, it, vi } from 'vitest';
import { OrdersService } from './orders.service.js';
import type { OrdersStore } from './orders.contract.js';

function makeTestService() {
  const store: OrdersStore = {
    getProductById: vi.fn(async (id: number) =>
      id === 1 ? { id: 1, price: 25000, stock: 20 } : null,
    ),
    saveOrder: vi.fn(async () => ({ id: 42 })),
  };
  return { service: new OrdersService(store), store };
}

describe('A1-06 OrdersService', () => {
  it('creates PENDING order and calculates price on server', async () => {
    const { service, store } = makeTestService();
    const result = await service.create(7, {
      items: [{ productId: 1, quantity: 2 }],
    });
    expect(result).toEqual({ orderId: 42, status: 'PENDING', total: 50000 });
    expect(store.saveOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        status: 'PENDING',
        total: 50000,
      }),
    );
  });

  it('rejects empty items', async () => {
    const { service } = makeTestService();
    await expect(service.create(7, { items: [] })).rejects.toThrow();
  });

  it('rejects negative quantity', async () => {
    const { service } = makeTestService();
    await expect(
      service.create(7, {
        items: [{ productId: 1, quantity: -1 }],
      }),
    ).rejects.toThrow();
  });

  it('rejects client-supplied total or price', async () => {
    const { service } = makeTestService();
    await expect(
      service.create(7, {
        items: [{ productId: 1, quantity: 1 }],
        total: 1,
      }),
    ).rejects.toThrow();
  });

  it('rejects unknown product', async () => {
    const { service } = makeTestService();
    await expect(
      service.create(7, {
        items: [{ productId: 999, quantity: 1 }],
      }),
    ).rejects.toThrow();
  });

  it('calculates size and topping prices on the server', async () => {
    const { service, store } = makeTestService();
    const result = await service.create(7, { items: [{ productId: 1, quantity: 2, size: 'L', toppings: ['PEARL'] }] });
    expect(result.total).toBe(70000);
    expect(store.saveOrder).toHaveBeenCalledWith(expect.objectContaining({ items: [expect.objectContaining({ unitPrice: 35000, size: 'L', toppings: ['PEARL'] })] }));
  });

  it('rejects invalid topping and quantity over stock', async () => {
    const { service } = makeTestService();
    await expect(service.create(7, { items: [{ productId: 1, quantity: 1, toppings: ['MILK'] }] })).rejects.toThrow();
    await expect(service.create(7, { items: [{ productId: 1, quantity: 21 }] })).rejects.toThrow();
  });

  it('rejects missing authenticated user', async () => {
    const { service } = makeTestService();
    await expect(
      service.create(0, {
        items: [{ productId: 1, quantity: 1 }],
      }),
    ).rejects.toThrow();
  });
});
