import { createHash } from 'node:crypto';
import {
  ZalopayReconciliation,
  type ZalopayAttempt,
} from './zalopay-reconciliation.js';
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
  type ZalopayCallbackResponse,
} from './payments.contract.js';
import { ZalopayCreationRejected, ZalopayService } from './zalopay.service.js';

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

@Injectable()
export class PaymentsService {
  private readonly zalopay: ZalopayService;
  private readonly reconciliation: ZalopayReconciliation;

  constructor(
    @Inject(PAYMENT_ORDERS_STORE)
    private readonly ordersStore: PaymentOrdersStore,
    @Optional() zalopayService?: ZalopayService,
  ) {
    this.zalopay = zalopayService ?? new ZalopayService();
    this.reconciliation = new ZalopayReconciliation(
      this.ordersStore,
      this.zalopay,
    );
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

    if (claimed.mode === 'REPLAY') {
      throw new ConflictException(
        'Payment creation is in progress or its outcome is unknown; check payment status before retrying',
      );
    }

    // Gọi HTTP ra ZaloPay Sandbox bên ngoài Prisma transaction
    let gatewayRes: Awaited<ReturnType<ZalopayService['createSandboxOrder']>>;
    try {
      gatewayRes = await this.zalopay.createSandboxOrder({
        appTime: claimed.createdAt?.getTime(),
        appTransId: claimed.transactionRef,
        appUser: `user_${normalizedUserId}`,
        amount: claimed.amount,
        orderId: claimed.orderId,
        description: `Thanh toan don hang BrewLite #${claimed.orderId}`,
      });
    } catch (error) {
      await this.ordersStore.markZalopayCreation(
        claimed.paymentId,
        claimed.transactionRef,
        error instanceof ZalopayCreationRejected ? 'REJECTED' : 'UNKNOWN',
      );
      throw error;
    }

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
      httpStatus: 201,
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
      const decoded: unknown = JSON.parse(rawData);
      if (!isObject(decoded))
        return { return_code: -1, return_message: 'invalid callback data' };
      parsed = decoded;
    } catch {
      return { return_code: -1, return_message: 'invalid json data' };
    }

    const config = this.zalopay.getValidatedConfig();
    const receivedAppId = Number(parsed.app_id);
    const transactionRef =
      typeof parsed.app_trans_id === 'string' ? parsed.app_trans_id.trim() : '';
    const amountVnd = Number(parsed.amount);
    const providerTransactionId =
      typeof parsed.zp_trans_id === 'string' ||
      typeof parsed.zp_trans_id === 'number'
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

  // Preserve the existing public API; query/settlement orchestration lives separately.
  async getOrderPaymentStatus(userId: unknown, rawOrderId: unknown) {
    return this.reconciliation.getOrderPaymentStatus(userId, rawOrderId);
  }
  async reconcilePendingZalopayBatch(limit = 50): Promise<number> {
    return this.reconciliation.reconcilePendingZalopayBatch(limit);
  }
  async recheckAdminAttempt(attempt: ZalopayAttempt) {
    return this.reconciliation.recheckAdminAttempt(attempt);
  }
}
