import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { OrdersService } from './orders.service.js';
import type {
  OrderDraft,
  OrdersStore,
  StoredOrderResult,
  RecipeSnapshot,
} from './orders.contract.js';

function makeTestService() {
  const records = new Map<string, StoredOrderResult>();
  const recipe: RecipeSnapshot = {
    id: 1, name: 'Ca phe sua', price: 25000, isActive: true,
    ingredients: [{
      ingredientId: 10, quantity: 20,
      ingredient: { id: 10, name: 'Ca phe', unit: 'g', stock: 1000, reserved: 0, version: 0 },
    }],
  };
  const saveOrder = vi.fn(async (draft: OrderDraft) => {
    const result: StoredOrderResult = {
      id: 42,
      status: 'PENDING',
      total: draft.total,
      idempotencyHash: draft.idempotencyHash,
      recipientName: draft.recipientName,
      recipientPhone: draft.recipientPhone,
    };
    if (draft.idempotencyKey) {
      records.set(`${draft.userId}:${draft.idempotencyKey}`, result);
    }
    return result;
  });
  const listAdminOrders = vi.fn(async () => ({
    data: [],
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  }));
  const updateLegacyRecipientSnapshot = vi.fn(
    async (
      userId: number,
      key: string,
      legacyHash: string,
      currentHash: string,
      recipientName: string,
      recipientPhone: string,
    ) => {
      const recordKey = `${userId}:${key}`;
      const existing = records.get(recordKey);
      if (
        !existing ||
        existing.idempotencyHash !== legacyHash ||
        existing.recipientName != null ||
        existing.recipientPhone != null
      ) return false;
      records.set(recordKey, {
        ...existing,
        idempotencyHash: currentHash,
        recipientName,
        recipientPhone,
      });
      return true;
    },
  );
  const store: OrdersStore = {
    getRecipeById: vi.fn(async (id: number) => id === 1 ? recipe : null),
    getToppingIngredients: vi.fn(async () => ({
      pearl: { id: 30, name: 'Trân châu', unit: 'g', stock: 1000, reserved: 0, version: 0 },
      cream: { id: 31, name: 'Kem sữa', unit: 'ml', stock: 1000, reserved: 0, version: 0 },
    })),
    findOrderByIdempotencyKey: vi.fn(
      async (userId: number, key: string) =>
        records.get(`${userId}:${key}`) ?? null,
    ),
    updateLegacyRecipientSnapshot,
    saveOrder,
    findOrderForUser: vi.fn(async () => null),
    findAdminOrder: vi.fn(async () => null),
    listAdminOrders,
    expirePendingOrders: vi.fn(async () => 0),
  };
  return {
    service: new OrdersService(store),
    store,
    saveOrder,
    listAdminOrders,
    updateLegacyRecipientSnapshot,
    records,
  };
}

