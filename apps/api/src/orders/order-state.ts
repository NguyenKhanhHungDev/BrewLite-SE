import { BadRequestException } from '@nestjs/common';

export type OrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'PAYMENT_FAILED'
  | 'CANCELLED';

const allowedTransitions: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ['PAID', 'PAYMENT_FAILED', 'CANCELLED'],
  PAYMENT_FAILED: ['PENDING', 'CANCELLED'],
  PAID: ['PREPARING'],
  PREPARING: ['READY'],
  READY: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && Object.hasOwn(allowedTransitions, value);
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!allowedTransitions[from].includes(to)) {
    throw new BadRequestException(
      `Không thể đổi trạng thái đơn hàng từ ${from} thành ${to}`,
    );
  }
}

export function getAllowedTransitions(): Readonly<
  Record<OrderStatus, readonly OrderStatus[]>
> {
  return allowedTransitions;
}
