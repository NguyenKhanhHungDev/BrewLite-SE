import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RecipesController } from './recipes.controller.js';
import { RecipesPrismaAdapter } from './recipes.prisma-adapter.js';
import { RecipesService } from './recipes.service.js';

@Module({
  imports: [AuthModule],
  controllers: [RecipesController],
  providers: [
    RecipesPrismaAdapter,
    {
      provide: RecipesService,
      useFactory: (repository: RecipesPrismaAdapter) =>
        new RecipesService(repository),
      inject: [RecipesPrismaAdapter],
    },
  ],
  exports: [RecipesPrismaAdapter],
})
export class RecipesModule {}
