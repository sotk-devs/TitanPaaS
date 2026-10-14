import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;

  beforeEach(() => {
    usersService = new UsersService();
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('mock_jwt_token' as never),
    } as unknown as JwtService;

    authService = new AuthService(usersService, jwtService);
  });

  describe('register', () => {
    it('should register a new user, hash password and return token with user data', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      const result = await authService.register(registerDto);

      expect(result.access_token).toBe('mock_jwt_token');
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.name).toBe('Test User');
      expect((result.user as Record<string, unknown>).password).toBeUndefined();

      const storedUser = await usersService.findByEmail(registerDto.email);
      expect(storedUser).not.toBeNull();
      expect(storedUser?.password).not.toBe(registerDto.password);
      const isMatch = await bcrypt.compare(
        registerDto.password,
        storedUser!.password,
      );
      expect(isMatch).toBe(true);
    });

    it('should throw ConflictException if email is already registered', async () => {
      const registerDto = {
        email: 'duplicate@example.com',
        password: 'password123',
        name: 'User 1',
      };

      await authService.register(registerDto);

      await expect(authService.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const registerDto = {
        email: 'login@example.com',
        password: 'correctpassword',
        name: 'Login User',
      };

      await authService.register(registerDto);

      const result = await authService.login({
        email: 'login@example.com',
        password: 'correctpassword',
      });

      expect(result.access_token).toBe('mock_jwt_token');
      expect(result.user.email).toBe('login@example.com');
      expect((result.user as Record<string, unknown>).password).toBeUndefined();
    });

    it('should throw UnauthorizedException if user is not found', async () => {
      await expect(
        authService.login({
          email: 'nonexistent@example.com',
          password: 'password',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password is incorrect', async () => {
      await authService.register({
        email: 'user@example.com',
        password: 'correctpassword',
        name: 'User',
      });

      await expect(
        authService.login({
          email: 'user@example.com',
          password: 'wrongpassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
