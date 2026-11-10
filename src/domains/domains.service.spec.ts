import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { DomainsService } from './domains.service.js';
import { CustomDomain } from './entities/custom-domain.entity.js';
import { Project } from '../projects/entities/project.entity.js';
import { DomainStatus } from './enums/domain-status.enum.js';
import { DnsService } from './dns.service.js';
import { DockerPipelineService } from '../deployment/docker-pipeline.service.js';

describe('DomainsService', () => {
  let service: DomainsService;
  let mockDomainRepo: jest.Mocked<Partial<Repository<CustomDomain>>>;
  let mockProjectRepo: jest.Mocked<Partial<Repository<Project>>>;
  let mockDnsService: jest.Mocked<Partial<DnsService>>;
  let mockDockerPipeline: jest.Mocked<Partial<DockerPipelineService>>;

  const userId = 'user-uuid-1';
  const projectId = 'project-uuid-1';
  const domainId = 'domain-uuid-1';

  const mockProject: Project = {
    id: projectId,
    name: 'sample-project',
    repositoryUrl: 'https://github.com/org/repo.git',
    repositoryName: 'org/repo',
    branch: 'main',
    port: 3000,
    envVariables: {},
    userId,
    user: null as any,
    deployments: [],
    customDomains: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCustomDomain: CustomDomain = {
    id: domainId,
    domain: 'my-custom-domain.com',
    projectId,
    project: mockProject,
    status: DomainStatus.VERIFIED,
    verificationError: null,
    verifiedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockDomainRepo = {
      create: jest.fn<any>().mockImplementation((dto: any) => ({
        id: domainId,
        ...dto,
      })),
      save: jest
        .fn<any>()
        .mockImplementation((entity: any) => Promise.resolve(entity)),
      findOne: jest.fn<any>(),
      find: jest.fn<any>(),
      remove: jest
        .fn<any>()
        .mockImplementation((entity: any) => Promise.resolve(entity)),
    };

    mockProjectRepo = {
      findOne: jest.fn<any>().mockResolvedValue(mockProject),
    };

    mockDnsService = {
      verify: jest.fn<any>().mockResolvedValue({
        verified: true,
        expectedCname: 'sample-project.localhost',
      }),
    };

    mockDockerPipeline = {
      generateSubdomain: jest.fn<any>().mockReturnValue('sample-project'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DomainsService,
        {
          provide: getRepositoryToken(CustomDomain),
          useValue: mockDomainRepo,
        },
        {
          provide: getRepositoryToken(Project),
          useValue: mockProjectRepo,
        },
        {
          provide: DnsService,
          useValue: mockDnsService,
        },
        {
          provide: DockerPipelineService,
          useValue: mockDockerPipeline,
        },
      ],
    }).compile();

    service = module.get<DomainsService>(DomainsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should successfully register a domain in VERIFIED status if DNS check passes', async () => {
      mockDomainRepo.findOne?.mockResolvedValue(null);

      const result = await service.create(userId, projectId, {
        domain: 'my-custom-domain.com',
      });

      expect(mockProjectRepo.findOne).toHaveBeenCalledWith({
        where: { id: projectId, userId },
      });
      expect(mockDnsService.verify).toHaveBeenCalledWith(
        'my-custom-domain.com',
        'sample-project.localhost',
        undefined,
      );
      expect(mockDomainRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: 'my-custom-domain.com',
          projectId,
          status: DomainStatus.VERIFIED,
          verificationError: null,
        }),
      );
      expect(result.status).toBe(DomainStatus.VERIFIED);
    });

    it('should register a domain in PENDING status if DNS check fails', async () => {
      mockDomainRepo.findOne?.mockResolvedValue(null);
      mockDnsService.verify?.mockResolvedValueOnce({
        verified: false,
        expectedCname: 'sample-project.localhost',
        error: 'CNAME record missing',
      });

      const result = await service.create(userId, projectId, {
        domain: 'pending-domain.com',
      });

      expect(result.status).toBe(DomainStatus.PENDING);
      expect(result.verificationError).toBe('CNAME record missing');
      expect(result.verifiedAt).toBeNull();
    });

    it('should throw NotFoundException if project does not exist or user is unauthorized', async () => {
      mockProjectRepo.findOne?.mockResolvedValueOnce(null);

      await expect(
        service.create(userId, 'invalid-project-id', {
          domain: 'app.com',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if domain is already registered', async () => {
      mockDomainRepo.findOne?.mockResolvedValueOnce(mockCustomDomain);

      await expect(
        service.create(userId, projectId, {
          domain: 'my-custom-domain.com',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAllByProject', () => {
    it('should return all custom domains for a project', async () => {
      mockDomainRepo.find?.mockResolvedValueOnce([mockCustomDomain]);

      const result = await service.findAllByProject(userId, projectId);

      expect(mockProjectRepo.findOne).toHaveBeenCalledWith({
        where: { id: projectId, userId },
      });
      expect(result).toHaveLength(1);
      expect(result[0].domain).toBe('my-custom-domain.com');
    });

    it('should throw NotFoundException if project is not found', async () => {
      mockProjectRepo.findOne?.mockResolvedValueOnce(null);

      await expect(
        service.findAllByProject(userId, 'unknown-project'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('should return domain if it exists and belongs to user project', async () => {
      mockDomainRepo.findOne?.mockResolvedValueOnce(mockCustomDomain);

      const result = await service.findOne(userId, domainId);
      expect(result).toEqual(mockCustomDomain);
    });

    it('should throw NotFoundException if domain is not found', async () => {
      mockDomainRepo.findOne?.mockResolvedValueOnce(null);

      await expect(service.findOne(userId, 'invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if domain project belongs to another user', async () => {
      mockDomainRepo.findOne?.mockResolvedValueOnce({
        ...mockCustomDomain,
        project: { ...mockProject, userId: 'other-user' },
      } as any);

      await expect(service.findOne(userId, domainId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('verify', () => {
    it('should update status to VERIFIED when DNS check succeeds', async () => {
      mockDomainRepo.findOne?.mockResolvedValueOnce({
        ...mockCustomDomain,
        status: DomainStatus.PENDING,
        verificationError: 'Previous error',
      } as any);

      mockDnsService.verify?.mockResolvedValueOnce({
        verified: true,
        expectedCname: 'sample-project.localhost',
      });

      const result = await service.verify(userId, domainId);

      expect(result.status).toBe(DomainStatus.VERIFIED);
      expect(result.verificationError).toBeNull();
      expect(result.verifiedAt).toBeDefined();
    });

    it('should update status to FAILED when DNS check fails', async () => {
      mockDomainRepo.findOne?.mockResolvedValueOnce({
        ...mockCustomDomain,
        status: DomainStatus.PENDING,
      } as any);

      mockDnsService.verify?.mockResolvedValueOnce({
        verified: false,
        expectedCname: 'sample-project.localhost',
        error: 'DNS lookup failed',
      });

      const result = await service.verify(userId, domainId);

      expect(result.status).toBe(DomainStatus.FAILED);
      expect(result.verificationError).toBe('DNS lookup failed');
    });
  });

  describe('remove', () => {
    it('should delete domain successfully and return confirmation message', async () => {
      mockDomainRepo.findOne?.mockResolvedValueOnce(mockCustomDomain);

      const result = await service.remove(userId, domainId);

      expect(mockDomainRepo.remove).toHaveBeenCalledWith(mockCustomDomain);
      expect(result.message).toContain('eliminado exitosamente');
    });

    it('should throw NotFoundException if domain does not exist', async () => {
      mockDomainRepo.findOne?.mockResolvedValueOnce(null);

      await expect(service.remove(userId, 'invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
