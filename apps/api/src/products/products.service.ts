import { Injectable } from '@nestjs/common';
import { RecipesPrismaAdapter } from '../recipes/recipes.prisma-adapter.js';
import { RecipeMenuService } from './recipe-menu.service.js';

@Injectable()
export class ProductsService extends RecipeMenuService {
  constructor(repository: RecipesPrismaAdapter) {
    super(repository);
  }
}
