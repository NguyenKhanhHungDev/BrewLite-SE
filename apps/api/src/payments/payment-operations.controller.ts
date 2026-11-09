import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { PaymentAdminService } from './payment-admin.service.js';
import { PaymentsService } from './payments.service.js';

@Controller('payments/admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class PaymentOperationsController {
  constructor(
    private readonly details: PaymentAdminService,
    private readonly payments: PaymentsService,
  ) {}
  @Get('reconciliation')
  reconciliation(@Query('page') raw?: string) {
    if (raw !== undefined && !/^[1-9]\d*$/.test(raw))
      throw new BadRequestException('Trang không hợp lệ.');
    const page = Number(raw ?? 1);
    if (!Number.isSafeInteger(page) || page > 1000000)
      throw new BadRequestException('Trang không hợp lệ.');
    return this.details.reconciliation(page);
  }

  private assertId(id: number) {
    if (id < 1 || id > 2147483647)
      throw new BadRequestException('Mã giao dịch không hợp lệ.');
  }
  @Get('transactions')
  list(@Query() query: Record<string, unknown>) {
    return this.details.adminTransactions(query);
  }
  @Get('transactions/:id')
  detail(@Param('id', ParseIntPipe) id: number) {
    this.assertId(id);
    return this.details.adminTransaction(id);
  }
  @Patch('transactions/:id/note')
  note(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user: { id: number } },
    @Body() body: unknown,
  ) {
    this.assertId(id);
    return this.details.saveAdminNote(id, req.user.id, body);
  }
  @Post('transactions/:id/recheck')
  async recheck(@Param('id', ParseIntPipe) id: number) {
    this.assertId(id);
    const attempt = await this.details.adminTransaction(id);
    const result = await this.payments.recheckAdminAttempt(attempt);
    return { ...result, payment: await this.details.adminTransaction(id) };
  }
}
