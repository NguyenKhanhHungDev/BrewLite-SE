import { describe, expect, it, vi } from 'vitest';
import { OrdersService } from './orders.service.js';
import type {
  OrderDraft,
  OrdersStore,
  StoredOrderResult,
} from './orders.contract.js';

function makeTestService() {
  const records = new Map<string, StoredOrderResult>();
  const saveOrder = vi.fn(async (draft: OrderDraft) => {
    const result: StoredOrderResult = {
      id: 42,
      status: 'PENDING',
      total: draft.total,
      idempotencyHash: draft.idempotencyHash,
    };
    if (draft.idempotencyKey) {
      records.set(`${draft.userId}:${draft.idempotencyKey}`, result);
    }
    return result;
  });
  const store: OrdersStore = {
    getProductById: vi.fn(async (id: number) =>
      id === 1 ? { id: 1, price: 25000, stock: 20 } : null,
    ),
    findOrderByIdempotencyKey: vi.fn(
      async (userId: number, key: string) =>
        records.get(`${userId}:${key}`) ?? null,
    ),
    saveOrder,
  };
  return { service: new OrdersService(store), store, saveOrder };
}

describe('A1-06 OrdersService', () => {
  it('creates PENDING order and calculates price on server', async () => {
    const { service, saveOrder } = makeTestService();
    const result = await service.create(7, {
      items: [{ productId: 1, quantity: 2 }],
    });
    expect(result).toEqual({ orderId: 42, status: 'PENDING', total: 50000 });
    expect(saveOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        status: 'PENDING',
        total: 50000,
        discount: 0,
        promoCode: null,
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
      service.create(7, { items: [{ productId: 1, quantity: -1 }] }),
    ).rejects.toThrow();
  });

  it('rejects client-supplied total or price', async () => {
    const { service } = makeTestService();
    await expect(
      service.create(7, { items: [{ productId: 1, quantity: 1 }], total: 1 }),
    ).rejects.toThrow();
  });

  it('rejects unknown product', async () => {
    const { service } = makeTestService();
    await expect(
      service.create(7, { items: [{ productId: 999, quantity: 1 }] }),
    ).rejects.toThrow();
  });

  it('calculates size and topping prices on the server', async () => {
    const { service, saveOrder } = makeTestService();
    const result = await service.create(7, {
      items: [{ productId: 1, quantity: 2, size: 'L', toppings: ['PEARL'] }],
    });
    expect(result.total).toBe(70000);
    expect(saveOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            unitPrice: 35000,
            size: 'L',
            toppings: ['PEARL'],
          }),
        ],
      }),
    );
  });

  it('rejects invalid topping and quantity over stock', async () => {
    const { service } = makeTestService();
    await expect(
      service.create(7, {
        items: [{ productId: 1, quantity: 1, toppings: ['MILK'] }],
      }),
    ).rejects.toThrow();
    await expect(
      service.create(7, { items: [{ productId: 1, quantity: 21 }] }),
    ).rejects.toThrow();
  });

  it('rejects missing authenticated user', async () => {
    const { service } = makeTestService();
    await expect(
      service.create(0, { items: [{ productId: 1, quantity: 1 }] }),
    ).rejects.toThrow();
  });

  it('applies BREW10 and stores total after discount', async () => {
    const { service, saveOrder } = makeTestService();
    const result = await service.create(7, {
      items: [{ productId: 1, quantity: 4 }],
      promoCode: 'brew10',
    });
    expect(result.total).toBe(90000);
    expect(saveOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 90000,
        discount: 10000,
        promoCode: 'BREW10',
      }),
    );
  });

  it('replays the same idempotency key without creating another order', async () => {
    const { service, saveOrder } = makeTestService();
    const payload = { items: [{ productId: 1, quantity: 2 }] };
    const first = await service.create(7, payload, 'checkout-123');
    const second = await service.create(7, payload, 'checkout-123');
    expect(second).toEqual(first);
    expect(saveOrder).toHaveBeenCalledTimes(1);
  });

  it('rejects reuse of an idempotency key for different input', async () => {
    const { service } = makeTestService();
    await service.create(
      7,
      { items: [{ productId: 1, quantity: 1 }] },
      'checkout-123',
    );
    await expect(
      service.create(
        7,
        { items: [{ productId: 1, quantity: 2 }] },
        'checkout-123',
      ),
    ).rejects.toThrow();
  });

  it('rejects invalid idempotency key', async () => {
    const { service } = makeTestService();
    await expect(
      service.create(7, { items: [{ productId: 1, quantity: 1 }] }, '  '),
    ).rejects.toThrow();
  });
});
