import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { DomainsController } from './domains.controller.js';
import { DomainsService } from './domains.service.js';
import { DomainStatus } from './enums/domain-status.enum.js';

describe('DomainsController', () => {
  let controller: DomainsController;
  let mockDomainsService: jest.Mocked<Partial<DomainsService>>;

  const mockUser = {
    id: 'user-uuid-1',
    email: 'dev@titan.com',
    name: 'Developer',
  };
  const mockReq = { user: mockUser };
  const projectId = 'project-uuid-1';
  const domainId = 'domain-uuid-1';

  const mockDomain = {
    id: domainId,
    domain: 'my-app.com',
    projectId,
    status: DomainStatus.VERIFIED,
    verificationError: null,
    verifiedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockDomainsService = {
      create: jest.fn<any>().mockResolvedValue(mockDomain),
      findAllByProject: jest.fn<any>().mockResolvedValue([mockDomain]),
      findOne: jest.fn<any>().mockResolvedValue(mockDomain),
      verify: jest.fn<any>().mockResolvedValue(mockDomain),
      remove: jest.fn<any>().mockResolvedValue({
        message: 'Dominio personalizado "my-app.com" eliminado exitosamente.',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DomainsController],
      providers: [
        {
          provide: DomainsService,
          useValue: mockDomainsService,
        },
      ],
    }).compile();

    controller = module.get<DomainsController>(DomainsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call service.create with user ID, project ID, and DTO', async () => {
      const dto = { domain: 'my-app.com' };
      const result = await controller.create(mockReq as any, projectId, dto);

      expect(mockDomainsService.create).toHaveBeenCalledWith(
        mockUser.id,
        projectId,
        dto,
      );
      expect(result).toEqual(mockDomain);
    });
  });

  describe('findAllByProject', () => {
    it('should call service.findAllByProject with user ID and project ID', async () => {
      const result = await controller.findAllByProject(
        mockReq as any,
        projectId,
      );

      expect(mockDomainsService.findAllByProject).toHaveBeenCalledWith(
        mockUser.id,
        projectId,
      );
      expect(result).toEqual([mockDomain]);
    });
  });

  describe('findOne', () => {
    it('should call service.findOne with user ID and domain ID', async () => {
      const result = await controller.findOne(mockReq as any, domainId);

      expect(mockDomainsService.findOne).toHaveBeenCalledWith(
        mockUser.id,
        domainId,
      );
      expect(result).toEqual(mockDomain);
    });
  });

  describe('verify', () => {
    it('should call service.verify with user ID and domain ID', async () => {
      const result = await controller.verify(mockReq as any, domainId);

      expect(mockDomainsService.verify).toHaveBeenCalledWith(
        mockUser.id,
        domainId,
      );
      expect(result).toEqual(mockDomain);
    });
  });

  describe('remove', () => {
    it('should call service.remove with user ID and domain ID', async () => {
      const result = await controller.remove(mockReq as any, domainId);

      expect(mockDomainsService.remove).toHaveBeenCalledWith(
        mockUser.id,
        domainId,
      );
      expect(result).toHaveProperty('message');
    });
  });
});
