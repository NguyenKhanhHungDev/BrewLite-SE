import * as dotenv from 'dotenv';
dotenv.config();
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

const secret = process.env.JWT_SECRET;
if (!secret) throw new Error('JWT_SECRET is missing');

@Module({
  imports: [JwtModule.register({
    secret,
    signOptions: { expiresIn: '1h' },
  })],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [JwtModule, JwtAuthGuard],
})
export class AuthModule {}