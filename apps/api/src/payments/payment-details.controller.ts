import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PaymentDetailsService } from './payment-details.service.js';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentDetailsController {
  constructor(private readonly details: PaymentDetailsService) {}
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
