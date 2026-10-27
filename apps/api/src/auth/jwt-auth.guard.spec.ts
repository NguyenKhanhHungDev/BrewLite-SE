import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard.js';

type FakeRequest = {
  headers: { authorization?: string };
  user?: { id: number };
};

function fakeContext(request: FakeRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  it('từ chối khi không có token (401)', async () => {
    const jwt = { verifyAsync: vi.fn() } as unknown as JwtService;
    const guard = new JwtAuthGuard(jwt);
    await expect(guard.canActivate(fakeContext({ headers: {} })))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('từ chối Bearer token sai (401)', async () => {
    const jwt = {
      verifyAsync: vi.fn().mockRejectedValue(new Error('invalid signature')),
    } as unknown as JwtService;
    const guard = new JwtAuthGuard(jwt);
    await expect(guard.canActivate(fakeContext({
      headers: { authorization: 'Bearer bad-token' },
    }))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('từ chối token có sub không hợp lệ (401)', async () => {
    const jwt = {
      verifyAsync: vi.fn().mockResolvedValue({ sub: -1 }),
    } as unknown as JwtService;
    const guard = new JwtAuthGuard(jwt);
    await expect(guard.canActivate(fakeContext({
      headers: { authorization: 'Bearer token' },
    }))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('chấp nhận JWT đúng, lấy sub làm user.id', async () => {
    const jwt = {
      verifyAsync: vi.fn().mockResolvedValue({ sub: 42 }),
    } as unknown as JwtService;
    const request: FakeRequest = {
      headers: { authorization: 'Bearer valid-token' },
    };
    const guard = new JwtAuthGuard(jwt);
    await expect(guard.canActivate(fakeContext(request))).resolves.toBe(true);
    expect(request.user).toEqual({ id: 42 });
  });
});