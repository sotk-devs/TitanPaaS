import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { ApiKeysController } from './api-keys.controller.js';
import { ApiKeysService } from './api-keys.service.js';
import { ApiKeyScope } from './enums/api-key-scope.enum.js';

describe('ApiKeysController', () => {
  let controller: ApiKeysController;
  let service: jest.Mocked<Partial<ApiKeysService>>;

  const mockReq = {
    user: { id: 'user-1', email: 'dev@titanpaas.dev', name: 'Dev' },
  };

  beforeEach(() => {
    service = {
      listAvailableScopes: jest
        .fn()
        .mockReturnValue([
          { scope: ApiKeyScope.PROJECTS_READ, description: 'Read projects' },
        ]),
      create: jest.fn().mockResolvedValue({
        id: 'key-1',
        name: 'CI Key',
        token: 'tp_live_mock',
      } as never),
      findAllByUser: jest.fn().mockResolvedValue([] as never),
      findOneByUser: jest.fn().mockResolvedValue({ id: 'key-1' } as never),
      update: jest.fn().mockResolvedValue({ id: 'key-1' } as never),
      rotate: jest.fn().mockResolvedValue({
        id: 'key-1',
        token: 'tp_live_rotated',
      } as never),
      revoke: jest.fn().mockResolvedValue({
        revoked: true,
        id: 'key-1',
        permanent: false,
      } as never),
    };

    controller = new ApiKeysController(service as unknown as ApiKeysService);
  });

  it('should list available scopes', () => {
    const scopes = controller.listScopes();
    expect(service.listAvailableScopes).toHaveBeenCalled();
    expect(scopes).toHaveLength(1);
  });

  it('should create, list, inspect, update, rotate and revoke API keys', async () => {
    const created = await controller.create(mockReq, {
      name: 'CI Key',
      scopes: [ApiKeyScope.DEPLOYMENTS_WRITE],
    });
    expect(created.token).toBe('tp_live_mock');

    await controller.findAll(mockReq, 'true');
    expect(service.findAllByUser).toHaveBeenCalledWith('user-1', true);

    await controller.findOne(mockReq, 'key-1');
    expect(service.findOneByUser).toHaveBeenCalledWith('user-1', 'key-1');

    await controller.update(mockReq, 'key-1', { name: 'Updated' });
    expect(service.update).toHaveBeenCalledWith('user-1', 'key-1', {
      name: 'Updated',
    });

    const rotated = await controller.rotate(mockReq, 'key-1');
    expect(rotated.token).toBe('tp_live_rotated');

    const revoked = await controller.revoke(mockReq, 'key-1', 'false');
    expect(service.revoke).toHaveBeenCalledWith('user-1', 'key-1', false);
    expect(revoked.revoked).toBe(true);
  });
});
