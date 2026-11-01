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
import { pointsForPaidOrder } from '../loyalty/loyalty.service.js';
import { assertTransition, type OrderStatus } from '../orders/order-state.js';
import type {
  CreateVnpayPaymentRecordInput,
  CreateVnpayPaymentRecordResult,
  OrderPaymentStatusResult,
  PayOnceInput,
  PaymentOrdersStore,
  PaymentResult,
  VnpayIpnProcessInput,
  VnpayIpnResponse,
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
      userId: number | null;
      orderId: number;
      method: string;
      requestHash: string | null;
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
      return await this.db.$transaction(async (tx) => {
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

        if (order.status !== 'PENDING' && order.status !== 'PAYMENT_FAILED') {
          throw new ConflictException(
            `Order in status ${order.status} cannot be paid`,
          );
        }

        await tx.payment.create({
          data: {
            orderId: order.id,
            userId,
            provider: 'MOCK',
            idempotencyKey,
            requestHash,
            amount: order.total,
            method: request.method,
            status: targetStatus,
            paidAt: targetStatus === 'PAID' ? new Date() : null,
          },
        });

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

        assertTransition('PENDING' as OrderStatus, targetStatus as OrderStatus);
        const transitioned = await tx.order.updateMany({
          where: { id: order.id, userId, status: 'PENDING' },
          data: { status: targetStatus },
        });
        if (transitioned.count !== 1) {
          throw new ConflictException('Order is no longer PENDING');
        }

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

  // --- VNPAY SANDBOX: 1. Tạo bản ghi Payment PENDING từ Order.total ---
  async createVnpayPayment(
    input: CreateVnpayPaymentRecordInput,
  ): Promise<CreateVnpayPaymentRecordResult> {
    const { userId, orderId, transactionRef } = input;

    const order = await this.db.order.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true, status: true, total: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.userId !== userId) {
      throw new ForbiddenException('Order does not belong to current user');
    }
    if (order.status !== 'PENDING' && order.status !== 'PAYMENT_FAILED') {
      throw new ConflictException(
        `Order in status ${order.status} cannot initiate payment`,
      );
    }
    if (!Number.isSafeInteger(order.total) || order.total <= 0) {
      throw new BadRequestException('Order total is invalid for VNPAY payment');
    }

    const payment = await this.db.payment.create({
      data: {
        orderId: order.id,
        userId,
        provider: 'VNPAY',
        transactionRef,
        amount: order.total,
        method: 'VNPAY',
        status: 'PENDING',
      },
    });

    return {
      orderId: order.id,
      paymentId: payment.id,
      amount: order.total,
      transactionRef,
    };
  }

  // --- VNPAY SANDBOX: 2. Xử lý IPN nguyên tử và chống trùng lặp ---
  async processVnpayIpn(
    input: VnpayIpnProcessInput,
  ): Promise<VnpayIpnResponse> {
    const payment = await this.db.payment.findUnique({
      where: { transactionRef: input.transactionRef },
    });

    if (!payment) {
      return { RspCode: '01', Message: 'Order not found' };
    }

    // Kiểm tra số tiền phản hồi phải khớp tuyệt đối với số tiền trong DB
    if (payment.amount !== input.amountVnd) {
      return { RspCode: '04', Message: 'Invalid amount' };
    }

    // Nếu giao dịch đã được xử lý trước đó -> trả mã 02 Idempotent theo chuẩn VNPAY
    if (payment.status !== 'PENDING') {
      return { RspCode: '02', Message: 'Order already confirmed' };
    }

    const isSuccess =
      input.responseCode === '00' && input.transactionStatus === '00';
    const isCancelled = input.responseCode === '24';
    const nextPaymentStatus = isSuccess
      ? 'SUCCESS'
      : isCancelled
        ? 'CANCELLED'
        : 'FAILED';

    await this.db.$transaction(async (tx) => {
      const currentPayment = await tx.payment.findUnique({
        where: { id: payment.id },
      });
      if (!currentPayment || currentPayment.status !== 'PENDING') {
        return;
      }

      const claimedPayment = await tx.payment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: {
          status: nextPaymentStatus,
          providerTransactionId: input.providerTransactionId ?? null,
          paidAt: isSuccess ? new Date() : null,
        },
      });

      if (claimedPayment.count !== 1) {
        return;
      }

      const order = await tx.order.findUnique({
        where: { id: payment.orderId },
        select: {
          id: true,
          userId: true,
          status: true,
          total: true,
          loyaltyAwarded: true,
        },
      });

      if (!order) {
        return;
      }

      if (isSuccess) {
        if (order.status === 'PAYMENT_FAILED') {
          assertTransition(
            'PAYMENT_FAILED' as OrderStatus,
            'PENDING' as OrderStatus,
          );
          await tx.order.updateMany({
            where: { id: order.id, status: 'PAYMENT_FAILED' },
            data: { status: 'PENDING' },
          });
        }

        if (order.status === 'PENDING' || order.status === 'PAYMENT_FAILED') {
          assertTransition('PENDING' as OrderStatus, 'PAID' as OrderStatus);
          const updatedOrder = await tx.order.updateMany({
            where: { id: order.id, status: 'PENDING' },
            data: { status: 'PAID' },
          });

          if (updatedOrder.count === 1) {
            const points = pointsForPaidOrder(order.total);
            const claimedLoyalty = await tx.order.updateMany({
              where: {
                id: order.id,
                status: 'PAID',
                loyaltyAwarded: false,
              },
              data: { loyaltyAwarded: true },
            });

            if (claimedLoyalty.count === 1 && points > 0) {
              await tx.user.update({
                where: { id: order.userId },
                data: { loyaltyPoints: { increment: points } },
              });
            }
          }
        }
      } else if (order.status === 'PENDING') {
        assertTransition(
          'PENDING' as OrderStatus,
          'PAYMENT_FAILED' as OrderStatus,
        );
        await tx.order.updateMany({
          where: { id: order.id, status: 'PENDING' },
          data: { status: 'PAYMENT_FAILED' },
        });
      }
    });

    return { RspCode: '00', Message: 'Confirm Success' };
  }

  // --- VNPAY SANDBOX: 3. Truy vấn trạng thái đơn hàng cho chủ đơn ---
  async getOrderPaymentStatus(
    userId: number,
    orderId: number,
  ): Promise<OrderPaymentStatusResult> {
    const order = await this.db.order.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true, status: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.userId !== userId) {
      throw new ForbiddenException('Order does not belong to current user');
    }

    const latestPayment = await this.db.payment.findFirst({
      where: { orderId: order.id },
      orderBy: { createdAt: 'desc' },
    });

    return {
      orderId: order.id,
      orderStatus: order.status,
      latestPayment: latestPayment
        ? {
            paymentId: latestPayment.id,
            provider: latestPayment.provider,
            transactionRef: latestPayment.transactionRef,
            amount: latestPayment.amount,
            status: latestPayment.status,
            paidAt: latestPayment.paidAt,
          }
        : null,
    };
  }

  async onModuleDestroy() {
    await this.db.$disconnect();
  }
}