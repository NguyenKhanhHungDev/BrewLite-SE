import { Module } from '@nestjs/common';
import { ORDERS_STORE } from './orders.contract.js';
import { OrdersController } from './orders.controller.js';
import { OrdersPendingAdapter } from './orders.pending-adapter.js';
import { OrdersService } from './orders.service.js';

@Module({
  controllers: [OrdersController],
  providers: [
    OrdersService,
    { provide: ORDERS_STORE, useClass: OrdersPendingAdapter },
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
