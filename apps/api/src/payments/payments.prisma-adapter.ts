import 'dotenv/config';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { pointsForPaidOrder } from '../loyalty/loyalty.service.js';
import { assertTransition, type OrderStatus } from '../orders/order-state.js';
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

  private verifySavedPayment(
    saved: {
      userId: number;
      orderId: number;
      method: string;
      requestHash: string;
      status: string;
    },
    input: PayOnceInput,
  ): PaymentResult {
    if (saved.userId !== input.userId) {
      throw new ForbiddenException('Payment does not belong to current user');
    }
    if (
      saved.orderId !== input.request.orderId ||
      saved.method !== input.request.method ||
      saved.requestHash !== input.requestHash
    ) {
      throw new ConflictException(
        'Idempotency-Key already used with different request parameters',
      );
    }
    return {
      orderId: saved.orderId,
      status: saved.status as 'PAID' | 'PAYMENT_FAILED',
    };
  }

  async payOnce(input: PayOnceInput): Promise<PaymentResult> {
    const { userId, idempotencyKey, requestHash, request } = input;

    // 1. Kiểm tra đơn hàng tồn tại và quyền sở hữu trước tiên
    const initialOrder = await this.db.order.findUnique({
      where: { id: request.orderId },
      select: { id: true, userId: true },
    });
    if (!initialOrder) {
      throw new NotFoundException('Order not found');
    }
    if (initialOrder.userId !== userId) {
      throw new ForbiddenException('Order does not belong to current user');
    }

    // 2. Kiểm tra replay nhanh bên ngoài transaction
    const existingPayment = await this.db.payment.findUnique({
      where: {
        userId_idempotencyKey: { userId, idempotencyKey },
      },
    });
    if (existingPayment) {
      return this.verifySavedPayment(existingPayment, input);
    }

    const targetStatus: 'PAID' | 'PAYMENT_FAILED' =
      request.simulateResult === 'SUCCESS' ? 'PAID' : 'PAYMENT_FAILED';

    try {
      // 3. Thực thi Transaction nguyên tử: Payment + State Machine + Loyalty
      return await this.db.$transaction(async (tx) => {
        // Kiểm tra lại Payment bên trong transaction phòng trường hợp request song song vừa commit xong
        const inTxPayment = await tx.payment.findUnique({
          where: {
            userId_idempotencyKey: { userId, idempotencyKey },
          },
        });
        if (inTxPayment) {
          return this.verifySavedPayment(inTxPayment, input);
        }

        const order = await tx.order.findUnique({
          where: { id: request.orderId },
          select: {
            id: true,
            userId: true,
            status: true,
            total: true,
            loyaltyAwarded: true,
          },
        });

        if (!order) {
          throw new NotFoundException('Order not found');
        }
        if (order.userId !== userId) {
          throw new ForbiddenException('Order does not belong to current user');
        }

        // Chỉ cho phép lần thanh toán mới khi đơn đang PENDING hoặc PAYMENT_FAILED
        if (order.status !== 'PENDING' && order.status !== 'PAYMENT_FAILED') {
          throw new ConflictException(
            `Order in status ${order.status} cannot be paid`,
          );
        }

        // Ghi bản ghi Payment (claim (userId, idempotencyKey))
        await tx.payment.create({
          data: {
            orderId: order.id,
            userId,
            idempotencyKey,
            requestHash,
            amount: order.total,
            method: request.method,
            status: targetStatus,
          },
        });

        // Nếu đơn đang PAYMENT_FAILED, chuyển về PENDING trước theo đúng State Machine
        if (order.status === 'PAYMENT_FAILED') {
          assertTransition(
            'PAYMENT_FAILED' as OrderStatus,
            'PENDING' as OrderStatus,
          );
          const reopened = await tx.order.updateMany({
            where: { id: order.id, userId, status: 'PAYMENT_FAILED' },
            data: { status: 'PENDING' },
          });
          if (reopened.count !== 1) {
            throw new ConflictException('Order state changed concurrently');
          }
        }

        // Chuyển từ PENDING sang PAID hoặc PAYMENT_FAILED
        assertTransition('PENDING' as OrderStatus, targetStatus as OrderStatus);
        const transitioned = await tx.order.updateMany({
          where: { id: order.id, userId, status: 'PENDING' },
          data: { status: targetStatus },
        });
        if (transitioned.count !== 1) {
          throw new ConflictException('Order is no longer PENDING');
        }

        // Nếu PAID: tính điểm và cộng điểm nguyên tử đúng 1 lần
        if (targetStatus === 'PAID') {
          const points = pointsForPaidOrder(order.total);
          const claimed = await tx.order.updateMany({
            where: {
              id: order.id,
              userId,
              status: 'PAID',
              loyaltyAwarded: false,
            },
            data: { loyaltyAwarded: true },
          });

          if (claimed.count === 1 && points > 0) {
            await tx.user.update({
              where: { id: userId },
              data: {
                loyaltyPoints: { increment: points },
              },
            });
          }
        }

        return { orderId: order.id, status: targetStatus };
      });
    } catch (error) {
      // 4. Bắt lỗi P2002 khi 2 request cùng user + key va chạm đúng lúc INSERT
      if (isUniqueConstraintError(error)) {
        const saved = await this.db.payment.findUnique({
          where: {
            userId_idempotencyKey: { userId, idempotencyKey },
          },
        });
        if (saved) {
          return this.verifySavedPayment(saved, input);
        }
      }
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.db.$disconnect();
  }
}