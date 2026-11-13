import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuditService } from './audit.service.js';
import { AuditLog } from './entities/audit-log.entity.js';
import { AuditAction } from './enums/audit-action.enum.js';
import { AuditResourceType } from './enums/audit-resource-type.enum.js';
import { Project } from '../projects/entities/project.entity.js';
import { TeamMember } from '../teams/entities/team-member.entity.js';

describe('AuditService', () => {
  let service: AuditService;
  let auditLogRepo: jest.Mocked<Partial<Repository<AuditLog>>>;
  let projectRepo: jest.Mocked<Partial<Repository<Project>>>;
  let teamMemberRepo: jest.Mocked<Partial<Repository<TeamMember>>>;

  const mockUserId = 'user-uuid-1';
  const mockOtherUserId = 'user-uuid-2';
  const mockProjectId = 'project-uuid-1';

  const mockAuditLog: AuditLog = {
    id: 'audit-uuid-1',
    userId: mockUserId,
    action: AuditAction.PROJECT_CREATE,
    resourceType: AuditResourceType.PROJECT,
    resourceId: mockProjectId,
    projectId: mockProjectId,
    details: { name: 'sample-project' },
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    createdAt: new Date(),
  };

  const mockProject: Project = {
    id: mockProjectId,
    name: 'sample-project',
    repositoryUrl: 'https://github.com/sotk-devs/sample-repo.git',
    repositoryName: 'sotk-devs/sample-repo',
    branch: 'main',
    port: 3000,
    envVariables: {},
    healthcheckPath: null,
    healthcheckExpectedStatus: 200,
    healthcheckTimeout: 5,
    healthcheckRetries: 3,
    isClusterEnabled: false,
    clusterReplicas: 1,
    clusterPlacement: null,
    userId: mockUserId,
    teamId: null,
    user: null as any,
    deployments: [],
    customDomains: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    auditLogRepo = {
      create: jest.fn((dto: any) => ({
        ...dto,
        id: 'audit-uuid-1',
        createdAt: new Date(),
      })),
      save: jest.fn(async (entity: any) => entity),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn<any>().mockResolvedValue([[mockAuditLog], 1]),
      })) as any,
    };

    projectRepo = {
      findOne: jest.fn<any>().mockResolvedValue(mockProject),
      createQueryBuilder: jest.fn() as any,
    };

    teamMemberRepo = {
      find: jest.fn<any>().mockResolvedValue([]),
      findOne: jest.fn<any>().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: auditLogRepo,
        },
        {
          provide: getRepositoryToken(Project),
          useValue: projectRepo,
        },
        {
          provide: getRepositoryToken(TeamMember),
          useValue: teamMemberRepo,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('record', () => {
    it('should create and save an audit log successfully', async () => {
      const result = await service.record({
        userId: mockUserId,
        action: AuditAction.PROJECT_CREATE,
        resourceType: AuditResourceType.PROJECT,
        resourceId: mockProjectId,
        projectId: mockProjectId,
        details: { name: 'sample-project' },
        ipAddress: '127.0.0.1',
        userAgent: 'JestTest',
      });

      expect(auditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          action: AuditAction.PROJECT_CREATE,
          resourceType: AuditResourceType.PROJECT,
          resourceId: mockProjectId,
          projectId: mockProjectId,
          details: { name: 'sample-project' },
          ipAddress: '127.0.0.1',
          userAgent: 'JestTest',
        }),
      );
      expect(auditLogRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result?.id).toBe('audit-uuid-1');
    });

    it('should sanitize passwords, tokens, secrets and mask environment variables', async () => {
      await service.record({
        userId: mockUserId,
        action: AuditAction.ENV_UPDATE,
        resourceType: AuditResourceType.ENVIRONMENT,
        resourceId: mockProjectId,
        projectId: mockProjectId,
        details: {
          userPassword: 'superSecretPassword123',
          apiToken: 'secret_live_token_999',
          authSecret: 'jwt_secret_value',
          envVariables: {
            DATABASE_URL: 'postgres://user:pass@host/db',
            PORT: '3000',
            JWT_SECRET: 'my_secret_key',
          },
        },
      });

      expect(auditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          details: {
            userPassword: '[REDACTED]',
            apiToken: '[REDACTED]',
            authSecret: '[REDACTED]',
            envVariables: {
              variableCount: 3,
              keys: ['DATABASE_URL', 'PORT', 'JWT_SECRET'],
            },
          },
        }),
      );
    });

    it('should handle repository errors gracefully without throwing', async () => {
      auditLogRepo.save = jest
        .fn<any>()
        .mockRejectedValue(new Error('Database write failure'));

      const result = await service.record({
        userId: mockUserId,
        action: AuditAction.PROJECT_DELETE,
        resourceType: AuditResourceType.PROJECT,
        resourceId: mockProjectId,
      });

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return paginated audit logs for accessible projects', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn<any>().mockResolvedValue([[mockAuditLog], 1]),
      };

      const mockProjectQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn<any>().mockResolvedValue([{ id: mockProjectId }]),
      };

      (auditLogRepo.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );
      (projectRepo.createQueryBuilder as jest.Mock).mockReturnValue(
        mockProjectQb,
      );

      const result = await service.findAll(mockUserId, {
        page: 1,
        limit: 10,
        action: AuditAction.PROJECT_CREATE,
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(1);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'log.action = :action',
        {
          action: AuditAction.PROJECT_CREATE,
        },
      );
    });

    it('should throw ForbiddenException if user attempts to query a projectId they do not own or access', async () => {
      const mockProjectQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn<any>().mockResolvedValue([{ id: 'other-project-id' }]),
      };
      (projectRepo.createQueryBuilder as jest.Mock).mockReturnValue(
        mockProjectQb,
      );

      await expect(
        service.findAll(mockUserId, {
          projectId: 'unauthorized-project-id',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findByProject', () => {
    it('should throw NotFoundException if project does not exist', async () => {
      projectRepo.findOne = jest.fn<any>().mockResolvedValue(null);

      await expect(
        service.findByProject(mockUserId, 'non-existent-id', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user does not own the project and is not a team member', async () => {
      projectRepo.findOne = jest.fn<any>().mockResolvedValue({
        ...mockProject,
        userId: mockOtherUserId,
        teamId: 'team-uuid-1',
      });
      teamMemberRepo.findOne = jest.fn<any>().mockResolvedValue(null);

      await expect(
        service.findByProject(mockUserId, mockProjectId, {}),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return project audit logs when user owns the project', async () => {
      projectRepo.findOne = jest.fn<any>().mockResolvedValue({
        ...mockProject,
        userId: mockUserId,
      });

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn<any>().mockResolvedValue([[mockAuditLog], 1]),
      };

      const mockProjectQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn<any>().mockResolvedValue([{ id: mockProjectId }]),
      };

      (auditLogRepo.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );
      (projectRepo.createQueryBuilder as jest.Mock).mockReturnValue(
        mockProjectQb,
      );

      const result = await service.findByProject(mockUserId, mockProjectId, {
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });
});
