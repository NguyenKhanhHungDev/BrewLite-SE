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
  type IngredientSnapshot,
  type RecipeSnapshot,
} from './orders.contract.js';
import {
  assertIngredientAvailability,
  calculateIngredientNeeds,
} from './orders.ingredients.js';
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
type ParsedOrderInput = {
  items: InputItem[];
  promoCode?: string;
  recipientName: string;
  recipientPhone: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseOrderInput(body: unknown): ParsedOrderInput {
  if (
    !isObject(body) ||
    Object.keys(body).some(
      (key) => !['items', 'promoCode', 'recipientName', 'recipientPhone'].includes(key),
    )
  ) {
    throw new BadRequestException(
      'Body chỉ được chứa items, promoCode, recipientName và recipientPhone',
    );
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

  if (typeof body.recipientName !== 'string') {
    throw new BadRequestException('recipientName là bắt buộc');
  }
  const recipientName = body.recipientName.trim();
  if (recipientName.length < 2 || recipientName.length > 100) {
    throw new BadRequestException('recipientName phải có từ 2 đến 100 ký tự');
  }
  if (typeof body.recipientPhone !== 'string') {
    throw new BadRequestException('recipientPhone là bắt buộc');
  }
  const recipientPhone = body.recipientPhone.trim().replace(/[\s().-]/g, '');
  if (!/^\+?\d{8,15}$/.test(recipientPhone)) {
    throw new BadRequestException(
      'recipientPhone phải có từ 8 đến 15 chữ số, có thể bắt đầu bằng +',
    );
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
    recipientName,
    recipientPhone,
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
        recipientName: input.recipientName,
        recipientPhone: input.recipientPhone,
      }),
    )
    .digest('hex');
}

// Drafts saved by the previous frontend/API version did not include recipient
// details in their idempotency hash. Support one safe upgrade for those rows:
// only when the stored snapshot is empty, and atomically replace the old hash.
function hashLegacyRequest(input: ParsedOrderInput): string {
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
      if (existing) {
        if (existing.idempotencyHash === idempotencyHash) {
          return replayResult(existing, idempotencyHash);
        }
        const legacyHash = hashLegacyRequest(input);
        if (
          existing.idempotencyHash === legacyHash &&
          existing.recipientName == null &&
          existing.recipientPhone == null
        ) {
          const upgraded = await this.store.updateLegacyRecipientSnapshot(
            userId,
            idempotencyKey,
            legacyHash,
            idempotencyHash,
            input.recipientName,
            input.recipientPhone,
          );
          if (upgraded) {
            return replayResult(
              { ...existing, idempotencyHash },
              idempotencyHash,
            );
          }
          // A concurrent retry may have completed the one-time upgrade first.
          const latest = await this.store.findOrderByIdempotencyKey(
            userId,
            idempotencyKey,
          );
          if (latest) return replayResult(latest, idempotencyHash);
        }
        return replayResult(existing, idempotencyHash);
      }
    }

    const recipeById = new Map<number, RecipeSnapshot>();
    for (const item of input.items) {
      if (!recipeById.has(item.productId)) {
        const recipe = await this.store.getRecipeById(item.productId);
        if (!recipe) {
          throw new NotFoundException(`Không tìm thấy món ${item.productId}`);
        }
        recipeById.set(item.productId, recipe);
      }
    }

    const toppingIngredients = await this.store.getToppingIngredients();
    const needInputs = input.items.map((item) => ({
      recipe: recipeById.get(item.productId)!,
      quantity: item.quantity,
      size: item.size,
      toppings: item.toppings,
    }));
    const ingredientNeeds = calculateIngredientNeeds(needInputs, toppingIngredients);

    const ingredientById = new Map<number, IngredientSnapshot>();
    for (const recipe of recipeById.values()) {
      for (const line of recipe.ingredients) {
        ingredientById.set(line.ingredientId, line.ingredient);
      }
    }
    if (toppingIngredients.pearl) {
      ingredientById.set(toppingIngredients.pearl.id, toppingIngredients.pearl);
    }
    if (toppingIngredients.cream) {
      ingredientById.set(toppingIngredients.cream.id, toppingIngredients.cream);
    }
    assertIngredientAvailability(ingredientNeeds, ingredientById);

    const lines: OrderLine[] = [];
    let subtotalTotal = 0;
    for (const item of input.items) {
      const recipe = recipeById.get(item.productId)!;
      if (!Number.isSafeInteger(recipe.price) || recipe.price < 0) {
        throw new BadRequestException('Giá món không hợp lệ');
      }

      const unitPrice = calculateUnitPrice(
        recipe.price,
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
        recipeName: recipe.name,
        basePrice: recipe.price,
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
      recipientName: input.recipientName,
      recipientPhone: input.recipientPhone,
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

  async findOne(orderId: number, userId: number, isAdmin = false) {
    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      throw new BadRequestException('orderId phải là số nguyên dương');
    }
    const order = isAdmin
      ? await this.store.findAdminOrder(orderId)
      : await this.store.findOrderForUser(orderId, userId);
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    return order;
  }

  async findAdminOrder(orderId: number) {
    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      throw new BadRequestException('orderId phải là số nguyên dương');
    }
    const order = await this.store.findAdminOrder(orderId);
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    return order;
  }

  async listAdminOrders(
    rawPage?: unknown,
    rawLimit?: unknown,
    rawDateFrom?: unknown,
    rawDateTo?: unknown,
    rawStatus?: unknown,
  ) {
    const page = rawPage === undefined ? 1 : Number(rawPage);
    const limit = rawLimit === undefined ? 20 : Number(rawLimit);
    if (!Number.isSafeInteger(page) || page < 1) {
      throw new BadRequestException('page phải là số nguyên dương');
    }
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) {
      throw new BadRequestException('limit phải nằm trong khoảng 1 đến 50');
    }
    if (page > Math.floor(Number.MAX_SAFE_INTEGER / limit)) {
      throw new BadRequestException('page vượt giới hạn');
    }

    const parseVietnamDate = (value: unknown, field: string): Date | null => {
      if (value === undefined) return null;
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new BadRequestException(`${field} phải có định dạng YYYY-MM-DD`);
      }
      const [year, month, day] = value.split('-').map(Number);
      const calendarDate = new Date(Date.UTC(year, month - 1, day));
      if (
        calendarDate.getUTCFullYear() !== year ||
        calendarDate.getUTCMonth() !== month - 1 ||
        calendarDate.getUTCDate() !== day
      ) {
        throw new BadRequestException(`${field} không phải ngày hợp lệ`);
      }
      // The shop operates in Vietnam (UTC+07:00); date-only filters are local days.
      return new Date(Date.UTC(year, month - 1, day) - 7 * 60 * 60 * 1000);
    };

    const dateFrom = parseVietnamDate(rawDateFrom, 'dateFrom');
    const dateToStart = parseVietnamDate(rawDateTo, 'dateTo');
    if (dateFrom && dateToStart && dateFrom.getTime() > dateToStart.getTime()) {
      throw new BadRequestException('dateFrom không được sau dateTo');
    }
    const dateToExclusive = dateToStart
      ? new Date(dateToStart.getTime() + 24 * 60 * 60 * 1000)
      : null;

    let status: string | null = null;
    if (rawStatus !== undefined) {
      if (typeof rawStatus !== 'string' || !isOrderStatus(rawStatus)) {
        throw new BadRequestException('status không được hỗ trợ');
      }
      status = rawStatus;
    }

    return this.store.listAdminOrders(page, limit, {
      dateFrom,
      dateToExclusive,
      status,
    });
  }
}
