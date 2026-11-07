import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminPaymentsController } from './admin-payments.controller.js';
import { PAYMENT_ORDERS_STORE } from './payments.contract.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsPrismaAdapter } from './payments.prisma-adapter.js';
import { PaymentsService } from './payments.service.js';
import { ZalopayService } from './zalopay.service.js';

@Module({
  imports: [AuthModule],
  controllers: [PaymentsController, AdminPaymentsController],
  providers: [
    PaymentsService,
    ZalopayService,
    { provide: PAYMENT_ORDERS_STORE, useClass: PaymentsPrismaAdapter },
  ],
  exports: [PaymentsService, ZalopayService],
})
export class PaymentsModule {}