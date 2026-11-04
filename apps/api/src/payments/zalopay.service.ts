import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export interface ZalopayConfig {
  appId: number;
  key1: string;
  key2: string;
  apiBaseUrl: string;
  callbackUrl: string;
  returnUrl: string;
}

export interface ZalopayCreateOrderParams {
  appTransId: string;
  appUser: string;
  amount: number;
  appTime?: number;
  orderId: number;
  description: string;
}

export interface ZalopayCreateGatewayResponse {
  return_code: number;
  return_message?: string;
  sub_return_code?: number;
  sub_return_message?: string;
  order_url?: string;
  zp_trans_token?: string;
  order_token?: string;
  qr_code?: string;
}

export interface ZalopayQueryGatewayResponse {
  return_code: number;
  return_message?: string;
  sub_return_code?: number;
  sub_return_message?: string;
  is_processing?: boolean;
  amount?: number;
  zp_trans_id?: number | string;
}

const INVALID_PLACEHOLDERS = new Set([
  '',
  'APP_ID_SANDBOX',
  'SANDBOX_KEY_PLACEHOLDER',
  'YOUR_SECRET_KEY',
]);

export class ZalopayCreationRejected extends ServiceUnavailableException {
  constructor(message: string) {
    super(message);
  }
}

@Injectable()
export class ZalopayService {
  private readonly httpTimeoutMs = 8000;

  getValidatedConfig(): ZalopayConfig {
    const rawAppId = (process.env.ZALOPAY_APP_ID ?? '').trim();
    const key1 = (process.env.ZALOPAY_KEY1 ?? '').trim();
    const key2 = (process.env.ZALOPAY_KEY2 ?? '').trim();
    const apiBaseUrl = (
      process.env.ZALOPAY_API_BASE_URL ?? 'https://sb-openapi.zalopay.vn'
    )
      .trim()
      .replace(/\/+$/, '');
    const callbackUrl = (process.env.ZALOPAY_CALLBACK_URL ?? '').trim();
    const returnUrl = (
      process.env.ZALOPAY_RETURN_URL ?? 'http://localhost:3000/payment/result'
    ).trim();

    const appId = Number(rawAppId);
    if (
      INVALID_PLACEHOLDERS.has(rawAppId) ||
      !Number.isInteger(appId) ||
      appId <= 0 ||
      INVALID_PLACEHOLDERS.has(key1) ||
      INVALID_PLACEHOLDERS.has(key2) ||
      !apiBaseUrl
    ) {
      throw new ServiceUnavailableException(
        'ZaloPay Sandbox configuration is missing or using placeholder values (503 Service Unavailable)',
      );
    }

    return {
      appId,
      key1,
      key2,
      apiBaseUrl,
      callbackUrl,
      returnUrl,
    };
  }

