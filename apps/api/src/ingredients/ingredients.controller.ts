import {
  Body,
  Controller,
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
  ) {
    return this.ingredients.restock(id, input.quantity);
  }
}
