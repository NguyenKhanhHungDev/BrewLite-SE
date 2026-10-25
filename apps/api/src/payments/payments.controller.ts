import { Body, Controller, Post } from '@nestjs/common';
import { PaymentsService } from './payments.service.js';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  pay(@Body() body: unknown) {
    return this.paymentsService.pay(body);
  }
}