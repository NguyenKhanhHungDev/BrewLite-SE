import 'dotenv/config';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import type { OrderStateStore } from './order-state.contract.js';
import type { OrderStatus } from './order-state.js';

@Injectable()
export class OrderStatePrismaAdapter
  implements OrderStateStore, OnModuleDestroy
{
  private readonly prisma: PrismaClient;

  constructor() {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is missing');
    this.prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    });
  }

  async findStatusById(orderId: number): Promise<string | null> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true },
    });
    return order?.status ?? null;
  }

  async transitionIfCurrent(
    orderId: number,
    currentStatus: OrderStatus,
    nextStatus: OrderStatus,
  ): Promise<boolean> {
    const result = await this.prisma.order.updateMany({
      where: { id: orderId, status: currentStatus },
      data: { status: nextStatus },
    });
    return result.count === 1;
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}
