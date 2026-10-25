import { Module } from '@nestjs/common';
import { PAYMENT_ORDERS_STORE } from './payments.contract.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsPendingAdapter } from './payments.pending-adapter.js';
import { PaymentsService } from './payments.service.js';

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    { provide: PAYMENT_ORDERS_STORE, useClass: PaymentsPendingAdapter },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}