import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';
import type { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: { id: number } }>();
    const authorization = request.headers.authorization;
    const [scheme, token] = authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing token');
    }
    try {
      const payload = await this.jwt.verifyAsync<{
        sub: number;
        sessionVersion?: number;
      }>(token);
      if (!Number.isInteger(payload.sub) || payload.sub <= 0) {
        throw new UnauthorizedException('Invalid token');
      }
      // Tokens issued before this migration belong to version zero.
      const version = payload.sessionVersion ?? 0;
      if (
        !Number.isInteger(version) ||
        version < 0 ||
        !(await this.auth.isSessionCurrent(payload.sub, version))
      ) {
        throw new UnauthorizedException('Session revoked');
      }
      request.user = { id: payload.sub };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
