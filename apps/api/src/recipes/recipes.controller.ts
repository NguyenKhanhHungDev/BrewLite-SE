import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreateRecipeDto } from './dto/create-recipe.dto.js';
import { UpdateRecipeDto } from './dto/update-recipe.dto.js';
import type { RecipeRecord } from './recipes.contract.js';
import { RecipesService } from './recipes.service.js';

function response(recipe: RecipeRecord) {
  return {
    id: recipe.id,
    name: recipe.name,
    price: recipe.price,
    imageUrl: recipe.imageUrl,
    isActive: recipe.isActive,
    ingredients: recipe.ingredients.map(
      ({ ingredientId, quantity, ingredient }) => ({
        ingredientId,
        quantity,
        name: ingredient.name,
        unit: ingredient.unit,
      }),
    ),
  };
}

@Controller('recipes')
@UseGuards(JwtAuthGuard, AdminGuard)
export class RecipesController {
  constructor(private readonly recipes: RecipesService) {}

  @Get()
  async findAll() {
    return (await this.recipes.findAll()).map(response);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return response(await this.recipes.findOne(id));
  }

  @Post()
  async create(@Body() input: CreateRecipeDto) {
    return response(await this.recipes.create(input));
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() input: UpdateRecipeDto,
  ) {
    return response(await this.recipes.update(id, input));
  }
}
