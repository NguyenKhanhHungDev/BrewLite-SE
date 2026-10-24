import {
  BadRequestException,
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
} from './orders.contract.js';

type InputItem = { productId: number; quantity: number };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseItems(body: unknown): InputItem[] {
  if (!isObject(body) || Object.keys(body).some((key) => key !== 'items')) {
    throw new BadRequestException('Body must contain only items');
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new BadRequestException('items must be a non-empty array');
  }

  return body.items.map((item: unknown) => {
    if (
      !isObject(item) ||
      Object.keys(item).some((key) => key !== 'productId' && key !== 'quantity')
    ) {
      throw new BadRequestException('Invalid order item');
    }
    const { productId, quantity } = item;
    if (
      !Number.isSafeInteger(productId) ||
      Number(productId) <= 0 ||
      !Number.isSafeInteger(quantity) ||
      Number(quantity) <= 0
    ) {
      throw new BadRequestException(
        'productId and quantity must be positive integers',
      );
    }
    return { productId: Number(productId), quantity: Number(quantity) };
  });
}

@Injectable()
export class OrdersService {
  constructor(@Inject(ORDERS_STORE) private readonly store: OrdersStore) {}

  async create(userId: number, requestBody: unknown) {
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new UnauthorizedException('Authenticated user is required');
    }

    const inputItems = parseItems(requestBody);
    const lines: OrderLine[] = [];
    let total = 0;

    for (const item of inputItems) {
      const product = await this.store.getProductById(item.productId);
      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found`);
      }
      if (!Number.isSafeInteger(product.price) || product.price < 0) {
        throw new BadRequestException('Invalid product price');
      }
      const subtotal = product.price * item.quantity;
      if (!Number.isSafeInteger(subtotal) || !Number.isSafeInteger(total + subtotal)) {
        throw new BadRequestException('Order total is too large');
      }
      lines.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: product.price,
        subtotal,
      });
      total += subtotal;
    }

    const draft: OrderDraft = {
      userId,
      status: 'PENDING',
      total,
      items: lines,
    };
    const saved = await this.store.saveOrder(draft);
    return { orderId: saved.id, status: 'PENDING' as const, total };
  }
}
