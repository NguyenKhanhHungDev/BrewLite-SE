import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LoyaltyService } from '../loyalty/loyalty.service.js';
import {
  ORDER_STATE_STORE,
  type OrderStateStore,
} from './order-state.contract.js';
import {
  assertTransition,
  isOrderStatus,
  type OrderStatus,
} from './order-state.js';

@Injectable()
export class OrderStateService {
  constructor(
    @Inject(ORDER_STATE_STORE) private readonly store: OrderStateStore,
    private readonly loyalty: LoyaltyService,
  ) {}

  async transition(orderId: number, nextStatus: OrderStatus) {
    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      throw new BadRequestException('orderId phải là số nguyên dương');
    }
    if (!isOrderStatus(nextStatus)) {
      throw new BadRequestException('Trạng thái đơn hàng không hợp lệ');
    }

    const currentStatus = await this.store.findStatusById(orderId);
    if (currentStatus === null)
      throw new NotFoundException('Không tìm thấy đơn hàng');
    if (!isOrderStatus(currentStatus)) {
      throw new ConflictException(
        `Trạng thái hiện tại không hợp lệ: ${currentStatus}`,
      );
    }

    // Nếu lần chuyển sang PAID trước đó đã cập nhật trạng thái nhưng gặp lỗi
    // khi cấp điểm, lần tiếp tục xử lý tiếp theo sẽ thử cấp điểm lại an toàn.
    if (currentStatus === 'PAID') {
      await this.loyalty.awardPaidOrder(orderId);
    }

    assertTransition(currentStatus, nextStatus);
    const updated = await this.store.transitionIfCurrent(
      orderId,
      currentStatus,
      nextStatus,
    );
    if (!updated) {
      throw new ConflictException(
        'Trạng thái đơn hàng đã thay đổi; hãy tải lại rồi thử lại',
      );
    }

    if (nextStatus === 'PAID') {
      await this.loyalty.awardPaidOrder(orderId);
    }

    return { orderId, status: nextStatus };
  }
}
