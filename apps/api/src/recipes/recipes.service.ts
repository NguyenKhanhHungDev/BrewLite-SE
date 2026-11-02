import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateRecipeDto } from './dto/create-recipe.dto.js';
import { UpdateRecipeDto } from './dto/update-recipe.dto.js';
import type { RecipesRepository, RecipesTransaction } from './recipes.contract.js';

// Business validation is shared by HTTP routes and repository-level callers.
export class RecipesService {
  constructor(private readonly repository: RecipesRepository) {}

  findAll() { return this.repository.findAll(); }

  async findOne(id: number) {
    const recipe = await this.repository.findById(id);
    if (!recipe) throw new NotFoundException('Recipe not found');
    return recipe;
  }

  create(input: CreateRecipeDto) {
    const dto = this.validate(CreateRecipeDto, input);
    dto.name = dto.name.trim();
    return this.repository.transaction(async (tx) => {
      await this.checkReferences(tx, dto);
      return tx.create(dto);
    });
  }

  update(id: number, input: UpdateRecipeDto) {
    const dto = this.validate(UpdateRecipeDto, input);
    if (dto.name !== undefined) dto.name = dto.name.trim();
    return this.repository.transaction(async (tx) => {
      if (!await tx.findById(id)) throw new NotFoundException('Recipe not found');
      await this.checkReferences(tx, dto, id);
      return tx.update(id, dto);
    });
  }

  private validate<T extends object>(type: new () => T, input: T): T {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid recipe');
    }
    const dto = plainToInstance(type, input);
    if (validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).length) {
      throw new BadRequestException('Invalid recipe');
    }
    return dto;
  }

  private async checkReferences(tx: RecipesTransaction, input: UpdateRecipeDto, id?: number) {
    if (input.name !== undefined) {
      const existing = await tx.findByName(input.name);
      if (existing && existing.id !== id) throw new ConflictException('Recipe name already exists');
    }
    if (input.ingredients && !await tx.ingredientIdsExist(input.ingredients.map((item) => item.ingredientId))) {
      throw new BadRequestException('Ingredient not found');
    }
  }
}
