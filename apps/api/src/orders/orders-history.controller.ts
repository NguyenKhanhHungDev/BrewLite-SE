import {
  Controller,
  Get,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { OrdersHistoryService } from './orders-history.service.js';

type AuthRequest = Request & { user?: { id?: number } };

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersHistoryController {
  constructor(private readonly history: OrdersHistoryService) {}

  @Get('me')
  findMine(@Req() request: AuthRequest) {
    const userId = request.user?.id;
    if (!userId) throw new UnauthorizedException('JWT required');
    return this.history.findMine(userId);
  }
}
