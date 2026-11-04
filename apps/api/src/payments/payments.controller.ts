import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PaymentsService } from './payments.service.js';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('zalopay/create')
  @UseGuards(JwtAuthGuard)
  async createZalopayPayment(
    @Req()
    request: Request & {
      user?: { id?: number; userId?: number; sub?: number };
    },
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId =
      request.user?.id ?? request.user?.userId ?? request.user?.sub;
    if (typeof userId !== 'number') {
      throw new UnauthorizedException('JWT required');
    }

    const result = await this.paymentsService.createZalopayPayment(
      userId,
      idempotencyKey,
      body,
    );
    res.status(result.httpStatus);
    return result.body;
  }

  @Post('zalopay/callback')
  @HttpCode(200)
  async handleZalopayCallback(@Body() body: unknown) {
    return this.paymentsService.handleZalopayCallback(body);
  }

  @Get(':orderId/status')
  @UseGuards(JwtAuthGuard)
  async getOrderPaymentStatus(
    @Req()
    request: Request & {
      user?: { id?: number; userId?: number; sub?: number };
    },
    @Param('orderId') orderId: string,
  ) {
    const userId =
      request.user?.id ?? request.user?.userId ?? request.user?.sub;
    if (typeof userId !== 'number') {
      throw new UnauthorizedException('JWT required');
    }
    return this.paymentsService.getOrderPaymentStatus(userId, Number(orderId));
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  rejectLegacyMockPayment() {
    return this.paymentsService.rejectDeprecatedPaymentEndpoint(
      'POST /payments (mock)',
    );
  }

  @Post('vnpay/create')
  @UseGuards(JwtAuthGuard)
  rejectLegacyVnpayCreate() {
    return this.paymentsService.rejectDeprecatedPaymentEndpoint(
      'POST /payments/vnpay/create',
    );
  }

  @Get('vnpay/ipn')
  rejectLegacyVnpayIpn(@Query() _query: Record<string, unknown>) {
    return this.paymentsService.rejectDeprecatedPaymentEndpoint(
      'GET /payments/vnpay/ipn',
    );
  }
}