import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { IngredientNeed } from './orders.ingredients.js';

/** Structural subset shared by Prisma interactive transactions from Orders and Payments. */
export interface OrdersInventoryTransaction {
  $queryRaw<T = unknown>(
    query: TemplateStringsArray,
    ...values: any[]
  ): Promise<T>;
  $executeRaw(query: TemplateStringsArray, ...values: any[]): Promise<number>;
}

export type ReservationReleaseStatus = 'PAYMENT_FAILED' | 'CANCELLED';
export type ReservationConsumeResult =
  'CONSUMED' | 'ALREADY_CONSUMED' | 'EXPIRED' | 'LEGACY_ORDER';

interface OrderRow {
  id: number;
  status: string;
  expiresAt: Date | null;
}

interface ReservationRow {
  ingredientId: number;
  quantity: number;
  status: 'RESERVED' | 'CONSUMED' | 'RELEASED';
}

/** Reserve all ingredients in ascending ID order. Caller owns the transaction. */
export async function reserveForOrder(
  tx: OrdersInventoryTransaction,
  orderId: number,
  requirements: IngredientNeed[],
): Promise<void> {
  for (const need of [...requirements].sort(
    (a, b) => a.ingredientId - b.ingredientId,
  )) {
    const changed = await tx.$queryRaw<Array<{ id: number }>>`
      UPDATE "Ingredient"
      SET "reserved" = "reserved" + ${need.quantity},
          "version" = "version" + 1
      WHERE "id" = ${need.ingredientId}
        AND "stock" >= 0
        AND "reserved" >= 0
        AND ("stock" - "reserved") >= ${need.quantity}
      RETURNING "id"
    `;
    if (changed.length !== 1) {
      throw new BadRequestException('Không đủ nguyên liệu để tạo đơn hàng');
    }

    await tx.$executeRaw`
      INSERT INTO "OrderIngredient" ("orderId", "ingredientId", "quantity", "status")
      VALUES (${orderId}, ${need.ingredientId}, ${need.quantity}, 'RESERVED')
    `;
  }
}

/**
 * Release only rows that are still RESERVED. The status compare-and-set and
 * stock update are in the caller's transaction, making duplicate callbacks safe.
 */
export async function releaseReservation(
  tx: OrdersInventoryTransaction,
  orderId: number,
  nextStatus: ReservationReleaseStatus,
): Promise<boolean> {
  const orders = await tx.$queryRaw<OrderRow[]>`
    SELECT "id", "status", "expiresAt"
    FROM "Order"
    WHERE "id" = ${orderId}
    FOR UPDATE
  `;
  const order = orders[0];
  if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');

  if (
    order.status === 'PAID' ||
    order.status === 'PREPARING' ||
    order.status === 'READY' ||
    order.status === 'COMPLETED'
  ) {
    throw new ConflictException(
      'Không thể hoàn nguyên liệu của đơn đã thanh toán',
    );
  }

  const reservations = await tx.$queryRaw<ReservationRow[]>`
    SELECT "ingredientId", "quantity", "status"
    FROM "OrderIngredient"
    WHERE "orderId" = ${orderId} AND "status" = 'RESERVED'
    ORDER BY "ingredientId" ASC
    FOR UPDATE
  `;

  for (const reservation of reservations) {
    const changed = await tx.$queryRaw<Array<{ id: number }>>`
      UPDATE "Ingredient"
      SET "reserved" = "reserved" - ${reservation.quantity},
          "version" = "version" + 1
      WHERE "id" = ${reservation.ingredientId}
        AND "reserved" >= ${reservation.quantity}
      RETURNING "id"
    `;
    if (changed.length !== 1) {
      throw new ConflictException(
        'Reservation không nhất quán; không thể hoàn nguyên liệu',
      );
    }

    const released = await tx.$queryRaw<Array<{ id: number }>>`
      UPDATE "OrderIngredient"
      SET "status" = 'RELEASED'
      WHERE "orderId" = ${orderId}
        AND "ingredientId" = ${reservation.ingredientId}
        AND "status" = 'RESERVED'
      RETURNING "ingredientId" AS "id"
    `;
    if (released.length !== 1) {
      throw new ConflictException(
        'Reservation đã thay đổi trong lúc hoàn nguyên liệu',
      );
    }
  }

  if (order.status === nextStatus) return reservations.length > 0;
  if (order.status === 'CANCELLED' || order.status === 'PAYMENT_FAILED') {
    if (nextStatus === 'CANCELLED' && order.status === 'PAYMENT_FAILED') {
      const updated = await tx.$queryRaw<Array<{ id: number }>>`
        UPDATE "Order"
        SET "status" = 'CANCELLED'
        WHERE "id" = ${orderId} AND "status" = 'PAYMENT_FAILED'
        RETURNING "id"
      `;
      return updated.length === 1 || reservations.length > 0;
    }
    return reservations.length > 0;
  }

  const updated = await tx.$queryRaw<Array<{ id: number }>>`
    UPDATE "Order"
    SET "status" = ${nextStatus}
    WHERE "id" = ${orderId} AND "status" = 'PENDING'
    RETURNING "id"
  `;
  if (updated.length !== 1) {
    throw new ConflictException('Trạng thái đơn hàng đã thay đổi');
  }
  return true;
}

