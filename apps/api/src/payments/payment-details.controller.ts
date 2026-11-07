import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { PaymentDetailsService } from './payment-details.service.js';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentDetailsController {
  constructor(private readonly details: PaymentDetailsService) {}
  @Get('admin/reconciliation')
  @UseGuards(AdminGuard)
  reconciliation(@Query('page') raw?: string) {
    if (raw !== undefined && !/^[1-9]\d*$/.test(raw))
      throw new BadRequestException('Trang không hợp lệ.');
    const page = Number(raw ?? 1);
    if (!Number.isSafeInteger(page) || page > 1000000)
      throw new BadRequestException('Trang không hợp lệ.');
    return this.details.reconciliation(page);
  }
  @Get(':orderId/details')
  forOrder(
    @Req() req: { user: { id: number } },
    @Param('orderId', ParseIntPipe) orderId: number,
  ) {
    if (orderId < 1 || orderId > 2147483647)
      throw new BadRequestException('Mã đơn không hợp lệ.');
    return this.details.forOrder(req.user.id, orderId);
  }
}
