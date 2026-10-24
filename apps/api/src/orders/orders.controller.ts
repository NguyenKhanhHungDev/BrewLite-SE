import {
  Body,
  Controller,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { OrdersService } from './orders.service.js';

type AuthRequest = Request & { user?: { id?: number } };

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Body() body: unknown, @Req() request: AuthRequest) {
    const userId = request.user?.id;
    if (!userId) {
      throw new UnauthorizedException('JWT required');
    }
    return this.ordersService.create(userId, body);
  }
}
