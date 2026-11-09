import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { OrderStateService } from './order-state.service.js';
import { OrderCancellationService } from './order-cancellation.service.js';
import { OrdersService } from './orders.service.js';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';

@Controller('admin/orders')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminOrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly orderState: OrderStateService,
    private readonly cancellation: OrderCancellationService,
  ) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('paymentStatus') paymentStatus?: string,
  ) {
    return this.orders.listAdminOrders(
      page,
      limit,
      dateFrom,
      dateTo,
      status,
      search,
      paymentStatus,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.orders.findAdminOrder(id);
  }

  @Post(':id/cancel')
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user: { id: number } },
    @Body() body: unknown,
  ) {
    return this.cancellation.cancel(id, req.user.id, body);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: UpdateOrderStatusDto,
  ) {
    return this.orderState.transition(id, dto.status);
  }
}
