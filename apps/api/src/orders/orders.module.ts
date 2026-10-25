import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ORDERS_STORE } from './orders.contract.js';
import { OrdersController } from './orders.controller.js';
import { OrdersPrismaAdapter } from './orders.prisma-adapter.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [AuthModule],
  controllers: [OrdersController],
  providers: [OrdersService, { provide: ORDERS_STORE, useClass: OrdersPrismaAdapter }],
  exports: [OrdersService],
})
export class OrdersModule {}
