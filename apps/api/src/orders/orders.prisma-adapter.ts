import 'dotenv/config';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import type {
  OrderDraft,
  OrdersStore,
  StoredOrderResult,
} from './orders.contract.js';

@Injectable()
export class OrdersPrismaAdapter implements OrdersStore, OnModuleDestroy {
  private readonly prisma: PrismaClient;

  constructor() {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is missing');
    this.prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    });
  }

  async getProductById(id: number) {
    return this.prisma.product.findUnique({
      where: { id },
      select: { id: true, price: true, stock: true },
    });
  }

  async findOrderByIdempotencyKey(
    userId: number,
    key: string,
  ): Promise<StoredOrderResult | null> {
    const order = await this.prisma.order.findFirst({
      where: { userId, idempotencyKey: key },
      select: { id: true, status: true, total: true, idempotencyHash: true },
    });
    return order;
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }

  async saveOrder(draft: OrderDraft) {
    const grouped = new Map<number, number>();
    for (const line of draft.items) {
      grouped.set(
        line.productId,
        (grouped.get(line.productId) ?? 0) + line.quantity,
      );
    }
    const quantities = [...grouped.entries()].sort((a, b) => a[0] - b[0]);

    return this.prisma.$transaction(async (tx) => {
      for (const [productId, quantity] of quantities) {
        const product = await tx.product.findUnique({
          where: { id: productId },
          select: { stock: true, version: true },
        });
        if (!product || product.stock < quantity) {
          throw new BadRequestException("Không đủ tồn kho");
        }
        const changed = await tx.product.updateMany({
          where: {
            id: productId,
            version: product.version,
            stock: { gte: quantity },
          },
          data: {
            stock: { decrement: quantity },
            version: { increment: 1 },
          },
        });
        if (changed.count !== 1) {
          throw new ConflictException("Tồn kho vừa thay đổi, hãy thử lại");
        }
      }

      const order = await tx.order.create({
        data: {
          userId: draft.userId,
          status: draft.status,
          total: draft.total,
          discount: draft.discount,
          promoCode: draft.promoCode,
          idempotencyKey: draft.idempotencyKey,
          idempotencyHash: draft.idempotencyHash,
          items: {
            create: draft.items.map((line) => ({
              productId: line.productId,
              quantity: line.quantity,
              size: line.size,
              toppings: line.toppings,
              unitPrice: line.unitPrice,
              subtotal: line.subtotal,
            })),
          },
        },
        select: { 
        id: true, 
        status: true, 
        total: true, 
        idempotencyHash: true 
      },
    });
    return order;
  });
  }
}