describe('A1-06 OrdersService', () => {
  const recipient = {
    recipientName: 'Nguyen Van A',
    recipientPhone: '0901234567',
  };
  it('creates PENDING order and calculates price on server', async () => {
    const { service, saveOrder } = makeTestService();
    const result = await service.create(7, {
      ...recipient,
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
        recipientName: 'Nguyen Van A',
        recipientPhone: '0901234567',
      }),
    );
  });


  it('preserves recipient and preferences and rejects changed idempotent requests', async () => {
    const { service, saveOrder } = makeTestService();
    const body = {
      ...recipient,
      items: [{ productId: 1, quantity: 1, sugarLevel: 50, iceLevel: 'LESS', note: '  Mang di  ' }],
    };
    const first = await service.create(7, body, 'preferences-recipient');
    expect(saveOrder).toHaveBeenCalledWith(expect.objectContaining({
      ...recipient,
      items: [expect.objectContaining({ sugarLevel: 50, iceLevel: 'LESS', note: 'Mang di', subtotal: 25000 })],
    }));
    await expect(service.create(7, body, 'preferences-recipient')).resolves.toEqual(first);
    expect(saveOrder).toHaveBeenCalledTimes(1);
    for (const change of [{ sugarLevel: 0 }, { iceLevel: 'NONE' }, { note: 'Other' }]) {
      await expect(service.create(7, {
        ...body, items: [{ ...body.items[0], ...change }],
      }, 'preferences-recipient')).rejects.toThrow(/Idempotency-Key/);
    }
    await expect(service.create(7, {
      ...body, recipientPhone: '0907654321',
    }, 'preferences-recipient')).rejects.toThrow(/Idempotency-Key/);
  });

  it('requires valid recipient information and normalizes phone formatting', async () => {
    const { service, saveOrder } = makeTestService();
    await expect(
      service.create(7, { items: [{ productId: 1, quantity: 1 }] }),
    ).rejects.toThrow(/recipientName/);
    await expect(
      service.create(7, { ...recipient, recipientPhone: '123', items: [{ productId: 1, quantity: 1 }] }),
    ).rejects.toThrow(/recipientPhone/);
    await service.create(7, {
      ...recipient,
      recipientPhone: '+84 901-234-567',
      items: [{ productId: 1, quantity: 1 }],
    });
    expect(saveOrder).toHaveBeenCalledWith(
      expect.objectContaining({ recipientPhone: '+84901234567' }),
    );
  });

  it('rejects empty items', async () => {
    const { service } = makeTestService();
    await expect(service.create(7, { ...recipient, items: [] })).rejects.toThrow();
  });

  it('rejects negative quantity', async () => {
    const { service } = makeTestService();
    await expect(
      service.create(7, { ...recipient, items: [{ productId: 1, quantity: -1 }] }),
    ).rejects.toThrow();
  });

  it('rejects client-supplied total or price', async () => {
    const { service } = makeTestService();
    await expect(
      service.create(7, { ...recipient, items: [{ productId: 1, quantity: 1 }], total: 1 }),
    ).rejects.toThrow();
  });

  it('rejects unknown product', async () => {
    const { service } = makeTestService();
    await expect(
      service.create(7, { ...recipient, items: [{ productId: 999, quantity: 1 }] }),
    ).rejects.toThrow();
  });

  it('calculates size and topping prices on the server', async () => {
    const { service, saveOrder } = makeTestService();
    const result = await service.create(7, {
      ...recipient,
      items: [{ productId: 1, quantity: 2, size: 'L', toppings: ['PEARL'] }],
    });
    expect(result.total).toBe(70000);
    expect(saveOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            recipeName: 'Ca phe sua',
            basePrice: 25000,
            unitPrice: 35000,
            size: 'L',
            toppings: ['PEARL'],
          }),
        ],
      }),
    );
  });

  it('rejects invalid topping and insufficient ingredient stock', async () => {
    const { service } = makeTestService();
    await expect(
      service.create(7, {
        ...recipient,
        items: [{ productId: 1, quantity: 1, toppings: ['MILK'] }],
      }),
    ).rejects.toThrow();
    await expect(
      service.create(7, { ...recipient, items: [{ productId: 1, quantity: 51 }] }),
    ).rejects.toThrow();
  });

  it('rejects missing authenticated user', async () => {
    const { service } = makeTestService();
    await expect(
      service.create(0, { ...recipient, items: [{ productId: 1, quantity: 1 }] }),
    ).rejects.toThrow();
  });

  it('applies BREW10 and stores total after discount', async () => {
    const { service, saveOrder } = makeTestService();
    const result = await service.create(7, {
      ...recipient,
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

  it('validates admin date/status filters and converts Vietnam calendar days to UTC bounds', async () => {
    const { service, listAdminOrders } = makeTestService();
    await service.listAdminOrders('2', '10', '2026-11-06', '2026-11-06', 'PENDING');
    expect(listAdminOrders).toHaveBeenCalledWith(2, 10, {
      dateFrom: new Date('2026-11-05T17:00:00.000Z'),
      dateToExclusive: new Date('2026-11-06T17:00:00.000Z'),
      status: 'PENDING',
    });
    await expect(service.listAdminOrders('1', '10', '2026-11-07', '2026-11-06'))
      .rejects.toThrow(/dateFrom/);
    await expect(service.listAdminOrders('1', '10', undefined, undefined, 'INVALID'))
      .rejects.toThrow(/status/);
    await expect(service.listAdminOrders('1', '51'))
      .rejects.toThrow(/limit/);
  });

  it('replays the same idempotency key without creating another order', async () => {
    const { service, saveOrder } = makeTestService();
    const payload = { ...recipient, items: [{ productId: 1, quantity: 2 }] };
    const first = await service.create(7, payload, 'checkout-123');
    const second = await service.create(7, payload, 'checkout-123');
    expect(second).toEqual(first);
    expect(saveOrder).toHaveBeenCalledTimes(1);
  });

  it('upgrades one old idempotent draft with missing recipient snapshot safely', async () => {
    const { service, updateLegacyRecipientSnapshot, records, saveOrder } = makeTestService();
    const key = 'legacy-draft';
    const oldHash = createHash('sha256')
      .update(JSON.stringify({
        items: [{ productId: 1, quantity: 1, size: 'M', toppings: [] }],
        promoCode: null,
      }))
      .digest('hex');
    records.set(`7:${key}`, {
      id: 41,
      status: 'PENDING',
      total: 25000,
      idempotencyHash: oldHash,
      recipientName: null,
      recipientPhone: null,
    });

    const body = { ...recipient, items: [{ productId: 1, quantity: 1 }] };
    expect(await service.create(7, body, key)).toEqual({
      orderId: 41,
      status: 'PENDING',
      total: 25000,
    });
    expect(updateLegacyRecipientSnapshot).toHaveBeenCalledOnce();
    expect(saveOrder).not.toHaveBeenCalled();
    expect(records.get(`7:${key}`)).toMatchObject({
      recipientName: recipient.recipientName,
      recipientPhone: recipient.recipientPhone,
    });
    await service.create(7, body, key);
    expect(updateLegacyRecipientSnapshot).toHaveBeenCalledOnce();
  });

  it('rejects reuse of an idempotency key for different input', async () => {
    const { service } = makeTestService();
    await service.create(
      7,
      { ...recipient, items: [{ productId: 1, quantity: 1 }] },
      'checkout-123',
    );
    await expect(
      service.create(
        7,
        { ...recipient, items: [{ productId: 1, quantity: 2 }] },
        'checkout-123',
      ),
    ).rejects.toThrow();
  });

  it('rejects invalid idempotency key', async () => {
    const { service } = makeTestService();
    await expect(
      service.create(7, { ...recipient, items: [{ productId: 1, quantity: 1 }] }, '  '),
    ).rejects.toThrow();
  });
});
