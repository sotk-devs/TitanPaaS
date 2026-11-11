import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { API_KEY_PREFIX, ApiKeysService } from './api-keys.service.js';
import { ApiKey } from './entities/api-key.entity.js';
import { ApiKeyScope } from './enums/api-key-scope.enum.js';

describe('ApiKeysService', () => {
  let service: ApiKeysService;
  let repository: jest.Mocked<Partial<Repository<ApiKey>>>;
  let usersService: jest.Mocked<Partial<UsersService>>;
  let keyStore: ApiKey[];

  const mockUser: User = {
    id: 'user-uuid-1',
    email: 'dev@titanpaas.dev',
    password: 'hashed-password',
    name: 'Dev User',
    projects: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    keyStore = [];

    repository = {
      create: jest.fn((dto: any) => ({ ...dto }) as ApiKey),
      save: jest.fn(async (entity: any) => {
        const existingIdx = keyStore.findIndex((k) => k.id === entity.id);
        if (existingIdx >= 0) {
          keyStore[existingIdx] = { ...entity, updatedAt: new Date() };
          return keyStore[existingIdx];
        }
        const saved: ApiKey = {
          ...entity,
          id: `key-uuid-${keyStore.length + 1}`,
          revokedAt: entity.revokedAt ?? null,
          lastUsedAt: entity.lastUsedAt ?? null,
          lastUsedIp: entity.lastUsedIp ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        keyStore.push(saved);
        return saved;
      }),
      find: jest.fn(async ({ where }: any) =>
        keyStore.filter((k) => k.userId === where.userId),
      ),
      findOne: jest.fn(async ({ where }: any) => {
        return (
          keyStore.find(
            (k) =>
              (!where.id || k.id === where.id) &&
              (!where.userId || k.userId === where.userId) &&
              (!where.keyHash || k.keyHash === where.keyHash),
          ) || null
        );
      }),
      remove: jest.fn(async (entity: ApiKey) => {
        keyStore = keyStore.filter((k) => k.id !== entity.id);
        return entity;
      }),
    };

    usersService = {
      findById: jest.fn(async (id: string) =>
        id === mockUser.id ? mockUser : null,
      ),
    };

    service = new ApiKeysService(
      repository as unknown as Repository<ApiKey>,
      usersService as unknown as UsersService,
    );
  });

  describe('inferRequiredScopes', () => {
    it('should infer read/write scopes from route path and HTTP method', () => {
      expect(ApiKeysService.inferRequiredScopes('GET', '/projects')).toEqual([
        ApiKeyScope.PROJECTS_READ,
      ]);
      expect(ApiKeysService.inferRequiredScopes('POST', '/projects')).toEqual([
        ApiKeyScope.PROJECTS_WRITE,
      ]);
      expect(
        ApiKeysService.inferRequiredScopes('POST', '/projects/123/deploy'),
      ).toEqual([ApiKeyScope.DEPLOYMENTS_WRITE]);
      expect(
        ApiKeysService.inferRequiredScopes('GET', '/projects/123/env/export'),
      ).toEqual([ApiKeyScope.ENV_READ]);
      expect(
        ApiKeysService.inferRequiredScopes('POST', '/projects/123/env/import'),
      ).toEqual([ApiKeyScope.ENV_WRITE]);
      expect(
        ApiKeysService.inferRequiredScopes('DELETE', '/api-keys/123'),
      ).toEqual([ApiKeyScope.API_KEYS_MANAGE]);
      expect(
        ApiKeysService.inferRequiredScopes('GET', '/auth/profile'),
      ).toEqual([]);
    });
  });

  describe('create, list, update, rotate & revoke', () => {
    it('should create an API key, store only its SHA-256 hash, and return plaintext token once', async () => {
      const created = await service.create(mockUser.id, {
        name: 'CI Deploy Key',
        description: 'GitHub Actions',
        scopes: [
          ApiKeyScope.DEPLOYMENTS_WRITE,
          ApiKeyScope.PROJECTS_READ,
          ApiKeyScope.DEPLOYMENTS_WRITE,
        ],
        expiresInDays: 30,
      });

      expect(created.token.startsWith(API_KEY_PREFIX)).toBe(true);
      expect(created.keyPrefix).toBe(created.token.slice(0, 16));
      expect(created.scopes).toEqual([
        ApiKeyScope.DEPLOYMENTS_WRITE,
        ApiKeyScope.PROJECTS_READ,
      ]);
      expect(created.isActive).toBe(true);
      expect(
        (created as unknown as Record<string, unknown>).keyHash,
      ).toBeUndefined();

      expect(keyStore[0].keyHash).toBe(ApiKeysService.hashKey(created.token));
      expect(keyStore[0].keyHash).not.toBe(created.token);

      const list = await service.findAllByUser(mockUser.id);
      expect(list).toHaveLength(1);
      expect(
        (list[0] as unknown as Record<string, unknown>).token,
      ).toBeUndefined();
    });

    it('should reject past expiration date on creation', async () => {
      await expect(
        service.create(mockUser.id, {
          name: 'Expired',
          scopes: [ApiKeyScope.PROJECTS_READ],
          expiresAt: '2020-01-01T00:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update scopes, rotate token (invalidating old), and soft revoke', async () => {
      const created = await service.create(mockUser.id, {
        name: 'CLI Key',
        scopes: [ApiKeyScope.PROJECTS_READ],
      });

      const updated = await service.update(mockUser.id, created.id, {
        name: 'CLI Key Updated',
        scopes: [ApiKeyScope.PROJECTS_READ, ApiKeyScope.DEPLOYMENTS_WRITE],
      });
      expect(updated.name).toBe('CLI Key Updated');
      expect(updated.scopes).toHaveLength(2);

      const rotated = await service.rotate(mockUser.id, created.id);
      expect(rotated.token).not.toBe(created.token);

      await expect(
        service.authenticateRawKey(created.token, [ApiKeyScope.PROJECTS_READ]),
      ).rejects.toThrow(UnauthorizedException);

      const authUser = await service.authenticateRawKey(
        rotated.token,
        [ApiKeyScope.DEPLOYMENTS_WRITE],
        undefined,
        '127.0.0.1',
      );
      expect(authUser.id).toBe(mockUser.id);
      expect(keyStore[0].lastUsedIp).toBe('127.0.0.1');

      await service.revoke(mockUser.id, created.id);
      expect(await service.findAllByUser(mockUser.id)).toHaveLength(0);
      expect(await service.findAllByUser(mockUser.id, true)).toHaveLength(1);

      await expect(
        service.authenticateRawKey(rotated.token, [ApiKeyScope.PROJECTS_READ]),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw NotFoundException when accessing another user API key', async () => {
      const created = await service.create(mockUser.id, {
        name: 'Private Key',
        scopes: [ApiKeyScope.PROJECTS_READ],
      });

      await expect(
        service.findOneByUser('other-user', created.id),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('authenticateRawKey enforcement', () => {
    it('should enforce scopes and allowedProjectIds restrictions', async () => {
      const projAllowed = '11111111-1111-4111-8111-111111111111';
      const projDenied = '22222222-2222-4222-8222-222222222222';

      const created = await service.create(mockUser.id, {
        name: 'Scoped Deploy Key',
        scopes: [ApiKeyScope.DEPLOYMENTS_WRITE],
        allowedProjectIds: [projAllowed],
      });

      await expect(
        service.authenticateRawKey(
          created.token,
          [ApiKeyScope.PROJECTS_WRITE],
          projAllowed,
        ),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.authenticateRawKey(
          created.token,
          [ApiKeyScope.DEPLOYMENTS_WRITE],
          projDenied,
        ),
      ).rejects.toThrow(ForbiddenException);

      const valid = await service.authenticateRawKey(
        created.token,
        [ApiKeyScope.DEPLOYMENTS_WRITE],
        projAllowed,
      );
      expect(valid.apiKey.id).toBe(created.id);
    });

    it('should allow any scope when FULL_ACCESS (*) is assigned', async () => {
      const created = await service.create(mockUser.id, {
        name: 'Admin Key',
        scopes: [ApiKeyScope.FULL_ACCESS],
      });

      const valid = await service.authenticateRawKey(created.token, [
        ApiKeyScope.API_KEYS_MANAGE,
        ApiKeyScope.DATABASES_WRITE,
      ]);
      expect(valid.id).toBe(mockUser.id);
    });

    it('should reject expired API key', async () => {
      const created = await service.create(mockUser.id, {
        name: 'Temp Key',
        scopes: [ApiKeyScope.PROJECTS_READ],
        expiresInDays: 1,
      });
      keyStore[0].expiresAt = new Date(Date.now() - 1000);

      await expect(
        service.authenticateRawKey(created.token, [ApiKeyScope.PROJECTS_READ]),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
