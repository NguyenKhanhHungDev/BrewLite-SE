import 'dotenv/config';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import type { OrderDraft, OrdersStore } from './orders.contract.js';

@Injectable()
export class OrdersPrismaAdapter implements OrdersStore, OnModuleDestroy {
  private readonly prisma: PrismaClient;
  constructor() {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is missing');
    this.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  }
  async getProductById(id: number) {
    return this.prisma.product.findUnique({ where: { id }, select: { id: true, price: true, stock: true } });
  }
  async saveOrder(draft: OrderDraft) {
    const order = await this.prisma.order.create({
      data: { userId: draft.userId, status: draft.status, total: draft.total, items: { create: draft.items.map((line) => ({ productId: line.productId, quantity: line.quantity, size: line.size, toppings: line.toppings, unitPrice: line.unitPrice, subtotal: line.subtotal })) } },
      select: { id: true },
    });
    return { id: order.id };
  }
  async onModuleDestroy() { await this.prisma.$disconnect(); }
}
