import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PAYMENT_ORDERS_STORE } from './payments.contract.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsPrismaAdapter } from './payments.prisma-adapter.js';
import { PaymentsService } from './payments.service.js';
import { VnpayService } from './vnpay.service.js';

@Module({
  imports: [AuthModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    VnpayService,
    { provide: PAYMENT_ORDERS_STORE, useClass: PaymentsPrismaAdapter },
  ],
  exports: [PaymentsService, VnpayService],
})
export class PaymentsModule {}