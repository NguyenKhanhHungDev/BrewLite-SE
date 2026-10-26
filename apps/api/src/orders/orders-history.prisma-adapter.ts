import 'dotenv/config';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import type {
  OrderHistoryRecord,
  OrdersHistoryStore,
} from './orders-history.contract.js';

@Injectable()
export class OrdersHistoryPrismaAdapter
  implements OrdersHistoryStore, OnModuleDestroy
{
  private readonly prisma: PrismaClient;

  constructor() {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is missing');
    this.prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    });
  }

  async findMine(userId: number): Promise<OrderHistoryRecord[]> {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });

    return orders.map((order) => ({
      id: order.id,
      status: order.status,
      total: order.total,
      createdAt: order.createdAt,
      items: order.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        size: item.size,
        toppings: Array.isArray(item.toppings)
          ? item.toppings.filter(
              (value): value is string => typeof value === 'string',
            )
          : [],
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
      })),
    }));
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}
