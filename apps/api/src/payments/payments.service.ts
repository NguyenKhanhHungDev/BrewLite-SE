import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import {
  PAYMENT_ORDERS_STORE,
  type PaymentOrdersStore,
  type PaymentRequest,
  type VnpayIpnResponse,
} from './payments.contract.js';
import { VnpayService } from './vnpay.service.js';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePayment(body: unknown): PaymentRequest {
  if (!isObject(body)) {
    throw new BadRequestException('Invalid payment body');
  }
  const keys = Object.keys(body);
  if (
    keys.length !== 3 ||
    keys.some((key) => !['orderId', 'method', 'simulateResult'].includes(key))
  ) {
    throw new BadRequestException('Expected orderId, method, simulateResult');
  }
  if (!Number.isSafeInteger(body.orderId) || Number(body.orderId) <= 0) {
    throw new BadRequestException('orderId must be a positive integer');
  }
  if (body.method !== 'WALLET' && body.method !== 'CARD') {
    throw new BadRequestException('method must be WALLET or CARD');
  }
  if (body.simulateResult !== 'SUCCESS' && body.simulateResult !== 'FAILURE') {
    throw new BadRequestException('simulateResult must be SUCCESS or FAILURE');
  }
  return {
    orderId: Number(body.orderId),
    method: body.method,
    simulateResult: body.simulateResult,
  };
}

function parseCreateVnpayBody(body: unknown): { orderId: number } {
  if (!isObject(body)) {
    throw new BadRequestException('Invalid request body');
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
  private readonly vnpay: VnpayService;

  constructor(
    @Inject(PAYMENT_ORDERS_STORE)
    private readonly ordersStore: PaymentOrdersStore,
    @Optional() vnpayService?: VnpayService,
  ) {
    this.vnpay = vnpayService ?? new VnpayService();
  }

  async pay(userId: unknown, idempotencyKey: unknown, requestBody: unknown) {
    if (!Number.isSafeInteger(userId) || Number(userId) <= 0) {
      throw new UnauthorizedException('JWT required');
    }
    const key = parseIdempotencyKey(idempotencyKey);
    const request = parsePayment(requestBody);
    const requestHash = hashPaymentRequest(request);

    return this.ordersStore.payOnce({
      userId: Number(userId),
      idempotencyKey: key,
      requestHash,
      request,
    });
  }

  async createVnpayPayment(
    userId: unknown,
    requestBody: unknown,
    clientIp = '127.0.0.1',
  ) {
    if (!Number.isSafeInteger(userId) || Number(userId) <= 0) {
      throw new UnauthorizedException('JWT required');
    }
    if (!this.ordersStore.createVnpayPayment) {
      throw new BadRequestException('VNPAY store not supported');
    }

    const { orderId } = parseCreateVnpayBody(requestBody);
    const transactionRef = `BREW_${orderId}_${Date.now()}_${randomBytes(3).toString('hex').toUpperCase()}`;

    const record = await this.ordersStore.createVnpayPayment({
      userId: Number(userId),
      orderId,
      transactionRef,
    });

    const paymentUrl = this.vnpay.createPaymentUrl({
      transactionRef: record.transactionRef,
      amountVnd: record.amount,
      orderInfo: `Thanh toan don hang BrewLite #${record.orderId}`,
      ipAddr: clientIp,
    });

    return {
      orderId: record.orderId,
      paymentId: record.paymentId,
      paymentUrl,
    };
  }

  async handleVnpayIpn(
    query: Record<string, unknown>,
  ): Promise<VnpayIpnResponse> {
    if (!this.ordersStore.processVnpayIpn) {
      return { RspCode: '99', Message: 'Unknown error' };
    }

    const isValidSignature = this.vnpay.verifyIpnSignature(query);
    if (!isValidSignature) {
      return { RspCode: '97', Message: 'Invalid Checksum' };
    }

    const transactionRef =
      typeof query.vnp_TxnRef === 'string' ? query.vnp_TxnRef.trim() : '';
    const rawAmount = Number(query.vnp_Amount);
    const responseCode =
      typeof query.vnp_ResponseCode === 'string'
        ? query.vnp_ResponseCode.trim()
        : '';
    const transactionStatus =
      typeof query.vnp_TransactionStatus === 'string'
        ? query.vnp_TransactionStatus.trim()
        : '';
    const providerTransactionId =
      typeof query.vnp_TransactionNo === 'string'
        ? query.vnp_TransactionNo.trim()
        : undefined;

    if (!transactionRef || !Number.isFinite(rawAmount) || rawAmount <= 0) {
      return { RspCode: '99', Message: 'Invalid parameters' };
    }

    // Quy đổi ngược từ đơn vị VNPAY (VND * 100) về VND
    const amountVnd = Math.round(rawAmount / 100);

    return this.ordersStore.processVnpayIpn({
      transactionRef,
      amountVnd,
      responseCode,
      transactionStatus,
      providerTransactionId,
    });
  }

  async getOrderPaymentStatus(userId: unknown, rawOrderId: unknown) {
    if (!Number.isSafeInteger(userId) || Number(userId) <= 0) {
      throw new UnauthorizedException('JWT required');
    }
    const orderId = Number(rawOrderId);
    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      throw new BadRequestException('orderId must be a positive integer');
    }
    if (!this.ordersStore.getOrderPaymentStatus) {
      throw new BadRequestException('Status query not supported');
    }

    return this.ordersStore.getOrderPaymentStatus(Number(userId), orderId);
  }
}