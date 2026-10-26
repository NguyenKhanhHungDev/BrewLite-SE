import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ORDERS_STORE,
  type OrderDraft,
  type OrderLine,
  type OrdersStore,
  type Size,
  type Topping,
  type StoredOrderResult,
} from './orders.contract.js';
import { isOrderStatus } from './order-state.js';
import { calculateUnitPrice } from './orders.pricing.js';
import { applyPromotion } from '../promotions/promotions.service.js';

const MAX_POSTGRES_INT = 2_147_483_647;
type InputItem = {
  productId: number;
  quantity: number;
  size: Size;
  toppings: Topping[];
};
type ParsedOrderInput = { items: InputItem[]; promoCode?: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseOrderInput(body: unknown): ParsedOrderInput {
  if (
    !isObject(body) ||
    Object.keys(body).some((key) => !['items', 'promoCode'].includes(key))
  ) {
    throw new BadRequestException('Body chỉ được chứa items và promoCode');
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new BadRequestException('items phải là mảng không rỗng');
  }
  if (
    body.promoCode !== undefined &&
    (typeof body.promoCode !== 'string' || body.promoCode.length > 64)
  ) {
    throw new BadRequestException('promoCode phải là chuỗi không quá 64 ký tự');
  }

  const items = body.items.map((item: unknown) => {
    if (
      !isObject(item) ||
      Object.keys(item).some(
        (key) => !['productId', 'quantity', 'size', 'toppings'].includes(key),
      )
    ) {
      throw new BadRequestException('Order item không hợp lệ');
    }
    const { productId, quantity } = item;
    if (
      !Number.isSafeInteger(productId) ||
      Number(productId) <= 0 ||
      !Number.isSafeInteger(quantity) ||
      Number(quantity) <= 0
    ) {
      throw new BadRequestException(
        'productId và quantity phải là số nguyên dương',
      );
    }
    const sizeValue = item.size === undefined ? 'M' : item.size;
    if (sizeValue !== 'S' && sizeValue !== 'M' && sizeValue !== 'L') {
      throw new BadRequestException('size phải là S, M hoặc L');
    }
    const size: Size = sizeValue;
    const toppings = item.toppings === undefined ? [] : item.toppings;
    if (
      !Array.isArray(toppings) ||
      toppings.length > 2 ||
      toppings.some((t) => t !== 'PEARL' && t !== 'CREAM') ||
      new Set(toppings).size !== toppings.length
    ) {
      throw new BadRequestException('toppings không hợp lệ');
    }
    return {
      productId: Number(productId),
      quantity: Number(quantity),
      size,
      toppings: toppings as Topping[],
    };
  });

  return {
    items,
    ...(body.promoCode === undefined
      ? {}
      : { promoCode: body.promoCode as string }),
  };
}

function normalizeIdempotencyKey(key?: string): string | null {
  if (key === undefined) return null;
  const normalized = key.trim();
  if (!normalized || normalized.length > 200) {
    throw new BadRequestException('Idempotency-Key phải có từ 1 đến 200 ký tự');
  }
  return normalized;
}

function hashRequest(input: ParsedOrderInput): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        items: input.items,
        promoCode: input.promoCode?.trim().toUpperCase() ?? null,
      }),
    )
    .digest('hex');
}

function isUniqueConstraintError(error: unknown): boolean {
  return isObject(error) && error.code === 'P2002';
}

function replayResult(existing: StoredOrderResult, requestHash: string) {
  if (existing.idempotencyHash !== requestHash) {
    throw new ConflictException(
      'Idempotency-Key đã được sử dụng với nội dung khác',
    );
  }
  if (!isOrderStatus(existing.status)) {
    throw new ConflictException('Trạng thái đơn hàng đã lưu không hợp lệ');
  }
  return {
    orderId: existing.id,
    status: existing.status,
    total: existing.total,
  };
}

@Injectable()
export class OrdersService {
  constructor(@Inject(ORDERS_STORE) private readonly store: OrdersStore) {}

  async create(
    userId: number,
    requestBody: unknown,
    rawIdempotencyKey?: string,
  ) {
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new UnauthorizedException('Authenticated user is required');
    }

    const input = parseOrderInput(requestBody);
    const idempotencyKey = normalizeIdempotencyKey(rawIdempotencyKey);
    const idempotencyHash = idempotencyKey ? hashRequest(input) : null;

    if (idempotencyKey && idempotencyHash) {
      const existing = await this.store.findOrderByIdempotencyKey(
        userId,
        idempotencyKey,
      );
      if (existing) return replayResult(existing, idempotencyHash);
    }

    const lines: OrderLine[] = [];
    let subtotalTotal = 0;
    for (const item of input.items) {
      const product = await this.store.getProductById(item.productId);
      if (!product)
        throw new NotFoundException(
          `Không tìm thấy sản phẩm ${item.productId}`,
        );
      if (!Number.isSafeInteger(product.price) || product.price < 0) {
        throw new BadRequestException('Giá sản phẩm không hợp lệ');
      }
      if (!Number.isSafeInteger(product.stock) || product.stock < 0) {
        throw new BadRequestException('Tồn kho sản phẩm không hợp lệ');
      }
      if (item.quantity > product.stock) {
        throw new BadRequestException(
          `Không đủ tồn kho cho sản phẩm ${item.productId}`,
        );
      }

      const unitPrice = calculateUnitPrice(
        product.price,
        item.size,
        item.toppings,
      );
      if (unitPrice > MAX_POSTGRES_INT) {
        throw new BadRequestException('Đơn giá vượt giới hạn lưu trữ');
      }
      const subtotal = unitPrice * item.quantity;
      if (
        !Number.isSafeInteger(subtotal) ||
        subtotal > MAX_POSTGRES_INT ||
        !Number.isSafeInteger(subtotalTotal + subtotal) ||
        subtotalTotal + subtotal > MAX_POSTGRES_INT
      ) {
        throw new BadRequestException(
          'Tổng tiền đơn hàng vượt giới hạn lưu trữ',
        );
      }
      lines.push({
        productId: item.productId,
        quantity: item.quantity,
        size: item.size,
        toppings: item.toppings,
        unitPrice,
        subtotal,
      });
      subtotalTotal += subtotal;
    }

    const promotion = applyPromotion(subtotalTotal, input.promoCode);
    if (promotion.payable <= 0) {
      throw new BadRequestException('Tổng tiền sau giảm giá phải lớn hơn 0');
    }

    const draft: OrderDraft = {
      userId,
      status: 'PENDING',
      total: promotion.payable,
      discount: promotion.discount,
      promoCode: promotion.promoCode,
      idempotencyKey,
      idempotencyHash,
      items: lines,
    };

    try {
      const saved = await this.store.saveOrder(draft);
      if (!isOrderStatus(saved.status))
        throw new ConflictException('Trạng thái đơn hàng đã lưu không hợp lệ');
      return { orderId: saved.id, status: saved.status, total: saved.total };
    } catch (error: unknown) {
      // Handle concurrent retries where both requests passed the initial lookup.
      if (idempotencyKey && idempotencyHash && isUniqueConstraintError(error)) {
        const existing = await this.store.findOrderByIdempotencyKey(
          userId,
          idempotencyKey,
        );
        if (existing) return replayResult(existing, idempotencyHash);
      }
      throw error;
    }
  }
}