  buildAppTransId(
    _orderId: number,
    _paymentId: number,
    now: Date = new Date(),
  ): string {
    const vnTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const yy = String(vnTime.getUTCFullYear()).slice(-2);
    const mm = String(vnTime.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(vnTime.getUTCDate()).padStart(2, '0');
    return `${yy}${mm}${dd}_BREW_${randomBytes(12).toString('hex')}`;
  }

  signCreateOrderPayload(
    input: {
      appId: number;
      appTransId: string;
      appUser: string;
      amount: number;
      appTime: number;
      embedData: string;
      item: string;
    },
    key1: string,
  ): string {
    const rawData = [
      input.appId,
      input.appTransId,
      input.appUser,
      input.amount,
      input.appTime,
      input.embedData,
      input.item,
    ].join('|');

    return createHmac('sha256', key1).update(rawData, 'utf8').digest('hex');
  }

  signQueryOrderPayload(
    appId: number,
    appTransId: string,
    key1: string,
  ): string {
    const rawData = `${appId}|${appTransId}|${key1}`;
    return createHmac('sha256', key1).update(rawData, 'utf8').digest('hex');
  }

  signCallbackData(rawDataString: string, key2Override?: string): string {
    const secretKey2 = key2Override ?? this.getValidatedConfig().key2;
    return createHmac('sha256', secretKey2)
      .update(rawDataString, 'utf8')
      .digest('hex');
  }

  verifyCallbackSignature(
    rawDataString: string,
    receivedMac: string,
    key2Override?: string,
  ): boolean {
    if (
      typeof rawDataString !== 'string' ||
      !rawDataString ||
      typeof receivedMac !== 'string' ||
      !receivedMac
    ) {
      return false;
    }

    const expectedMac = this.signCallbackData(rawDataString, key2Override);
    const expectedBuf = Buffer.from(expectedMac, 'utf8');
    const receivedBuf = Buffer.from(receivedMac.trim().toLowerCase(), 'utf8');

    if (expectedBuf.length !== receivedBuf.length) {
      return false;
    }
    return timingSafeEqual(expectedBuf, receivedBuf);
  }

  async createSandboxOrder(
    params: ZalopayCreateOrderParams,
  ): Promise<{
    paymentUrl: string;
    rawResponse: ZalopayCreateGatewayResponse;
  }> {
    const config = this.getValidatedConfig();
    const appTime = params.appTime ?? Date.now();

    const redirectUrl = `${config.returnUrl}${
      config.returnUrl.includes('?') ? '&' : '?'
    }orderId=${params.orderId}`;

    const embedData = JSON.stringify({
      redirecturl: redirectUrl,
      orderId: params.orderId,
    });
    const item = JSON.stringify([]);

    const mac = this.signCreateOrderPayload(
      {
        appId: config.appId,
        appTransId: params.appTransId,
        appUser: params.appUser,
        amount: params.amount,
        appTime,
        embedData,
        item,
      },
      config.key1,
    );

    const formBody = new URLSearchParams({
      app_id: String(config.appId),
      app_user: params.appUser,
      app_trans_id: params.appTransId,
      app_time: String(appTime),
      amount: String(params.amount),
      item,
      embed_data: embedData,
      description: params.description,
      bank_code: '',
      mac,
    });

    if (
      config.callbackUrl &&
      !config.callbackUrl.includes('YOUR_TEST_CALLBACK')
    ) {
      formBody.set('callback_url', config.callbackUrl);
    }

    let response: Response;
    try {
      response = await fetch(`${config.apiBaseUrl}/v2/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formBody.toString(),
        signal: AbortSignal.timeout(this.httpTimeoutMs),
      });
    } catch {
      throw new ServiceUnavailableException(
        'ZaloPay Sandbox gateway timeout or network error',
      );
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `ZaloPay Sandbox HTTP error ${response.status}`,
      );
    }

    let data: ZalopayCreateGatewayResponse;
    try {
      data = (await response.json()) as ZalopayCreateGatewayResponse;
    } catch {
      throw new ServiceUnavailableException(
        'Invalid JSON response from ZaloPay Sandbox',
      );
    }

    if (data.return_code === 2) {
      throw new ZalopayCreationRejected(
        `ZaloPay rejected order creation (${data.return_code}): ${
          data.sub_return_message || data.return_message || 'Unknown error'
        }`,
      );
    }

    if (
      data.return_code !== 1 ||
      typeof data.order_url !== 'string' ||
      !data.order_url
    ) {
      throw new ServiceUnavailableException('Unknown ZaloPay creation result');
    }
    return {
      paymentUrl: data.order_url,
      rawResponse: data,
    };
  }

  async querySandboxOrder(
    appTransId: string,
  ): Promise<ZalopayQueryGatewayResponse> {
    const config = this.getValidatedConfig();
    const mac = this.signQueryOrderPayload(
      config.appId,
      appTransId,
      config.key1,
    );

    const formBody = new URLSearchParams({
      app_id: String(config.appId),
      app_trans_id: appTransId,
      mac,
    });

    let response: Response;
    try {
      response = await fetch(`${config.apiBaseUrl}/v2/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formBody.toString(),
        signal: AbortSignal.timeout(this.httpTimeoutMs),
      });
    } catch {
      throw new ServiceUnavailableException(
        'ZaloPay Sandbox query timeout or network error',
      );
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `ZaloPay query HTTP status ${response.status}`,
      );
    }

    try {
      return (await response.json()) as ZalopayQueryGatewayResponse;
    } catch {
      throw new ServiceUnavailableException(
        'Invalid JSON response from ZaloPay query',
      );
    }
  }
}
