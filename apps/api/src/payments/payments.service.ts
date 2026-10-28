import { createHash } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  PAYMENT_ORDERS_STORE,
  type PaymentOrdersStore,
  type PaymentRequest,
} from './payments.contract.js';

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
  constructor(
    @Inject(PAYMENT_ORDERS_STORE)
    private readonly ordersStore: PaymentOrdersStore,
  ) {}

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
}