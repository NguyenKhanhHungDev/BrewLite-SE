import {
  Body,
  Controller,
  Headers,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PaymentsService } from './payments.service.js';

interface AuthenticatedRequest {
  user?: {
    id?: number;
    userId?: number;
    sub?: number;
  };
}

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  pay(
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.userId ?? req.user?.id ?? req.user?.sub;
    return this.paymentsService.pay(body, idempotencyKey, userId);
  }
}