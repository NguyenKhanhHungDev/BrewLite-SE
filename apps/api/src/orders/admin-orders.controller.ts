import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { OrdersService } from './orders.service.js';

@Controller('admin/orders')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.orders.listAdminOrders(page, limit);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.orders.findAdminOrder(id);
  }
}
