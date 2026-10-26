import 'dotenv/config';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import type {
  PayOnceInput,
  PaymentOrdersStore,
  PaymentResult,
} from './payments.contract.js';

function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'P2002'
  );
}

@Injectable()
export class PaymentsPrismaAdapter
  implements PaymentOrdersStore, OnModuleDestroy
{
  private readonly db: PrismaClient;

  constructor() {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is missing');
    this.db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    });
  }

  async payOnce(input: PayOnceInput): Promise<PaymentResult> {
    const { request, idempotencyKey, requestHash, userId } = input;

    // 1. Kiểm tra nếu Idempotency-Key đã tồn tại
    const existing = await this.db.payment.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new ConflictException(
          'Idempotency-Key already used with different request payload',
        );
      }
      return {
        orderId: existing.orderId,
        status: existing.status as 'PAID' | 'PAYMENT_FAILED',
      };
    }

    const nextStatus =
      request.simulateResult === 'SUCCESS'
        ? ('PAID' as const)
        : ('PAYMENT_FAILED' as const);

    try {
      // 2. Chạy Transaction: kiểm tra Order PENDING + tạo Payment + cập nhật Order
      return await this.db.$transaction(async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: request.orderId },
          select: { id: true, userId: true, status: true, total: true },
        });

        if (!order) {
          throw new NotFoundException('Order not found');
        }
        if (order.userId !== userId) {
          throw new ForbiddenException('Order does not belong to current user');
        }
        if (order.status !== 'PENDING') {
          throw new BadRequestException('Only PENDING orders can be paid');
        }

        await tx.payment.create({
          data: {
            orderId: order.id,
            idempotencyKey,
            requestHash,
            amount: order.total,
            method: request.method,
            status: nextStatus,
          },
        });

        const updated = await tx.order.updateMany({
          where: { id: order.id, status: 'PENDING' },
          data: { status: nextStatus },
        });

        if (updated.count !== 1) {
          throw new ConflictException('Order is no longer PENDING');
        }

        return { orderId: order.id, status: nextStatus };
      });
    } catch (error) {
      // 3. Nếu 2 request cùng key chạy đồng thời, bắt lỗi unique P2002
      if (isUniqueConstraintError(error)) {
        const saved = await this.db.payment.findUnique({
          where: { idempotencyKey },
        });
        if (saved) {
          if (saved.requestHash !== requestHash) {
            throw new ConflictException(
              'Idempotency-Key already used with different request payload',
            );
          }
          return {
            orderId: saved.orderId,
            status: saved.status as 'PAID' | 'PAYMENT_FAILED',
          };
        }
      }
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.db.$disconnect();
  }
}