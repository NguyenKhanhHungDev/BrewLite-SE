import {
  Body,
  Controller,
  Delete,
  Headers,
  Query,
  Req,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreateIngredientDto } from './dto/create-ingredient.dto.js';
import { UpdateIngredientDto } from './dto/update-ingredient.dto.js';
import { RestockIngredientDto } from './dto/restock-ingredient.dto.js';
import { AdjustIngredientDto } from './dto/adjust-ingredient.dto.js';
import { InventoryHistoryQueryDto } from './dto/inventory-history-query.dto.js';
import { IngredientsService } from './ingredients.service.js';

@Controller('ingredients')
@UseGuards(JwtAuthGuard, AdminGuard)
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class IngredientsController {
  constructor(private readonly ingredients: IngredientsService) {}

  @Get()
  findAll() {
    return this.ingredients.findAll();
  }

  @Post()
  create(@Body() input: CreateIngredientDto) {
    return this.ingredients.create(input);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() input: UpdateIngredientDto,
  ) {
    return this.ingredients.update(id, input);
  }

  @Post(':id/restock')
  restock(
    @Param('id', ParseIntPipe) id: number,
    @Body() input: RestockIngredientDto,
    @Req() req: { user: { id: number } },
    @Headers('idempotency-key') key?: string,
  ) {
    return this.ingredients.restock(
      id,
      input.quantity,
      req.user.id,
      input.reason,
      key,
    );
  }
  @Post(':id/adjust')
  adjust(
    @Param('id', ParseIntPipe) id: number,
    @Body() input: AdjustIngredientDto,
    @Req() req: { user: { id: number } },
    @Headers('idempotency-key') key?: string,
  ) {
    return this.ingredients.adjust(id, input, req.user.id, key);
  }

  @Get(':id/movements')
  movements(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: InventoryHistoryQueryDto,
  ) {
    return this.ingredients.movements(id, query.page ?? 1);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.ingredients.remove(id);
  }
}
