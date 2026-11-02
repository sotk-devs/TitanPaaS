import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<Partial<AuthService>>;

  beforeEach(() => {
    authService = {
      register: jest.fn().mockResolvedValue({
        access_token: 'mock_jwt_token',
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test',
          createdAt: new Date(),
        },
      } as never),
      login: jest.fn().mockResolvedValue({
        access_token: 'mock_jwt_token',
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test',
          createdAt: new Date(),
        },
      } as never),
    };

    controller = new AuthController(authService as unknown as AuthService);
  });

  it('should call authService.register and return the result', async () => {
    const dto = {
      email: 'test@example.com',
      password: 'password123',
      name: 'Test',
    };

    const result = await controller.register(dto);

    expect(authService.register).toHaveBeenCalledWith(dto);
    expect(result.access_token).toBe('mock_jwt_token');
  });

  it('should call authService.login and return the result', async () => {
    const dto = {
      email: 'test@example.com',
      password: 'password123',
    };

    const result = await controller.login(dto);

    expect(authService.login).toHaveBeenCalledWith(dto);
    expect(result.access_token).toBe('mock_jwt_token');
  });

  it('should return user from request in profile', () => {
    const user = { id: '1', email: 'test@example.com', name: 'Test' };
    const result = controller.getProfile({ user });
    expect(result).toEqual(user);
  });
});
