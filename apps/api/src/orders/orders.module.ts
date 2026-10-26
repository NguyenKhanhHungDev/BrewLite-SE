import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { LoyaltyModule } from '../loyalty/loyalty.module.js';
import { ORDERS_STORE } from './orders.contract.js';
import { ORDER_STATE_STORE } from './order-state.contract.js';
import { OrderStatePrismaAdapter } from './order-state.prisma-adapter.js';
import { OrderStateService } from './order-state.service.js';
import { OrdersController } from './orders.controller.js';
import { OrdersHistoryController } from './orders-history.controller.js';
import { ORDERS_HISTORY_STORE } from './orders-history.contract.js';
import { OrdersHistoryPrismaAdapter } from './orders-history.prisma-adapter.js';
import { OrdersHistoryService } from './orders-history.service.js';
import { OrdersPrismaAdapter } from './orders.prisma-adapter.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [AuthModule, LoyaltyModule],
  controllers: [OrdersController, OrdersHistoryController],
  providers: [
    OrdersService,
    { provide: ORDERS_STORE, useClass: OrdersPrismaAdapter },
    OrdersHistoryService,
    { provide: ORDERS_HISTORY_STORE, useClass: OrdersHistoryPrismaAdapter },
    OrderStateService,
    { provide: ORDER_STATE_STORE, useClass: OrderStatePrismaAdapter },
  ],
  exports: [OrdersService, OrderStateService],
})
export class OrdersModule {}
