import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { AuthController } from './auth.controller.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
function service(prisma: unknown) {
  return Object.assign(Object.create(AuthService.prototype), {
    prisma,
    jwt: { signAsync: vi.fn().mockResolvedValue('jwt') },
  }) as AuthService;
}
describe('Account', () => {
  it('validates names, Vietnamese phone numbers and rejects profile privilege changes', async () => {
    const options = { whitelist: true, forbidNonWhitelisted: true };
    expect(
      await validate(
        plainToInstance(UpdateProfileDto, {
          name: ' Hưng ',
          phone: '0912345678',
        }),
        options,
      ),
    ).toHaveLength(0);
    for (const payload of [
      { name: '', phone: '123' },
      { name: 'x'.repeat(101), phone: '+84912345678' },
      { name: 'Hưng', phone: '0912345678', role: 'ADMIN' },
    ]) {
      expect(
        (await validate(plainToInstance(UpdateProfileDto, payload), options))
          .length,
      ).toBeGreaterThan(0);
    }
  });
  it('rejects short new passwords', async () => {
    expect(
      (
        await validate(
          plainToInstance(ChangePasswordDto, {
            currentPassword: 'old',
            newPassword: 'short',
            confirmation: 'short',
          }),
        )
      ).length,
    ).toBeGreaterThan(0);
  });
  it('rejects wrong current password or mismatch without updating', async () => {
    const updateMany = vi.fn();
    const user = { passwordHash: await bcrypt.hash('old-password', 4) };
    const auth = service({
      user: { findUnique: vi.fn().mockResolvedValue(user), updateMany },
    });
    await expect(
      auth.changePassword(1, {
        currentPassword: 'wrong',
        newPassword: 'new-password',
        confirmation: 'new-password',
      }),
    ).rejects.toThrow('Mật khẩu hiện tại');
    await expect(
      auth.changePassword(1, {
        currentPassword: 'old-password',
        newPassword: 'new-password',
        confirmation: 'other',
      }),
    ).rejects.toThrow('xác nhận');
    expect(updateMany).not.toHaveBeenCalled();
  });
  it('stores a hash; new password logs in and old password fails', async () => {
    const user = {
      id: 1,
      sessionVersion: 0,
      passwordHash: await bcrypt.hash('old-password', 4),
    };
    const updateMany = vi.fn(async ({ data }) => {
      user.passwordHash = data.passwordHash;
      user.sessionVersion += data.sessionVersion.increment;
      return { count: 1 };
    });
    const auth = service({
      user: { findUnique: vi.fn().mockResolvedValue(user), updateMany },
    });
    const result = await auth.changePassword(1, {
      currentPassword: 'old-password',
      newPassword: 'new-password',
      confirmation: 'new-password',
    });
    expect(JSON.stringify(result)).not.toContain('passwordHash');
    expect(user.passwordHash).not.toBe('new-password');
    expect(user.sessionVersion).toBe(1);
    await expect(auth.isSessionCurrent(1, 0)).resolves.toBe(false);
    await expect(auth.isSessionCurrent(1, 1)).resolves.toBe(true);
    await expect(
      auth.login({ email: 'user@example.com', password: 'new-password' }),
    ).resolves.toEqual({ accessToken: 'jwt' });
    await expect(
      auth.login({ email: 'user@example.com', password: 'old-password' }),
    ).rejects.toThrow('Invalid credentials');
  });
  it('detects concurrent password change', async () => {
    const auth = service({
      user: {
        findUnique: vi.fn().mockResolvedValue({
          passwordHash: await bcrypt.hash('old-password', 4),
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    });
    await expect(
      auth.changePassword(1, {
        currentPassword: 'old-password',
        newPassword: 'new-password',
        confirmation: 'new-password',
      }),
    ).rejects.toThrow('đã thay đổi');
  });
  it('updates only the authenticated profile and allowlists returned fields', async () => {
    const update = vi
      .fn()
      .mockResolvedValue({ id: 7, name: 'Hưng', phone: '0912345678' });
    await service({ user: { update } }).updateProfile(7, {
      name: 'Hưng',
      phone: '0912345678',
    });
    expect(update.mock.calls[0][0]).toMatchObject({
      where: { id: 7 },
      data: { name: 'Hưng', phone: '0912345678' },
    });
    expect(update.mock.calls[0][0].select.passwordHash).toBeUndefined();
    for (const method of ['changePassword', 'updateProfile'] as const)
      expect(
        Reflect.getMetadata('__guards__', AuthController.prototype[method]),
      ).toContain(JwtAuthGuard);
  });
});
