import { expect, it, vi } from 'vitest';
import { PaymentsPrismaAdapter } from './payments.prisma-adapter.js';
import { PaymentsService } from './payments.service.js';
import { ZalopayService } from './zalopay.service.js';
import type { PaymentOrdersStore } from './payments.contract.js';

function adapter(db: object): PaymentsPrismaAdapter {
  const instance = Object.create(PaymentsPrismaAdapter.prototype);
  Object.defineProperty(instance, 'db', { value: db });
  return instance;
}
const input = {
  userId: 1,
  orderId: 10,
  idempotencyKey: 'key',
  requestHash: 'hash',
};
const payment = {
  id: 20,
  ...input,
  provider: 'ZALOPAY',
  status: 'PENDING',
  amount: 50000,
  transactionRef: 'ref',
  paymentUrl: 'https://example.com/pay',
};

it('locks the order before reading attempts and replays the persisted URL', async () => {
  const calls: string[] = [];
  const tx = {
    $queryRaw: vi.fn(async () => {
      calls.push('lock');
      return [];
    }),
    payment: {
      findUnique: vi.fn(async () => {
        calls.push('read');
        return payment;
      }),
    },
  };
  const db = { $transaction: (fn: (t: object) => unknown) => fn(tx) };
  const result = await adapter(db).claimZalopayAttempt(input);
  expect(calls).toEqual(['lock', 'read']);
  expect(result.cachedPaymentUrl).toBe(payment.paymentUrl);
  expect((await adapter(db).claimZalopayAttempt(input)).cachedPaymentUrl).toBe(
    payment.paymentUrl,
  );
});

it('rejects new attempts after reservation release', async () => {
  const create = vi.fn();
  const tx = {
    $queryRaw: vi.fn(),
    payment: { findUnique: vi.fn().mockResolvedValue(null), create },
    order: {
      findUnique: vi.fn().mockResolvedValue({
        id: 10,
        userId: 1,
        status: 'PAYMENT_FAILED',
        expiresAt: null,
      }),
    },
  };
  await expect(
    adapter({
      $transaction: (fn: (t: object) => unknown) => fn(tx),
    }).claimZalopayAttempt(input),
  ).rejects.toThrow('cannot initiate payment');
  expect(create).not.toHaveBeenCalled();
});

it('stores the URL without changing payment status', async () => {
  const updateMany = vi.fn();
  await adapter({ payment: { updateMany } }).saveZalopayPaymentUrl({
    paymentId: 20,
    transactionRef: 'ref',
    paymentUrl: payment.paymentUrl,
  });
  expect(updateMany).toHaveBeenCalledWith({
    where: { id: 20, transactionRef: 'ref' },
    data: { paymentUrl: payment.paymentUrl, creationStatus: 'READY' },
  });
});

it('reconciles success after reservation release without consuming inventory', async () => {
  const tx = {
    $queryRaw: vi.fn(),
    payment: {
      findUnique: vi.fn().mockResolvedValue(payment),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    order: {
      findUnique: vi.fn().mockResolvedValue({
        id: 10,
        status: 'PAYMENT_FAILED',
        expiresAt: null,
      }),
    },
  };
  const result = await adapter({
    $transaction: (fn: (t: object) => unknown) => fn(tx),
  }).applyZalopayResolution({
    transactionRef: 'ref',
    appId: 1,
    amountVnd: 50000,
    outcome: 'SUCCESS',
  });
  expect(result.paymentStatus).toBe('RECONCILIATION_REQUIRED');
  expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
});

it('does not recreate a gateway order when the previous outcome is unknown', async () => {
  const store = {
    claimZalopayAttempt: vi.fn().mockResolvedValue({
      ...payment,
      paymentId: 20,
      mode: 'REPLAY',
      cachedPaymentUrl: null,
    }),
  } as unknown as PaymentOrdersStore;
  const gateway = new ZalopayService();
  vi.spyOn(gateway, 'getValidatedConfig').mockReturnValue({} as never);
  const create = vi.spyOn(gateway, 'createSandboxOrder');
  await expect(
    new PaymentsService(store, gateway).createZalopayPayment(1, 'key', {
      orderId: 10,
    }),
  ).rejects.toThrow('outcome is unknown');
  expect(create).not.toHaveBeenCalled();
});

it.each(['REJECTED', 'UNKNOWN'] as const)(
  'records %s creation outcomes separately',
  async (status) => {
    const { ZalopayCreationRejected } = await import('./zalopay.service.js');
    const markZalopayCreation = vi.fn();
    const store = {
      claimZalopayAttempt: vi
        .fn()
        .mockResolvedValue({ ...payment, paymentId: 20, mode: 'NEW' }),
      markZalopayCreation,
    } as unknown as PaymentOrdersStore;
    const gateway = new ZalopayService();
    vi.spyOn(gateway, 'getValidatedConfig').mockReturnValue({} as never);
    vi.spyOn(gateway, 'createSandboxOrder').mockRejectedValue(
      status === 'REJECTED'
        ? new ZalopayCreationRejected('rejected')
        : new Error('timeout'),
    );
    await expect(
      new PaymentsService(store, gateway).createZalopayPayment(1, 'key', {
        orderId: 10,
      }),
    ).rejects.toThrow();
    expect(markZalopayCreation).toHaveBeenCalledWith(20, 'ref', status);
  },
);

it('queries and applies success without a browser callback', async () => {
  const applyZalopayResolution = vi.fn().mockResolvedValue({ applied: true });
  const store = {
    listPendingZalopayAttempts: vi
      .fn()
      .mockResolvedValue([{ transactionRef: 'ref', amount: 50000 }]),
    applyZalopayResolution,
  } as unknown as PaymentOrdersStore;
  const gateway = new ZalopayService();
  vi.spyOn(gateway, 'getValidatedConfig').mockReturnValue({
    appId: 554,
  } as never);
  vi.spyOn(gateway, 'querySandboxOrder').mockResolvedValue({
    return_code: 1,
    amount: 50000,
    zp_trans_id: '123',
  });
  expect(
    await new PaymentsService(store, gateway).reconcilePendingZalopayBatch(),
  ).toBe(1);
  expect(applyZalopayResolution).toHaveBeenCalledWith(
    expect.objectContaining({ outcome: 'SUCCESS' }),
  );
});

it.each([true, false])(
  'keeps processing=%s correct past the gateway payment window',
  async (processing) => {
    const applyZalopayResolution = vi.fn().mockResolvedValue({ applied: true });
    const store = {
      listPendingZalopayAttempts: async () => [
        {
          transactionRef: 'ref',
          amount: 50000,
          createdAt: new Date(Date.now() - 16 * 60_000),
        },
      ],
      applyZalopayResolution,
    } as unknown as PaymentOrdersStore;
    const gateway = new ZalopayService();
    vi.spyOn(gateway, 'getValidatedConfig').mockReturnValue({
      appId: 554,
    } as never);
    vi.spyOn(gateway, 'querySandboxOrder').mockResolvedValue({
      return_code: 3,
      is_processing: processing,
    });
    await new PaymentsService(store, gateway).reconcilePendingZalopayBatch();
    expect(applyZalopayResolution).toHaveBeenCalledTimes(processing ? 0 : 1);
  },
);
