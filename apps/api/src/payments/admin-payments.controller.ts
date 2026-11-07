import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PaymentsService } from './payments.service.js';

@Controller('admin/payments')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('reconciliation')
  async listReconciliation(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.paymentsService.listReconciliationPayments(page, limit);
  }
}
