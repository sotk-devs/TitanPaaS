import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeysService } from '../../api-keys/api-keys.service.js';
import { ApiKeyScope } from '../../api-keys/enums/api-key-scope.enum.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

describe('JwtAuthGuard', () => {
  let apiKeysService: jest.Mocked<Partial<ApiKeysService>>;
  let reflector: jest.Mocked<Partial<Reflector>>;
  let guard: JwtAuthGuard;

  const createContext = (req: Record<string, any>): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => req,
      }),
      getHandler: () => (() => undefined) as unknown,
      getClass: () => class TestController {},
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    apiKeysService = {
      authenticateRawKey: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'dev@titanpaas.dev',
        name: 'Dev',
        apiKey: { id: 'key-1' },
      } as never),
    };

    reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    };

    guard = new JwtAuthGuard(
      apiKeysService as unknown as ApiKeysService,
      reflector as unknown as Reflector,
    );
  });

  it('should authenticate X-API-Key header with inferred scope and projectId', async () => {
    const req: Record<string, any> = {
      headers: { 'x-api-key': 'tp_live_123456' },
      method: 'POST',
      path: '/projects/proj-1/deploy',
      params: { id: 'proj-1' },
      ip: '10.0.0.1',
    };

    const allowed = await guard.canActivate(createContext(req));

    expect(allowed).toBe(true);
    expect(apiKeysService.authenticateRawKey).toHaveBeenCalledWith(
      'tp_live_123456',
      [ApiKeyScope.DEPLOYMENTS_WRITE],
      'proj-1',
      '10.0.0.1',
    );
    expect(req.user.id).toBe('user-1');
  });

  it('should authenticate Bearer tp_live_... token using explicit metadata scopes', async () => {
    reflector.getAllAndOverride = jest
      .fn()
      .mockReturnValue([ApiKeyScope.API_KEYS_MANAGE]) as any;

    const req: Record<string, any> = {
      headers: { authorization: 'Bearer tp_live_abcdef' },
      method: 'GET',
      path: '/api-keys',
      params: {},
      ip: '127.0.0.1',
    };

    const allowed = await guard.canActivate(createContext(req));

    expect(allowed).toBe(true);
    expect(apiKeysService.authenticateRawKey).toHaveBeenCalledWith(
      'tp_live_abcdef',
      [ApiKeyScope.API_KEYS_MANAGE],
      undefined,
      '127.0.0.1',
    );
  });

  it('should throw UnauthorizedException when API key is used without ApiKeysService', async () => {
    const bareGuard = new JwtAuthGuard();
    const req: Record<string, any> = {
      headers: { 'x-api-key': 'tp_live_123456' },
      method: 'GET',
      path: '/projects',
    };

    await expect(bareGuard.canActivate(createContext(req))).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
