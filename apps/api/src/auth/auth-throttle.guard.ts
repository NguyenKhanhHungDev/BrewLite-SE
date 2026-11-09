import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import type { Request, Response } from 'express';

type Counter = { count: number; until: number };
function normalizeIp(value: string): string {
  const ip = value.toLowerCase().replace(/^::ffff:(?=\d+\.)/, '');
  // Canonicalize equivalent IPv6 spellings to prevent alternate bucket keys.
  if (isIP(ip) === 6) return new URL(`http://[${ip}]/`).hostname;
  return isIP(ip) ? ip : 'unknown';
}
function clientIp(request: Request): string {
  const expected = process.env.BFF_PROXY_SECRET;
  const actual = request.headers['x-brewlite-proxy-secret'];
  const forwarded = request.headers['x-brewlite-client-ip'];
  if (expected && typeof actual === 'string' && typeof forwarded === 'string' &&
    Buffer.byteLength(actual) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(actual), Buffer.from(expected)) && isIP(forwarded)) {
    return normalizeIp(forwarded);
  }
  return normalizeIp(request.socket.remoteAddress ?? '');
}

/** Single-instance limiter. Multiple API replicas require a shared atomic store. */
@Injectable()
export class AuthThrottleGuard implements CanActivate {
  private readonly counters = new Map<string, Counter>();
  private nextCleanup = 0;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: { id: number } }>();
    const response = context.switchToHttp().getResponse<Response>();
    const action = context.getHandler().name;
    const now = Date.now();
    if (now >= this.nextCleanup) {
      for (const [key, entry] of this.counters) if (entry.until <= now) this.counters.delete(key);
      this.nextCleanup = now + 60_000;
    }
    const ip = clientIp(request);
    const limits: [string, number][] = [];
    if (action === 'login') {
      const raw: unknown = request.body?.email;
      const email = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
      // Hash arbitrary account input so no email/password is retained in counters.
      const account = createHash('sha256').update(email).digest('hex');
      limits.push([`login-ip:${ip}`, 10], [`login-pair:${ip}:${account}`, 5]);
    } else if (action === 'register') limits.push([`register:${ip}`, 5]);
    else if (action === 'changePassword') limits.push([`password:${request.user?.id}`, 5]);
    else return true;

    const reject = (seconds: number): never => {
      response.setHeader('Retry-After', Math.max(1, seconds));
      throw new HttpException('Too many authentication attempts. Vui lòng thử lại sau.', HttpStatus.TOO_MANY_REQUESTS);
    };
    for (const [key, max] of limits) {
      const entry = this.counters.get(key);
      if (entry && entry.until > now && entry.count >= max) reject(Math.ceil((entry.until - now) / 1000));
    }
    const additions = limits.filter(([key]) => !this.counters.has(key)).length;
    // Fail closed, never evict active buckets (which would allow limit bypass).
    if (this.counters.size + additions > 5000) reject(60);
    for (const [key] of limits) {
      const entry = this.counters.get(key);
      if (!entry || entry.until <= now) this.counters.set(key, { count: 1, until: now + 60_000 });
      else entry.count++;
    }
    return true;
  }
}
