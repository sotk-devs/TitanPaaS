import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import { User } from '../users/entities/user.entity.js';

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;
  let mockUserStorage: Map<string, User>;

  beforeEach(() => {
    mockUserStorage = new Map<string, User>();

    usersService = {
      create: jest.fn().mockImplementation(async (dto: any) => {
        const normalized = dto.email.toLowerCase().trim();
        if (mockUserStorage.has(normalized)) {
          throw new ConflictException('User with this email already exists');
        }
        const user: User = {
          id: 'mock-uuid',
          email: normalized,
          password: dto.password,
          name: dto.name,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockUserStorage.set(normalized, user);
        return user;
      }),
      findByEmail: jest.fn().mockImplementation(async (email: string) => {
        return mockUserStorage.get(email.toLowerCase().trim()) || null;
      }),
      findById: jest.fn().mockImplementation(async (id: string) => {
        for (const user of mockUserStorage.values()) {
          if (user.id === id) return user;
        }
        return null;
      }),
      findAll: jest.fn().mockImplementation(async () => {
        return Array.from(mockUserStorage.values());
      }),
    } as unknown as UsersService;

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
    beforeEach(async () => {
      await authService.register({
        email: 'login@example.com',
        password: 'securePassword123',
        name: 'Login User',
      });
    });

    it('should login successfully with valid credentials', async () => {
      const loginDto = {
        email: 'login@example.com',
        password: 'securePassword123',
      };

      const result = await authService.login(loginDto);

      expect(result.access_token).toBe('mock_jwt_token');
      expect(result.user.email).toBe('login@example.com');
      expect((result.user as Record<string, unknown>).password).toBeUndefined();
    });

    it('should throw UnauthorizedException if user is not found', async () => {
      const loginDto = {
        email: 'nonexistent@example.com',
        password: 'securePassword123',
      };

      await expect(authService.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if password is incorrect', async () => {
      const loginDto = {
        email: 'login@example.com',
        password: 'wrongPassword',
      };

      await expect(authService.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user registered only via OAuth without password', async () => {
      await usersService.create({
        email: 'oauth-only@example.com',
        password: null,
        name: 'GitHub User',
        githubId: 'gh-12345',
        githubUsername: 'ghuser',
      });

      await expect(
        authService.login({
          email: 'oauth-only@example.com',
          password: 'anyPassword123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
