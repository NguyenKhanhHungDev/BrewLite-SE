import { describe, expect, it, vi } from 'vitest';
import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { AdminClaimGuard, AdminGuard } from './admin.guard.js';
import type { AuthService } from './auth.service.js';
import { AuthService as RealAuthService } from './auth.service.js';
import { OrdersController } from '../orders/orders.controller.js';
import { OrdersService } from '../orders/orders.service.js';
import type { OrdersStore } from '../orders/orders.contract.js';

type RequestStub = { user?: { id: number; isAdmin?: boolean } };
function context(request: RequestStub) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}
function setup(role = 'CUSTOMER') {
  const me = vi.fn().mockResolvedValue({ id: 7, role });
  const claims = new AdminClaimGuard({ me } as unknown as AuthService);
  return { me, claims, guard: new AdminGuard(claims) };
}

describe('Database-backed admin guards', () => {
  it('rejects unauthenticated requests with 401 before querying DB', async () => {
    const { guard, me } = setup();
    await expect(guard.canActivate(context({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(me).not.toHaveBeenCalled();
  });
  it('rejects CUSTOMER with 403, overwriting a forged admin flag', async () => {
    const { guard } = setup();
    const request = { user: { id: 7, isAdmin: true } };
    await expect(guard.canActivate(context(request))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(request.user.isAdmin).toBe(false);
  });
  it('allows ADMIN based on current DB role and rechecks demotion', async () => {
    const { guard, me } = setup('ADMIN');
    const request = { user: { id: 7 } };
    await expect(guard.canActivate(context(request))).resolves.toBe(true);
    expect(me).toHaveBeenCalledWith(7);
    me.mockResolvedValue({ id: 7, role: 'CUSTOMER' });
    await expect(guard.canActivate(context(request))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it('propagates deleted-user 401 and DB errors', async () => {
    const { guard, me } = setup('ADMIN');
    me.mockRejectedValueOnce(
      new UnauthorizedException('User no longer exists'),
    );
    await expect(
      guard.canActivate(context({ user: { id: 7 } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    me.mockRejectedValueOnce(new Error('DB unavailable'));
    await expect(
      guard.canActivate(context({ user: { id: 7 } })),
    ).rejects.toThrow('DB unavailable');
  });
  it('enforces customer order ownership while allowing ADMIN lookup', async () => {
    const order = { id: 42 };
    const findOrderForUser = vi
      .fn()
      .mockResolvedValueOnce(order)
      .mockResolvedValueOnce(null);
    const findAdminOrder = vi.fn().mockResolvedValue(order);
    const controller = new OrdersController(
      new OrdersService({
        findOrderForUser,
        findAdminOrder,
      } as unknown as OrdersStore),
    );
    const request = { user: { id: 7, isAdmin: true } };
    await setup().claims.canActivate(context(request));
    await expect(controller.findOne(42, request as never)).resolves.toEqual(
      order,
    );
    await expect(controller.findOne(43, request as never)).rejects.toThrow(
      'Không tìm thấy đơn hàng',
    );
    expect(findOrderForUser).toHaveBeenCalledWith(43, 7);
    expect(findAdminOrder).not.toHaveBeenCalled();
    await setup('ADMIN').claims.canActivate(context(request));
    await expect(controller.findOne(42, request as never)).resolves.toEqual(
      order,
    );
    expect(findAdminOrder).toHaveBeenCalledWith(42);
  });
  it('me selects the current role without exposing passwordHash', async () => {
    const profile = {
      id: 7,
      email: 'test@example.invalid',
      loyaltyPoints: 0,
      role: 'ADMIN',
    };
    const findUnique = vi.fn().mockResolvedValue(profile);
    const service = Object.create(RealAuthService.prototype) as AuthService;
    Object.defineProperty(service, 'prisma', {
      value: { user: { findUnique } },
    });
    await expect(service.me(7)).resolves.toEqual(profile);
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 7 },
      select: {
        id: true,
        email: true,
        name: true,
        loyaltyPoints: true,
        role: true,
      },
    });
    findUnique.mockResolvedValue(null);
    await expect(service.me(7)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
