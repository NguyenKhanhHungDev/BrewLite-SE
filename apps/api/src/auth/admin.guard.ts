import {
  Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';

type AuthRequest = Request & { user?: { id: number; isAdmin?: boolean } };

// Resolve the database role while allowing customers to view their own orders.
@Injectable()
export class AdminClaimGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const user = request.user;
    if (!user || !Number.isInteger(user.id) || user.id <= 0) {
      throw new UnauthorizedException('Chưa xác thực người dùng.');
    }
    // Never trust an isAdmin flag or role supplied by the client/token.
    user.isAdmin = false;
    const profile = await this.auth.me(user.id);
    user.isAdmin = profile.role === 'ADMIN';
    return true;
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly claims: AdminClaimGuard) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    await this.claims.canActivate(context);
    const request = context.switchToHttp().getRequest<AuthRequest>();
    if (!request.user?.isAdmin) {
      throw new ForbiddenException('Bạn không có quyền truy cập chức năng Admin.');
    }
    return true;
  }
}
