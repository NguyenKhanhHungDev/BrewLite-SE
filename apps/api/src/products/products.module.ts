import { Module } from '@nestjs/common';
import { RecipesModule } from '../recipes/recipes.module.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';

@Module({
  imports: [RecipesModule],
  controllers: [ProductsController],
  providers: [ProductsService]
})
export class ProductsModule {}