/** Consume a reservation once and transition PENDING -> PAID in the same tx. */
export async function consumeReservation(
  tx: OrdersInventoryTransaction,
  orderId: number,
  // Only Payments may bypass the clock after a gateway-confirmed success; released reservations still fail.
  verifiedGatewaySuccess = false,
): Promise<ReservationConsumeResult> {
  const orders = await tx.$queryRaw<OrderRow[]>`
    SELECT "id", "status", "expiresAt"
    FROM "Order"
    WHERE "id" = ${orderId}
    FOR UPDATE
  `;
  const order = orders[0];
  if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');

  const reservations = await tx.$queryRaw<ReservationRow[]>`
    SELECT "ingredientId", "quantity", "status"
    FROM "OrderIngredient"
    WHERE "orderId" = ${orderId}
    ORDER BY "ingredientId" ASC
    FOR UPDATE
  `;
  const reservedRows = reservations.filter(
    (item) => item.status === 'RESERVED',
  );
  const isPaidOrBeyond = ['PAID', 'PREPARING', 'READY', 'COMPLETED'].includes(
    order.status,
  );

  if (order.status === 'CANCELLED' || order.status === 'PAYMENT_FAILED') {
    throw new ConflictException(
      'Đơn đã giải phóng nguyên liệu; không thể ghi nhận PAID',
    );
  }
  if (order.status !== 'PENDING' && !isPaidOrBeyond) {
    throw new ConflictException(
      `Không thể tiêu thụ nguyên liệu ở trạng thái ${order.status}`,
    );
  }

  if (
    !verifiedGatewaySuccess &&
    order.status === 'PENDING' &&
    order.expiresAt &&
    order.expiresAt.getTime() <= Date.now()
  ) {
    await releaseReservation(tx, orderId, 'CANCELLED');
    return 'EXPIRED';
  }

  if (reservedRows.length === 0) {
    if (
      reservations.length > 0 &&
      reservations.every((item) => item.status === 'CONSUMED')
    ) {
      if (order.status === 'PENDING') {
        const paid = await tx.$queryRaw<Array<{ id: number }>>`
          UPDATE "Order"
          SET "status" = 'PAID'
          WHERE "id" = ${orderId}
            AND "status" = 'PENDING'
            AND (${verifiedGatewaySuccess} OR "expiresAt" IS NULL OR "expiresAt" > CURRENT_TIMESTAMP)
          RETURNING "id"
        `;
        if (paid.length !== 1)
          throw new ConflictException(
            'Đơn đã hết hạn hoặc trạng thái đã thay đổi',
          );
      }
      return 'ALREADY_CONSUMED';
    }

    if (reservations.length > 0) {
      throw new ConflictException(
        'Đơn đã giải phóng nguyên liệu; không thể ghi nhận PAID',
      );
    }

    // Orders created before the ingredient-inventory migration have no expiry
    // and no OrderIngredient rows. Keep their historical payment behavior.
    if (order.expiresAt === null && order.status === 'PENDING') {
      const legacyPaid = await tx.$queryRaw<Array<{ id: number }>>`
        UPDATE "Order"
        SET "status" = 'PAID'
        WHERE "id" = ${orderId} AND "status" = 'PENDING'
        RETURNING "id"
      `;
      if (legacyPaid.length === 1) return 'LEGACY_ORDER';
    }
    if (isPaidOrBeyond && order.expiresAt === null) return 'ALREADY_CONSUMED';
    throw new ConflictException('Đơn mới không có reservation nguyên liệu');
  }

  if (reservedRows.length !== reservations.length) {
    throw new ConflictException('Trạng thái reservation không đồng nhất');
  }

  for (const reservation of reservedRows) {
    const changed = await tx.$queryRaw<Array<{ id: number }>>`
      UPDATE "Ingredient"
      SET "stock" = "stock" - ${reservation.quantity},
          "reserved" = "reserved" - ${reservation.quantity},
          "version" = "version" + 1
      WHERE "id" = ${reservation.ingredientId}
        AND "stock" >= ${reservation.quantity}
        AND "reserved" >= ${reservation.quantity}
      RETURNING "id"
    `;
    if (changed.length !== 1) {
      throw new ConflictException(
        'Tồn kho không nhất quán; không thể tiêu thụ reservation',
      );
    }

    const consumed = await tx.$queryRaw<Array<{ id: number }>>`
      UPDATE "OrderIngredient"
      SET "status" = 'CONSUMED'
      WHERE "orderId" = ${orderId}
        AND "ingredientId" = ${reservation.ingredientId}
        AND "status" = 'RESERVED'
      RETURNING "ingredientId" AS "id"
    `;
    if (consumed.length !== 1) {
      throw new ConflictException('Reservation đã thay đổi trong lúc tiêu thụ');
    }
  }

  if (order.status === 'PENDING') {
    const paid = await tx.$queryRaw<Array<{ id: number }>>`
      UPDATE "Order"
      SET "status" = 'PAID'
      WHERE "id" = ${orderId}
        AND "status" = 'PENDING'
        AND (${verifiedGatewaySuccess} OR "expiresAt" IS NULL OR "expiresAt" > CURRENT_TIMESTAMP)
      RETURNING "id"
    `;
    if (paid.length !== 1) {
      throw new ConflictException('Đơn đã hết hạn hoặc trạng thái đã thay đổi');
    }
  }
  return 'CONSUMED';
}
