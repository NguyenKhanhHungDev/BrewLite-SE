import { Module } from '@nestjs/common';
import { PaymentAdminService } from './payment-admin.service.js';
import { PaymentReadDatabase } from './payment-read-database.js';
import { PaymentOperationsController } from './payment-operations.controller.js';
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
  controllers: [
    PaymentOperationsController,
    PaymentsController,
    PaymentDetailsController,
  ],
  providers: [
    PaymentReadDatabase,
    PaymentAdminService,
    PaymentDetailsService,
    PaymentsService,
    ZalopayService,
    { provide: PAYMENT_ORDERS_STORE, useClass: PaymentsPrismaAdapter },
  ],
  exports: [PaymentsService, ZalopayService],
})
export class PaymentsModule {}
