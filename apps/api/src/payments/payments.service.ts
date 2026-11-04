import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  GoneException,
  Inject,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import {
  PAYMENT_ORDERS_STORE,
  type PaymentOrdersStore,
  type PaymentRequest,
  type ZalopayCallbackResponse,
} from './payments.contract.js';
import { ZalopayService } from './zalopay.service.js';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseCreateZalopayBody(body: unknown): { orderId: number } {
  if (!isObject(body)) {
    throw new BadRequestException('Invalid request body');
  }
  if ('amount' in body || 'total' in body) {
    throw new BadRequestException(
      'Client is not allowed to specify payment amount',
    );
  }
  const keys = Object.keys(body);
  if (keys.length !== 1 || keys[0] !== 'orderId') {
    throw new BadRequestException('Body must only contain orderId');
  }
  if (!Number.isSafeInteger(body.orderId) || Number(body.orderId) <= 0) {
    throw new BadRequestException('orderId must be a positive integer');
  }
  return { orderId: Number(body.orderId) };
}

function parseIdempotencyKey(rawKey: unknown): string {
  if (typeof rawKey !== 'string') {
    throw new BadRequestException('Idempotency-Key header is required');
  }
  const trimmed = rawKey.trim();
  if (trimmed.length < 1 || trimmed.length > 200) {
    throw new BadRequestException(
      'Idempotency-Key must be between 1 and 200 characters',
    );
  }
  return trimmed;
}

