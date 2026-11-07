import 'dotenv/config';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import type {
  OrderHistoryRecord,
  OrdersHistoryStore,
} from './orders-history.contract.js';

interface HistoryRow {
  orderId: number;
  status: string;
  total: number;
  createdAt: Date;
  expiresAt: Date | null;
  recipeId: number | null;
  recipeName: string | null;
  productId: number | null;
  productName: string | null;
  quantity: number | null;
  size: string | null;
  toppings: unknown;
  unitPrice: number | null;
  subtotal: number | null;
}

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
    const rows = await this.prisma.$queryRaw<HistoryRow[]>`
      SELECT
        o."id" AS "orderId", o."status", o."total", o."createdAt", o."expiresAt",
        oi."recipeId", oi."recipeName", oi."productId",
        product."name" AS "productName",
        oi."quantity", oi."size", oi."toppings", oi."unitPrice", oi."subtotal"
      FROM "Order" o
      LEFT JOIN "OrderItem" oi ON oi."orderId" = o."id"
      LEFT JOIN "Product" product ON product."id" = oi."productId"
      WHERE o."userId" = ${userId}
      ORDER BY o."createdAt" DESC, o."id" DESC, oi."id" ASC
    `;

    const orders = new Map<number, OrderHistoryRecord>();
    for (const row of rows) {
      const id = Number(row.orderId);
      let order = orders.get(id);
      if (!order) {
        order = {
          id,
          status: row.status,
          total: Number(row.total),
          createdAt: row.createdAt,
          expiresAt: row.expiresAt,
          items: [],
        };
        orders.set(id, order);
      }
      if (row.quantity === null) continue;
      order.items.push({
        recipeId: row.recipeId === null ? null : Number(row.recipeId),
        recipeName: row.recipeName ?? row.productName ?? 'Món đã ngừng kinh doanh',
        // The old API used productId; new menu items alias Recipe.id for compatibility.
        productId: row.productId === null
          ? (row.recipeId === null ? null : Number(row.recipeId))
          : Number(row.productId),
        quantity: Number(row.quantity),
        size: row.size ?? 'M',
        toppings: Array.isArray(row.toppings)
          ? row.toppings.filter((value): value is string => typeof value === 'string')
          : [],
        unitPrice: Number(row.unitPrice),
        subtotal: Number(row.subtotal),
      });
    }
    return [...orders.values()];
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}
