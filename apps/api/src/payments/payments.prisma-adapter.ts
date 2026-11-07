import 'dotenv/config';
import { ZalopayService } from './zalopay.service.js';
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
import {
  consumeReservation,
  releaseReservation,
} from '../orders/orders.inventory.js';
import type {
  AdminReconciliationItem,
  AdminReconciliationPage,
  ApplyZalopayResolutionInput,
  ApplyZalopayResolutionResult,
  ClaimZalopayAttemptInput,
  ClaimZalopayAttemptResult,
  OrderPaymentAttemptItem,
  OrderPaymentStatusResult,
  PaymentOrdersStore,
  PendingZalopayAttempt,
  SaveZalopayPaymentUrlInput,
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

  private buildAppTransId(
    orderId: number,
    paymentId: number,
    now = new Date(),
  ): string {
    // Public sandbox app IDs are shared by independent local databases.
    return new ZalopayService().buildAppTransId(orderId, paymentId, now);
  }

  private isOrderExpired(order: {
    status: string;
    expiresAt?: Date | null;
  }): boolean {
    if (order.status === 'EXPIRED') return true;
    if (order.expiresAt && new Date(order.expiresAt).getTime() <= Date.now()) {
      return true;
    }
    return false;
  }

  async claimZalopayAttempt(
    input: ClaimZalopayAttemptInput,
  ): Promise<ClaimZalopayAttemptResult> {
    const { userId, orderId, idempotencyKey, requestHash } = input;

    try {
      return await this.db.$transaction(async (tx: any) => {
        // Serialize payment creation and resolution with inventory transitions.
        await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
        const existingByKey = await tx.payment.findUnique({
          where: {
            userId_idempotencyKey: { userId, idempotencyKey },
          },
        });

        if (existingByKey) {
          if (existingByKey.userId !== userId) {
            throw new ForbiddenException(
              'Payment does not belong to current user',
            );
          }
          if (
            existingByKey.orderId !== orderId ||
            existingByKey.requestHash !== requestHash ||
            existingByKey.provider !== 'ZALOPAY'
          ) {
            throw new ConflictException(
              'Idempotency-Key already used with different request parameters',
            );
          }

          if (existingByKey.creationStatus !== 'REJECTED')
            return {
              mode: 'REPLAY' as const,
              orderId: existingByKey.orderId,
              paymentId: existingByKey.id,
              amount: existingByKey.amount,
              transactionRef:
                existingByKey.transactionRef ??
                this.buildAppTransId(existingByKey.orderId, existingByKey.id),
              status: existingByKey.status,
              cachedPaymentUrl: existingByKey.paymentUrl ?? null,
              createdAt: existingByKey.createdAt,
            };
        }

        const order = await tx.order.findUnique({
          where: { id: orderId },
        });

        if (!order) {
          throw new NotFoundException('Order not found');
        }
        if (order.userId !== userId) {
          throw new ForbiddenException('Order does not belong to current user');
        }
        if (this.isOrderExpired(order)) {
          throw new ConflictException('Order has expired and cannot be paid');
        }
        if (order.status !== 'PENDING') {
          throw new ConflictException(
            `Order in status ${order.status} cannot initiate payment`,
          );
        }
        if (!Number.isSafeInteger(order.total) || order.total <= 0) {
          throw new BadRequestException(
            'Order total is invalid for ZaloPay payment',
          );
        }

        const activePending = await tx.payment.findFirst({
          where: {
            orderId: order.id,
            provider: 'ZALOPAY',
            status: 'PENDING',
          },
          orderBy: { createdAt: 'desc' },
        });

        if (activePending && activePending.idempotencyKey !== idempotencyKey) {
          throw new ConflictException(
            'Another ZaloPay payment attempt is currently active for this order',
          );
        }

        if (existingByKey) {
          const ref = this.buildAppTransId(order.id, existingByKey.id);
          const retried = await tx.payment.update({
            where: { id: existingByKey.id },
            data: {
              creationStatus: 'CREATING',
              transactionRef: ref,
              createdAt: new Date(),
              lastQueriedAt: null,
            },
          });
          return {
            mode: 'NEW' as const,
            orderId,
            paymentId: retried.id,
            amount: retried.amount,
            transactionRef: ref,
            status: retried.status,
            cachedPaymentUrl: null,
            createdAt: retried.createdAt,
          };
        }
        const created = await tx.payment.create({
          data: {
            orderId: order.id,
            userId,
            provider: 'ZALOPAY',
            method: 'ZALOPAY',
            idempotencyKey,
            requestHash,
            amount: order.total,
            status: 'PENDING',
            creationStatus: 'CREATING',
          },
        });

        const appTransId = this.buildAppTransId(order.id, created.id);

        const updated = await tx.payment.update({
          where: { id: created.id },
          data: { transactionRef: appTransId },
        });

        return {
          mode: 'NEW' as const,
          orderId: order.id,
          paymentId: updated.id,
          amount: updated.amount,
          transactionRef: appTransId,
          status: updated.status,
          cachedPaymentUrl: null,
          createdAt: updated.createdAt,
        };
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const saved = await this.db.payment.findUnique({
          where: {
            userId_idempotencyKey: { userId, idempotencyKey },
          },
        });
        if (saved) {
          if (
            saved.orderId !== orderId ||
            saved.requestHash !== requestHash ||
            saved.provider !== 'ZALOPAY'
          ) {
            throw new ConflictException(
              'Idempotency-Key already used with different request parameters',
            );
          }
          return {
            mode: 'REPLAY',
            orderId: saved.orderId,
            paymentId: saved.id,
            amount: saved.amount,
            transactionRef:
              saved.transactionRef ??
              this.buildAppTransId(saved.orderId, saved.id),
            status: saved.status,
            cachedPaymentUrl: saved.paymentUrl ?? null,
          };
        }
      }
      throw error;
    }
  }

  async saveZalopayPaymentUrl(
    input: SaveZalopayPaymentUrlInput,
  ): Promise<void> {
    // Persist the URL even if a callback has already completed; never change status.
    await this.db.payment.updateMany({
      where: {
        id: input.paymentId,
        transactionRef: input.transactionRef,
      },
      data: {
        paymentUrl: input.paymentUrl,
        creationStatus: 'READY',
      },
    });
  }

  async markZalopayCreation(
    paymentId: number,
    transactionRef: string,
    status: 'REJECTED' | 'UNKNOWN',
  ): Promise<void> {
    await this.db.payment.updateMany({
      where: { id: paymentId, transactionRef, status: 'PENDING' },
      data: { creationStatus: status },
    });
  }

  async applyZalopayResolution(
    input: ApplyZalopayResolutionInput,
  ): Promise<ApplyZalopayResolutionResult> {
    return this.db.$transaction(async (tx: any) => {
      const reference = await tx.payment.findUnique({
        where: { transactionRef: input.transactionRef },
      });
      if (!reference) throw new NotFoundException('Payment not found');
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${reference.orderId} FOR UPDATE`;
      const payment = await tx.payment.findUnique({
        where: { transactionRef: input.transactionRef },
      });

      if (!payment || payment.provider !== 'ZALOPAY') {
        throw new NotFoundException(
          `ZaloPay payment with ref ${input.transactionRef} not found`,
        );
      }

      if (payment.amount !== input.amountVnd) {
        throw new BadRequestException(
          `Amount mismatch: expected ${payment.amount}, received ${input.amountVnd}`,
        );
      }

      if (
        input.outcome === 'SUCCESS' &&
        ['FAILED', 'CANCELLED'].includes(payment.status)
      ) {
        const changed = await tx.payment.updateMany({
          where: { id: payment.id, status: payment.status },
          data: {
            status: 'RECONCILIATION_REQUIRED',
            providerTransactionId: input.providerTransactionId ?? null,
          },
        });
        return {
          applied: changed.count === 1,
          duplicate: changed.count !== 1,
          paymentStatus: 'RECONCILIATION_REQUIRED',
        };
      }
      if (payment.status !== 'PENDING') {
        return {
          applied: false,
          duplicate: true,
          paymentStatus: payment.status,
        };
      }

      const order = await tx.order.findUnique({
        where: { id: payment.orderId },
      });

      if (!order) {
        throw new NotFoundException(`Order #${payment.orderId} not found`);
      }

      if (input.outcome === 'SUCCESS') {
        // Trường hợp đơn đã EXPIRED / CANCELLED / RELEASED nhưng tiền đến muộn -> RECONCILIATION_REQUIRED
        if (
          (this.isOrderExpired(order) && order.status !== 'PENDING') ||
          order.status === 'CANCELLED' ||
          order.status === 'RELEASED' ||
          order.status === 'PAYMENT_FAILED'
        ) {
          const reconNote =
            input.reason ??
            `LATE_SUCCESS_ON_${order.status}:zp=${input.providerTransactionId ?? 'UNKNOWN'}`;

          const claimedRecon = await tx.payment.updateMany({
            where: { id: payment.id, status: 'PENDING' },
            data: {
              status: 'RECONCILIATION_REQUIRED',
              providerTransactionId: reconNote,
            },
          });

          if (claimedRecon.count !== 1) {
            const latest = await tx.payment.findUnique({
              where: { id: payment.id },
            });
            return {
              applied: false,
              duplicate: true,
              paymentStatus: latest?.status ?? 'RECONCILIATION_REQUIRED',
            };
          }

          return {
            applied: true,
            duplicate: false,
            paymentStatus: 'RECONCILIATION_REQUIRED',
            orderStatus: order.status,
          };
        }

        // Gọi helper kho của Phát và đọc kết quả thật
        const consumeResult = await consumeReservation(tx, order.id, true);
        const outcomeStatus =
          typeof consumeResult === 'string'
            ? consumeResult
            : ((consumeResult as any)?.status ?? 'CONSUMED');

        if (
          outcomeStatus === 'EXPIRED' ||
          outcomeStatus === 'RELEASED' ||
          outcomeStatus === 'CANCELLED'
        ) {
          const reconNote = `RESERVATION_${outcomeStatus}:zp=${input.providerTransactionId ?? 'UNKNOWN'}`;
          await tx.payment.updateMany({
            where: { id: payment.id, status: 'PENDING' },
            data: {
              status: 'RECONCILIATION_REQUIRED',
              providerTransactionId: reconNote,
            },
          });
          return {
            applied: true,
            duplicate: false,
            paymentStatus: 'RECONCILIATION_REQUIRED',
          };
        }

        const claimedSuccess = await tx.payment.updateMany({
          where: { id: payment.id, status: 'PENDING' },
          data: {
            status: 'SUCCESS',
            providerTransactionId: input.providerTransactionId ?? null,
            paidAt: new Date(),
          },
        });

        if (claimedSuccess.count !== 1) {
          const latest = await tx.payment.findUnique({
            where: { id: payment.id },
          });
          return {
            applied: false,
            duplicate: true,
            paymentStatus: latest?.status ?? 'SUCCESS',
          };
        }

        // Cộng điểm Loyalty đúng 1 lần duy nhất
        const points = pointsForPaidOrder(order.total);
        const claimedLoyalty = await tx.order.updateMany({
          where: {
            id: order.id,
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

        return {
          applied: true,
          duplicate: false,
          paymentStatus: 'SUCCESS',
          orderStatus: 'PAID',
        };
      }

      // Failure / Cancel cuối đã xác minh -> giải phóng kho qua helper của Phát
      const targetPaymentStatus =
        input.outcome === 'CANCELLED' ? 'CANCELLED' : 'FAILED';

      const claimedFailure = await tx.payment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: {
          status: targetPaymentStatus,
          providerTransactionId: input.providerTransactionId ?? null,
        },
      });

      if (claimedFailure.count !== 1) {
        const latest = await tx.payment.findUnique({
          where: { id: payment.id },
        });
        return {
          applied: false,
          duplicate: true,
          paymentStatus: latest?.status ?? targetPaymentStatus,
        };
      }

      await releaseReservation(tx, order.id, 'PAYMENT_FAILED' as any);

      return {
        applied: true,
        duplicate: false,
        paymentStatus: targetPaymentStatus,
        orderStatus: 'PAYMENT_FAILED',
      };
    });
  }

  async listPendingZalopayAttempts(
    limit = 10,
  ): Promise<PendingZalopayAttempt[]> {
    const rows = await this.db.payment.findMany({
      where: {
        provider: 'ZALOPAY',
        status: 'PENDING',
        transactionRef: { not: null },
        creationStatus: { not: 'REJECTED' },
        OR: [
          { creationStatus: { not: 'CREATING' } },
          { createdAt: { lt: new Date(Date.now() - 60_000) } },
        ],
      },
      orderBy: [
        { lastQueriedAt: { sort: 'asc', nulls: 'first' } },
        { id: 'asc' },
      ],
      take: Math.max(1, Math.min(limit, 50)),
    });

    if (rows.length)
      await this.db.payment.updateMany({
        where: { id: { in: rows.map((row) => row.id) } },
        data: { lastQueriedAt: new Date() },
      });
    return rows
      .filter((r) => typeof r.transactionRef === 'string' && r.userId !== null)
      .map((r) => ({
        paymentId: r.id,
        orderId: r.orderId,
        userId: r.userId!,
        transactionRef: r.transactionRef!,
        amount: r.amount,
        createdAt: r.createdAt,
      }));
  }

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
            createdAt: latestPayment.createdAt,
            creationStatus: latestPayment.creationStatus,
          }
        : null,
    };
  }

  async getOrderPaymentHistory(
    userId: number,
    orderId: number,
  ): Promise<OrderPaymentAttemptItem[]> {
    const order = await this.db.order.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.userId !== userId) {
      throw new ForbiddenException('Order does not belong to current user');
    }

    const rows = await this.db.payment.findMany({
      where: { orderId: order.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    return rows.map((r) => ({
      paymentId: r.id,
      orderId: r.orderId,
      provider: r.provider,
      transactionRef: r.transactionRef,
      providerTransactionId: r.providerTransactionId,
      amount: r.amount,
      method: r.method,
      status: r.status,
      creationStatus: r.creationStatus,
      paidAt: r.paidAt,
      createdAt: r.createdAt,
    }));
  }

  async listReconciliationPayments(
    page: number,
    limit: number,
  ): Promise<AdminReconciliationPage> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, Math.min(50, limit));
    const offset = (safePage - 1) * safeLimit;

    const [total, rows] = await Promise.all([
      this.db.payment.count({
        where: { status: 'RECONCILIATION_REQUIRED' },
      }),
      this.db.payment.findMany({
        where: { status: 'RECONCILIATION_REQUIRED' },
        include: {
          order: {
            select: {
              status: true,
              user: { select: { email: true } },
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: offset,
        take: safeLimit,
      }),
    ]);

    const data: AdminReconciliationItem[] = rows.map((r) => ({
      paymentId: r.id,
      orderId: r.orderId,
      orderStatus: r.order.status,
      userEmail: r.order.user?.email ?? '',
      userId: r.userId,
      amount: r.amount,
      provider: r.provider,
      method: r.method,
      status: r.status,
      creationStatus: r.creationStatus,
      transactionRef: r.transactionRef,
      providerTransactionId: r.providerTransactionId,
      paidAt: r.paidAt,
      createdAt: r.createdAt,
      lastQueriedAt: r.lastQueriedAt,
    }));

    return {
      data,
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  async onModuleDestroy() {
    await this.db.$disconnect();
  }
}
