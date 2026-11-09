import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  type OnModuleDestroy,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import {
  releaseReservation,
  type OrdersInventoryTransaction,
} from './orders.inventory.js';

export function parseCancellationReason(body: unknown) {
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).length !== 1 ||
    !('reason' in body) ||
    typeof body.reason !== 'string' ||
    !body.reason.trim() ||
    body.reason.trim().length > 300
  )
    throw new BadRequestException('Nhập lý do hủy từ 1 đến 300 ký tự.');
  return body.reason.trim();
}

@Injectable()
export class OrderCancellationService implements OnModuleDestroy {
  private readonly db: PrismaClient;
  constructor() {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is missing');
    this.db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    });
  }
  async cancel(id: number, actorId: number, body: unknown) {
    const reason = parseCancellationReason(body);
    if (
      !Number.isInteger(id) ||
      id < 1 ||
      id > 2147483647 ||
      !Number.isInteger(actorId) ||
      actorId < 1
    )
      throw new BadRequestException('Mã đơn hoặc người thao tác không hợp lệ.');
    return this.db.$transaction(async (tx) => {
      // Same lock and lock order as gateway claim/settlement; no attempt can be created between check and release.
      const orders = await tx.$queryRaw<
        Array<{ id: number; status: string }>
      >`SELECT "id", "status" FROM "Order" WHERE "id"=${id} FOR UPDATE`;
      const order = orders[0];
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
      if (!['PENDING', 'PAYMENT_FAILED'].includes(order.status))
        throw new ConflictException(
          'Chỉ được hủy đơn chờ thanh toán hoặc thanh toán thất bại.',
        );
      const unresolved = await tx.payment.count({
        where: {
          orderId: id,
          OR: [
            { status: { in: ['SUCCESS', 'RECONCILIATION_REQUIRED'] } },
            { status: 'PENDING', creationStatus: { not: 'REJECTED' } },
            {
              provider: 'ZALOPAY',
              creationStatus: { in: ['CREATING', 'UNKNOWN'] },
            },
          ],
        },
      });
      if (unresolved)
        throw new ConflictException(
          'Giao dịch đã thành công hoặc chưa xác định kết quả; cần kiểm tra/đối soát trước khi hủy.',
        );
      await releaseReservation(
        tx as unknown as OrdersInventoryTransaction,
        id,
        'CANCELLED',
      );
      return tx.order.update({
        where: { id },
        data: {
          cancellationReason: reason,
          cancelledAt: new Date(),
          cancelledById: actorId,
        },
        select: {
          id: true,
          status: true,
          cancellationReason: true,
          cancelledAt: true,
          cancelledById: true,
        },
      });
    });
  }
  async onModuleDestroy() {
    await this.db.$disconnect();
  }
}
