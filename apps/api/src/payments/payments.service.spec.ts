import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  GoneException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service.js';
import { ZalopayService } from './zalopay.service.js';
import type { PaymentOrdersStore } from './payments.contract.js';

describe('ZalopayService & PaymentsService (05_THANG Spec)', () => {
  const TEST_ENV = {
    ZALOPAY_APP_ID: '554',
    ZALOPAY_KEY1: '8NdU5pG5R2spGHGhyO99HN1OhD8IQJBn',
    ZALOPAY_KEY2: 'uUfsWgfLkRLzq6W2uNXTCxrfxs51auny',
    ZALOPAY_API_BASE_URL: 'https://sb-openapi.zalopay.vn',
    ZALOPAY_CALLBACK_URL: 'https://example.com/payments/zalopay/callback',
    ZALOPAY_RETURN_URL: 'http://localhost:3000/payment/result',
  };

  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, ...TEST_ENV };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('verifies fixed HMAC-SHA256 test vector for create & callback signatures', () => {
    const zp = new ZalopayService();
    const mac = zp.signCreateOrderPayload(
      {
        appId: 554,
        appTransId: '261104_BREW_10_1',
        appUser: 'user_1',
        amount: 55000,
        appTime: 1700000000000,
        embedData:
          '{"redirecturl":"http://localhost:3000/payment/result?orderId=10","orderId":10}',
        item: '[]',
      },
      TEST_ENV.ZALOPAY_KEY1,
    );

    // Kiểm tra định dạng hex 64 ký tự và đối chiếu vector cố định
    expect(mac).toMatch(/^[a-f0-9]{64}$/);
    expect(mac).toBe(
      'c9875d99e9f6ff88516f2887f50207c7f2599c4459d50dc4dadbda77085db923',
    );

    const rawCallbackData =
      '{"app_id":554,"app_trans_id":"261104_BREW_10_1","amount":55000,"zp_trans_id":999888}';
    const callbackMac = zp.signCallbackData(
      rawCallbackData,
      TEST_ENV.ZALOPAY_KEY2,
    );

    expect(zp.verifyCallbackSignature(rawCallbackData, callbackMac)).toBe(true);
    expect(zp.verifyCallbackSignature(rawCallbackData, '0'.repeat(64))).toBe(
      false,
    );
  });

  it('throws 503 ServiceUnavailableException when ZaloPay env uses placeholders', () => {
    process.env.ZALOPAY_KEY1 = 'SANDBOX_KEY_PLACEHOLDER';
    const zp = new ZalopayService();
    expect(() => zp.getValidatedConfig()).toThrow(ServiceUnavailableException);
  });

  it('returns 410 Gone for deprecated mock payment endpoint', async () => {
    const mockStore = {} as PaymentOrdersStore;
    const service = new PaymentsService(mockStore, new ZalopayService());

    await expect(service.pay(1, 'key-1', {})).rejects.toThrow(GoneException);
  });

  it('returns 201 on first create and 200 on idempotent replay with same URL', async () => {
    let savedUrl: string | null = null;
    let callCount = 0;

    const store: PaymentOrdersStore = {
      markZalopayCreation: vi.fn(),
      claimZalopayAttempt: async () => {
        callCount += 1;
        return {
          mode: callCount === 1 ? 'NEW' : 'REPLAY',
          orderId: 12,
          paymentId: 101,
          amount: 65000,
          transactionRef: '261104_BREW_12_101',
          status: 'PENDING',
          cachedPaymentUrl: savedUrl,
        };
      },
      saveZalopayPaymentUrl: async ({ paymentUrl }) => {
        savedUrl = paymentUrl;
      },
      applyZalopayResolution: async () => ({
        applied: true,
        duplicate: false,
        paymentStatus: 'SUCCESS',
      }),
      listPendingZalopayAttempts: async () => [],
      getOrderPaymentStatus: async () => ({
        orderId: 12,
        orderStatus: 'PENDING',
        latestPayment: {
          paymentId: 101,
          provider: 'ZALOPAY',
          transactionRef: '261104_BREW_12_101',
          amount: 65000,
          status: 'PENDING',
          paidAt: null,
        },
      }),
    };

    const zp = new ZalopayService();
    const createSpy = vi.spyOn(zp, 'createSandboxOrder').mockResolvedValue({
      paymentUrl: 'https://sb-openapi.zalopay.vn/pay/v2/test-order-url',
      rawResponse: {
        return_code: 1,
        order_url: 'https://sb-openapi.zalopay.vn/pay/v2/test-order-url',
      },
    });

    const service = new PaymentsService(store, zp);

    const first = await service.createZalopayPayment(1, 'idem-key-123', {
      orderId: 12,
    });
    expect(first.httpStatus).toBe(201);
    expect(first.body.paymentUrl).toBe(
      'https://sb-openapi.zalopay.vn/pay/v2/test-order-url',
    );

    const second = await service.createZalopayPayment(1, 'idem-key-123', {
      orderId: 12,
    });
    expect(second.httpStatus).toBe(200);
    expect(second.body.paymentId).toBe(101);
    expect(second.body.paymentUrl).toBe(first.body.paymentUrl);
    expect(createSpy).toHaveBeenCalledTimes(1);
  });

  it('handles callback verification, rejects invalid MAC/app_id/amount without applying, and deduplicates repeats', async () => {
    let resolutionCalls = 0;

    const store: PaymentOrdersStore = {
      markZalopayCreation: vi.fn(),
      claimZalopayAttempt: vi.fn(),
      saveZalopayPaymentUrl: vi.fn(),
      listPendingZalopayAttempts: async () => [],
      getOrderPaymentStatus: vi.fn(),
      applyZalopayResolution: async (input) => {
        if (input.amountVnd !== 45000) {
          throw new BadRequestException('Amount mismatch');
        }
        resolutionCalls += 1;
        return {
          applied: resolutionCalls === 1,
          duplicate: resolutionCalls > 1,
          paymentStatus: 'SUCCESS',
          orderStatus: 'PAID',
        };
      },
    };

    const zp = new ZalopayService();
    const service = new PaymentsService(store, zp);

    const rawData = JSON.stringify({
      app_id: 554,
      app_trans_id: '261104_BREW_15_200',
      amount: 45000,
      zp_trans_id: 123456789,
    });
    const validMac = zp.signCallbackData(rawData);

    // 1. Sai MAC -> return_code = -1, không gọi DB
    const badRes = await service.handleZalopayCallback({
      data: rawData,
      mac: 'bad_mac',
    });
    expect(badRes.return_code).toBe(-1);
    expect(resolutionCalls).toBe(0);

    // 2. Sai app_id -> return_code = -1, không gọi DB
    const wrongAppData = JSON.stringify({
      app_id: 999,
      app_trans_id: '261104_BREW_15_200',
      amount: 45000,
    });
    const wrongAppRes = await service.handleZalopayCallback({
      data: wrongAppData,
      mac: zp.signCallbackData(wrongAppData),
    });
    expect(wrongAppRes.return_code).toBe(-1);
    expect(resolutionCalls).toBe(0);

    // 3. Sai amount so với DB -> return_code = -1
    const wrongAmountData = JSON.stringify({
      app_id: 554,
      app_trans_id: '261104_BREW_15_200',
      amount: 10000,
    });
    const wrongAmountRes = await service.handleZalopayCallback({
      data: wrongAmountData,
      mac: zp.signCallbackData(wrongAmountData),
    });
    expect(wrongAmountRes.return_code).toBe(-1);
    expect(resolutionCalls).toBe(0);

    // 4. Đúng MAC và thông tin lần 1 -> return_code = 1
    const okRes = await service.handleZalopayCallback({
      data: rawData,
      mac: validMac,
    });
    expect(okRes.return_code).toBe(1);
    expect(resolutionCalls).toBe(1);

    // 5. Callback lặp lại lần 2 -> return_code = 2 (already processed)
    const dupRes = await service.handleZalopayCallback({
      data: rawData,
      mac: validMac,
    });
    expect(dupRes.return_code).toBe(2);
    expect(resolutionCalls).toBe(2);
  });

  it('preserves SUCCESS status if callback completes before create response returns', async () => {
    const store: PaymentOrdersStore = {
      markZalopayCreation: vi.fn(),
      claimZalopayAttempt: async () => ({
        mode: 'NEW',
        orderId: 20,
        paymentId: 300,
        amount: 50000,
        transactionRef: '261104_BREW_20_300',
        status: 'PENDING',
        cachedPaymentUrl: null,
      }),
      saveZalopayPaymentUrl: vi.fn(),
      applyZalopayResolution: vi.fn(),
      listPendingZalopayAttempts: async () => [],
      getOrderPaymentStatus: async () => ({
        orderId: 20,
        orderStatus: 'PAID',
        latestPayment: {
          paymentId: 300,
          provider: 'ZALOPAY',
          transactionRef: '261104_BREW_20_300',
          amount: 50000,
          status: 'SUCCESS',
          paidAt: new Date(),
        },
      }),
    };

    const zp = new ZalopayService();
    vi.spyOn(zp, 'createSandboxOrder').mockResolvedValue({
      paymentUrl: 'https://sb-openapi.zalopay.vn/pay/v2/race-condition-url',
      rawResponse: {
        return_code: 1,
        order_url: 'https://sb-openapi.zalopay.vn/pay/v2/race-condition-url',
      },
    });

    const service = new PaymentsService(store, zp);
    const res = await service.createZalopayPayment(1, 'idem-race-1', {
      orderId: 20,
    });

    expect(res.httpStatus).toBe(201);
    expect(res.body.status).toBe('SUCCESS');
  });

  it('throws 409 Conflict when same Idempotency-Key is reused with different orderId', async () => {
    const store: PaymentOrdersStore = {
      markZalopayCreation: vi.fn(),
      claimZalopayAttempt: async () => {
        throw new ConflictException(
          'Idempotency-Key already used with different request parameters',
        );
      },
      saveZalopayPaymentUrl: vi.fn(),
      applyZalopayResolution: vi.fn(),
      listPendingZalopayAttempts: async () => [],
      getOrderPaymentStatus: vi.fn(),
    };

    const service = new PaymentsService(store, new ZalopayService());
    await expect(
      service.createZalopayPayment(1, 'same-key', { orderId: 99 }),
    ).rejects.toThrow(ConflictException);
  });
});