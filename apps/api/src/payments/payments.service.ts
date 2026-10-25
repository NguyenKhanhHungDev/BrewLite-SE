import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
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
  if (keys.length !== 3 || keys.some(
    (key) => !['orderId', 'method', 'simulateResult'].includes(key),
  )) {
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

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(PAYMENT_ORDERS_STORE)
    private readonly ordersStore: PaymentOrdersStore,
  ) {}

  async pay(requestBody: unknown) {
    const dto = parsePayment(requestBody);
    const order = await this.ordersStore.findOrderById(dto.orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'PENDING') {
      throw new BadRequestException('Only PENDING orders can be paid');
    }

    const nextStatus = dto.simulateResult === 'SUCCESS'
      ? 'PAID' as const
      : 'PAYMENT_FAILED' as const;
    await this.ordersStore.updateOrderStatus(order.id, nextStatus);

    return { orderId: order.id, status: nextStatus };
  }
}