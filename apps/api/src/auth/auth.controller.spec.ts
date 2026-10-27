import { describe, expect, it, vi } from 'vitest';
import { AuthController } from './auth.controller.js';
import type { AuthService } from './auth.service.js';

describe('AuthController', () => {
  it('register chuyển đúng dữ liệu sang service', async () => {
    const register = vi.fn().mockResolvedValue({ id: 1, email: 'a@example.com' });
    const service = { register, login: vi.fn() } as unknown as AuthService;
    const controller = new AuthController(service);
    const dto = { email: 'a@example.com', password: 'Test1234!' };
    await expect(controller.register(dto)).resolves.toEqual({
      id: 1,
      email: 'a@example.com',
    });
    expect(register).toHaveBeenCalledWith(dto);
  });

  it('login trả accessToken do service cung cấp', async () => {
    const login = vi.fn().mockResolvedValue({ accessToken: 'dummy.jwt.token' });
    const service = { register: vi.fn(), login } as unknown as AuthService;
    const controller = new AuthController(service);
    const dto = { email: 'a@example.com', password: 'Test1234!' };
    await expect(controller.login(dto)).resolves.toEqual({
      accessToken: 'dummy.jwt.token',
    });
    expect(login).toHaveBeenCalledWith(dto);
  });
});