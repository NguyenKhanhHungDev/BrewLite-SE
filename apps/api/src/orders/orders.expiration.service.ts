import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { PaymentsService } from '../payments/payments.service.js';
import { ORDERS_STORE, type OrdersStore } from './orders.contract.js';

@Injectable()
export class OrdersExpirationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrdersExpirationService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @Inject(ORDERS_STORE) private readonly store: OrdersStore,
    private readonly payments: PaymentsService,
  ) {}

  onModuleInit() {
    void this.expireBatch();
    this.timer = setInterval(() => void this.expireBatch(), 60_000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async expireBatch(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      await this.payments.reconcilePendingZalopayBatch(50);
      const count = await this.store.expirePendingOrders(50);
      if (count > 0) {
        this.logger.log(`Released reservations for ${count} expired order(s)`);
      }
      return count;
    } catch (error) {
      this.logger.error(
        'Could not expire pending orders',
        error instanceof Error ? error.stack : String(error),
      );
      return 0;
    } finally {
      this.running = false;
    }
  }
}
