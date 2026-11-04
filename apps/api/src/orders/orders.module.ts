import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { LoyaltyModule } from '../loyalty/loyalty.module.js';
import { ORDERS_STORE } from './orders.contract.js';
import { ORDER_STATE_STORE } from './order-state.contract.js';
import { OrderStatePrismaAdapter } from './order-state.prisma-adapter.js';
import { OrderStateService } from './order-state.service.js';
import { OrdersController } from './orders.controller.js';
import { AdminOrdersController } from './admin-orders.controller.js';
import { OrdersExpirationService } from './orders.expiration.service.js';
import { OrdersHistoryController } from './orders-history.controller.js';
import { ORDERS_HISTORY_STORE } from './orders-history.contract.js';
import { OrdersHistoryPrismaAdapter } from './orders-history.prisma-adapter.js';
import { OrdersHistoryService } from './orders-history.service.js';
import { OrdersPrismaAdapter } from './orders.prisma-adapter.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [AuthModule, LoyaltyModule, PaymentsModule],
  // OrdersHistoryController (GET /orders/me) must come before OrdersController,
  // otherwise GET /orders/:id (ParseIntPipe) captures "me" and returns 400.
  controllers: [
    OrdersHistoryController,
    OrdersController,
    AdminOrdersController,
  ],
  providers: [
    OrdersService,
    OrdersExpirationService,
    { provide: ORDERS_STORE, useClass: OrdersPrismaAdapter },
    OrdersHistoryService,
    { provide: ORDERS_HISTORY_STORE, useClass: OrdersHistoryPrismaAdapter },
    OrderStateService,
    { provide: ORDER_STATE_STORE, useClass: OrderStatePrismaAdapter },
  ],
  exports: [OrdersService, OrderStateService],
})
export class OrdersModule {}
