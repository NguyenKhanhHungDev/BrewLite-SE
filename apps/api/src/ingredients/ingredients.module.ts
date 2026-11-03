import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { IngredientsController } from './ingredients.controller.js';
import { IngredientsService } from './ingredients.service.js';

@Module({
  imports: [AuthModule],
  controllers: [IngredientsController],
  providers: [IngredientsService],
})
export class IngredientsModule {}
