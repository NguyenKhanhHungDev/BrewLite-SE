import { AuthThrottleGuard } from './auth-throttle.guard.js';
import {
  Body,
  Controller,
  Patch,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UseGuards(AuthThrottleGuard)
  register(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: RegisterDto,
  ) {
    return this.authService.register(dto);
  }

  @Post('login')
  @UseGuards(AuthThrottleGuard)
  @HttpCode(HttpStatus.OK)
  login(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: LoginDto,
  ) {
    return this.authService.login(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  logout(@Req() request: Request & { user?: { id: number } }) {
    if (!request.user) throw new UnauthorizedException('JWT required');
    return this.authService.logout(request.user.id);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, AuthThrottleGuard)
  changePassword(
    @Req() request: Request & { user?: { id: number } },
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: ChangePasswordDto,
  ) {
    if (!request.user) throw new UnauthorizedException('JWT required');
    return this.authService.changePassword(request.user.id, dto);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateProfile(
    @Req() request: Request & { user?: { id: number } },
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )
    dto: UpdateProfileDto,
  ) {
    if (!request.user) throw new UnauthorizedException('JWT required');
    return this.authService.updateProfile(request.user.id, dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() request: Request & { user?: { id: number } }) {
    if (!request.user) throw new UnauthorizedException('JWT required');
    return this.authService.me(request.user.id);
  }
}
