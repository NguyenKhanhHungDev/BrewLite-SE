import { ServiceUnavailableException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import { ZalopayService } from './zalopay.service.js';

describe('ZalopayService — Bước 4: Chữ ký HMAC-SHA256 & Cấu hình (APP_ID=554)', () => {
  let zalopayService: ZalopayService;

  beforeEach(() => {
    process.env.ZALOPAY_APP_ID = '554';
    process.env.ZALOPAY_KEY1 = '8NdU5pG5R2spGHGhyO99HN1OhD8IQJBn';
    process.env.ZALOPAY_KEY2 = 'uUfsWgfLkRLzq6W2uNXTCxrfxs51auny';
    process.env.ZALOPAY_API_BASE_URL = 'https://sb-openapi.zalopay.vn';
    process.env.ZALOPAY_CALLBACK_URL =
      'https://demo.trycloudflare.com/payments/zalopay/callback';
    process.env.ZALOPAY_RETURN_URL = 'http://localhost:3000/payment/result';

    zalopayService = new ZalopayService();
  });

  it('1. Khớp tuyệt đối test vector cố định cho signCreateOrderPayload (Key1) và verifyCallbackSignature (Key2)', () => {
    const mac = zalopayService.signCreateOrderPayload(
      {
        appId: 554,
        appTransId: '261103_BREW_15_1',
        appUser: 'user_10',
        amount: 70000,
        appTime: 1700000000000,
        embedData:
          '{"redirecturl":"http://localhost:3000/payment/result?orderId=15","orderId":15}',
        item: '[]',
      },
      '8NdU5pG5R2spGHGhyO99HN1OhD8IQJBn',
    );

    expect(mac).toBe(
      'efa63a8fe67a4c13d65e6c450039183c1a94ff7353578d2bf68fb3956e71120b',
    );

    const rawCallbackData =
      '{"app_id":554,"app_trans_id":"261103_BREW_15_1","amount":70000,"zp_trans_id":998877}';
    const expectedCallbackMac = zalopayService.signCallbackData(
      rawCallbackData,
      'uUfsWgfLkRLzq6W2uNXTCxrfxs51auny',
    );

    expect(
      zalopayService.verifyCallbackSignature(
        rawCallbackData,
        expectedCallbackMac,
      ),
    ).toBe(true);

    expect(
      zalopayService.verifyCallbackSignature(
        rawCallbackData,
        '0000000000000000000000000000000000000000000000000000000000000000',
      ),
    ).toBe(false);
  });

  it('2. Trả lỗi 503 có kiểm soát khi thiếu cấu hình hoặc còn giữ placeholder', () => {
    process.env.ZALOPAY_KEY1 = 'SANDBOX_KEY_PLACEHOLDER';
    expect(() => zalopayService.getValidatedConfig()).toThrow(
      ServiceUnavailableException,
    );
  });
});
