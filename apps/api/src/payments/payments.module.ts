import { Module } from '@nestjs/common';
import { PaymentDetailsController } from './payment-details.controller.js';
import { PaymentDetailsService } from './payment-details.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { PAYMENT_ORDERS_STORE } from './payments.contract.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsPrismaAdapter } from './payments.prisma-adapter.js';
import { PaymentsService } from './payments.service.js';
import { ZalopayService } from './zalopay.service.js';

@Module({
  imports: [AuthModule],
  controllers: [PaymentsController, PaymentDetailsController],
  providers: [
    PaymentDetailsService,
    PaymentsService,
    ZalopayService,
    { provide: PAYMENT_ORDERS_STORE, useClass: PaymentsPrismaAdapter },
  ],
  exports: [PaymentsService, ZalopayService],
})
export class PaymentsModule {}