export function hashZalopayCreateRequest(
  userId: number,
  orderId: number,
): string {
  const canonical = JSON.stringify({
    provider: 'ZALOPAY',
    userId,
    orderId,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

export function hashPaymentRequest(dto: PaymentRequest): string {
  const canonical = JSON.stringify({
    orderId: dto.orderId,
    method: dto.method,
    simulateResult: dto.simulateResult,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

@Injectable()
export class PaymentsService {
  private readonly zalopay: ZalopayService;
  private readonly inFlightQueries = new Set<string>();

  constructor(
    @Inject(PAYMENT_ORDERS_STORE)
    private readonly ordersStore: PaymentOrdersStore,
    @Optional() zalopayService?: ZalopayService,
  ) {
    this.zalopay = zalopayService ?? new ZalopayService();
  }

  rejectDeprecatedPaymentEndpoint(endpointName = 'Legacy payment'): never {
    throw new GoneException(
      `${endpointName} endpoint has been deprecated and disabled (410 Gone). Please use POST /payments/zalopay/create.`,
    );
  }

  async pay(
    _userId: unknown,
    _idempotencyKey: unknown,
    _requestBody: unknown,
  ): Promise<never> {
    return this.rejectDeprecatedPaymentEndpoint('POST /payments (mock)');
  }

  async createZalopayPayment(
    userId: unknown,
    idempotencyKeyRaw: unknown,
    requestBody: unknown,
  ): Promise<{
    httpStatus: 200 | 201;
    body: {
      orderId: number;
      paymentId: number;
      provider: 'ZALOPAY';
      transactionRef: string;
      amount: number;
      status: string;
      paymentUrl: string;
    };
  }> {
    if (!Number.isSafeInteger(userId) || Number(userId) <= 0) {
      throw new UnauthorizedException('JWT required');
    }

    const normalizedUserId = Number(userId);
    const idempotencyKey = parseIdempotencyKey(idempotencyKeyRaw);
    const { orderId } = parseCreateZalopayBody(requestBody);

    // Kiểm tra cấu hình ZaloPay trước khi mở DB transaction (trả 503 nếu chưa cấu hình)
    this.zalopay.getValidatedConfig();

    const requestHash = hashZalopayCreateRequest(normalizedUserId, orderId);

    const claimed = await this.ordersStore.claimZalopayAttempt({
      userId: normalizedUserId,
      orderId,
      idempotencyKey,
      requestHash,
    });

    if (claimed.mode === 'REPLAY' && claimed.cachedPaymentUrl) {
      return {
        httpStatus: 200,
        body: {
          orderId: claimed.orderId,
          paymentId: claimed.paymentId,
          provider: 'ZALOPAY',
          transactionRef: claimed.transactionRef,
          amount: claimed.amount,
          status: claimed.status,
          paymentUrl: claimed.cachedPaymentUrl,
        },
      };
    }

    if (claimed.mode === 'REPLAY' && claimed.status !== 'PENDING') {
      throw new ConflictException(
        `Payment attempt #${claimed.paymentId} is already in terminal status ${claimed.status}`,
      );
    }

    // Gọi HTTP ra ZaloPay Sandbox bên ngoài Prisma transaction
    const gatewayRes = await this.zalopay.createSandboxOrder({
      appTransId: claimed.transactionRef,
      appUser: `user_${normalizedUserId}`,
      amount: claimed.amount,
      orderId: claimed.orderId,
      description: `Thanh toan don hang BrewLite #${claimed.orderId}`,
    });

    await this.ordersStore.saveZalopayPaymentUrl({
      paymentId: claimed.paymentId,
      transactionRef: claimed.transactionRef,
      paymentUrl: gatewayRes.paymentUrl,
    });

    // Đọc lại trạng thái phòng trường hợp callback đến trước khi response create hoàn tất
    let latestStatus = claimed.status;
    const latestView = await this.ordersStore.getOrderPaymentStatus(
      normalizedUserId,
      claimed.orderId,
    );
    if (
      latestView.latestPayment &&
      latestView.latestPayment.paymentId === claimed.paymentId
    ) {
      latestStatus = latestView.latestPayment.status;
    }

    return {
      httpStatus: claimed.mode === 'REPLAY' ? 200 : 201,
      body: {
        orderId: claimed.orderId,
        paymentId: claimed.paymentId,
        provider: 'ZALOPAY',
        transactionRef: claimed.transactionRef,
        amount: claimed.amount,
        status: latestStatus,
        paymentUrl: gatewayRes.paymentUrl,
      },
    };
  }

  async handleZalopayCallback(body: unknown): Promise<ZalopayCallbackResponse> {
    if (!isObject(body)) {
      return { return_code: -1, return_message: 'invalid callback payload' };
    }

    const rawData = typeof body.data === 'string' ? body.data : '';
    const mac = typeof body.mac === 'string' ? body.mac : '';

    if (!rawData || !mac) {
      return { return_code: -1, return_message: 'missing data or mac' };
    }

    let isValidMac = false;
    try {
      // Kiểm tra chữ ký trên chuỗi rawData nguyên gốc
      isValidMac = this.zalopay.verifyCallbackSignature(rawData, mac);
    } catch {
      return {
        return_code: 0,
        return_message: 'gateway config unavailable',
      };
    }

    if (!isValidMac) {
      return { return_code: -1, return_message: 'mac not equal' };
    }

    let parsed: {
      app_id?: unknown;
      app_trans_id?: unknown;
      amount?: unknown;
      zp_trans_id?: unknown;
    };
    try {
      parsed = JSON.parse(rawData);
    } catch {
      return { return_code: -1, return_message: 'invalid json data' };
    }

    const config = this.zalopay.getValidatedConfig();
    const receivedAppId = Number(parsed.app_id);
    const transactionRef =
      typeof parsed.app_trans_id === 'string' ? parsed.app_trans_id.trim() : '';
    const amountVnd = Number(parsed.amount);
    const providerTransactionId =
      parsed.zp_trans_id !== undefined && parsed.zp_trans_id !== null
        ? String(parsed.zp_trans_id)
        : null;

    if (
      !transactionRef ||
      !Number.isFinite(amountVnd) ||
      amountVnd <= 0 ||
      receivedAppId !== config.appId
    ) {
      return {
        return_code: -1,
        return_message: 'invalid app_id, app_trans_id, or amount',
      };
    }

    try {
      const resolution = await this.ordersStore.applyZalopayResolution({
        transactionRef,
        appId: receivedAppId,
        amountVnd,
        providerTransactionId,
        outcome: 'SUCCESS',
      });

      if (resolution.duplicate) {
        return {
          return_code: 2,
          return_message: 'transaction already processed',
        };
      }

      return { return_code: 1, return_message: 'success' };
    } catch (error: any) {
      if (
        error instanceof BadRequestException ||
        error?.status === 400 ||
        error?.status === 404
      ) {
        return {
          return_code: -1,
          return_message: error?.message ?? 'validation failed',
        };
      }
      return {
        return_code: 0,
        return_message: 'internal processing error',
      };
    }
  }

  async getOrderPaymentStatus(userId: unknown, rawOrderId: unknown) {
    if (!Number.isSafeInteger(userId) || Number(userId) <= 0) {
      throw new UnauthorizedException('JWT required');
    }
    const orderId = Number(rawOrderId);
    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      throw new BadRequestException('orderId must be a positive integer');
    }

    const normalizedUserId = Number(userId);
    const currentStatus = await this.ordersStore.getOrderPaymentStatus(
      normalizedUserId,
      orderId,
    );

    const latest = currentStatus.latestPayment;
    if (
      latest &&
      latest.provider === 'ZALOPAY' &&
      latest.status === 'PENDING' &&
      latest.transactionRef &&
      !this.inFlightQueries.has(latest.transactionRef)
    ) {
      const updated = await this.queryAndReconcileSingleAttempt(
        latest.transactionRef,
        latest.amount,
      );
      if (updated) {
        return this.ordersStore.getOrderPaymentStatus(
          normalizedUserId,
          orderId,
        );
      }
    }

    return currentStatus;
  }

  async reconcilePendingZalopayBatch(limit = 10): Promise<number> {
    const pendingList =
      await this.ordersStore.listPendingZalopayAttempts(limit);
    let resolvedCount = 0;

    for (const item of pendingList) {
      if (this.inFlightQueries.has(item.transactionRef)) continue;
      const resolved = await this.queryAndReconcileSingleAttempt(
        item.transactionRef,
        item.amount,
      );
      if (resolved) resolvedCount += 1;
    }

    return resolvedCount;
  }

  private async queryAndReconcileSingleAttempt(
    transactionRef: string,
    expectedAmount: number,
  ): Promise<boolean> {
    this.inFlightQueries.add(transactionRef);
    try {
      const config = this.zalopay.getValidatedConfig();
      const queryRes = await this.zalopay.querySandboxOrder(transactionRef);

      // return_code = 1: Giao dịch thành công
      if (queryRes.return_code === 1) {
        await this.ordersStore.applyZalopayResolution({
          transactionRef,
          appId: config.appId,
          amountVnd: queryRes.amount ?? expectedAmount,
          providerTransactionId: queryRes.zp_trans_id
            ? String(queryRes.zp_trans_id)
            : null,
          outcome: 'SUCCESS',
        });
        return true;
      }

      // return_code = 2 và không còn is_processing: Giao dịch thất bại cuối
      if (queryRes.return_code === 2 && !queryRes.is_processing) {
        await this.ordersStore.applyZalopayResolution({
          transactionRef,
          appId: config.appId,
          amountVnd: expectedAmount,
          providerTransactionId: null,
          outcome: 'FAILED',
        });
        return true;
      }

      // return_code = 3 (đang xử lý / chưa tìm được): giữ nguyên PENDING, không tự đánh FAILED
      return false;
    } catch {
      return false;
    } finally {
      this.inFlightQueries.delete(transactionRef);
    }
  }
}