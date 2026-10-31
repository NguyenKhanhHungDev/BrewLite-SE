import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PaymentsService } from './payments.service.js';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  pay(
    @Req() request: Request & { user?: { id: number } },
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: unknown,
  ) {
    if (!request.user || typeof request.user.id !== 'number') {
      throw new UnauthorizedException('JWT required');
    }
    return this.paymentsService.pay(request.user.id, idempotencyKey, body);
  }

  @Post('vnpay/create')
  @UseGuards(JwtAuthGuard)
  createVnpayPayment(
    @Req() request: Request & { user?: { id: number } },
    @Body() body: unknown,
  ) {
    if (!request.user || typeof request.user.id !== 'number') {
      throw new UnauthorizedException('JWT required');
    }
    const forwarded = request.headers['x-forwarded-for'];
    const ip =
      typeof forwarded === 'string'
        ? forwarded.split(',')[0]!.trim()
        : request.ip || '127.0.0.1';
    return this.paymentsService.createVnpayPayment(request.user.id, body, ip);
  }

  @Get('vnpay/ipn')
  handleVnpayIpn(@Query() query: Record<string, unknown>) {
    return this.paymentsService.handleVnpayIpn(query);
  }

  @Get(':orderId/status')
  @UseGuards(JwtAuthGuard)
  getOrderPaymentStatus(
    @Req() request: Request & { user?: { id: number } },
    @Param('orderId') orderId: string,
  ) {
    if (!request.user || typeof request.user.id !== 'number') {
      throw new UnauthorizedException('JWT required');
    }
    return this.paymentsService.getOrderPaymentStatus(
      request.user.id,
      Number(orderId),
    );
  }
}