import { Body, Controller, Post, Req, UnauthorizedException, UseGuards, ValidationPipe } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrdersService } from './orders.service.js';

type AuthRequest = Request & { user?: { id?: number } };

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Body(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })) body: CreateOrderDto, @Req() request: AuthRequest) {
    const userId = request.user?.id;
    if (!userId) throw new UnauthorizedException('JWT required');
    return this.ordersService.create(userId, body);
  }
}
