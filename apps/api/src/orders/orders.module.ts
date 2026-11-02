import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminClaimGuard, AdminGuard } from '../auth/admin.guard.js';
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
  imports: [AuthModule, LoyaltyModule],
  controllers: [OrdersController, OrdersHistoryController, AdminOrdersController],
  providers: [
    OrdersService,
    OrdersExpirationService,
    AdminGuard,
    AdminClaimGuard,
    { provide: ORDERS_STORE, useClass: OrdersPrismaAdapter },
    OrdersHistoryService,
    { provide: ORDERS_HISTORY_STORE, useClass: OrdersHistoryPrismaAdapter },
    OrderStateService,
    { provide: ORDER_STATE_STORE, useClass: OrderStatePrismaAdapter },
  ],
  exports: [OrdersService, OrderStateService],
})
export class OrdersModule {}
