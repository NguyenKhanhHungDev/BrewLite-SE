import { AuthModule } from './auth/auth.module.js';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ProductsModule } from './products/products.module.js';

@Module({
<<<<<<< HEAD
  imports: [AuthModule],
=======
  imports: [ProductsModule],
>>>>>>> origin/main
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
