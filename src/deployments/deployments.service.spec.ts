import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Queue } from 'bullmq';
import { DeploymentsService } from './deployments.service.js';
import { Deployment } from './entities/deployment.entity.js';
import { Project } from '../projects/entities/project.entity.js';
import { DeploymentStatus } from './enums/deployment-status.enum.js';
import { DEPLOY_QUEUE, DEPLOY_JOB } from '../webhooks/webhooks.constants.js';

describe('DeploymentsService', () => {
  let service: DeploymentsService;
  let mockDeploymentRepo: jest.Mocked<Partial<Repository<Deployment>>>;
  let mockProjectRepo: jest.Mocked<Partial<Repository<Project>>>;
  let mockQueue: jest.Mocked<Partial<Queue>>;

  const userId = 'user-uuid-1';
  const projectId = 'project-uuid-1';
  const deploymentId = 'deployment-uuid-1';

  const mockProject: Project = {
    id: projectId,
    name: 'test-app',
    repositoryUrl: 'https://github.com/org/repo.git',
    repositoryName: 'org/repo',
    branch: 'main',
    port: 3000,
    envVariables: {},
    userId,
    user: null as any,
    deployments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDeployment: Deployment = {
    id: deploymentId,
    projectId,
    project: mockProject,
    status: DeploymentStatus.DEPLOYED,
    commitSha: 'abcdef1234567890',
    commitMessage: 'feat: add deployment',
    branch: 'main',
    logs: 'Build and deploy successful',
    stages: [{ name: 'clone', status: 'success', durationMs: 100 }],
    containerId: 'container-uuid-123',
    url: 'http://test-app.localhost',
    startedAt: new Date(),
    finishedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockDeploymentRepo = {
      findAndCount: jest.fn<any>().mockResolvedValue([[mockDeployment], 1]),
      findOne: jest.fn<any>().mockResolvedValue(mockDeployment),
      create: jest.fn<any>().mockImplementation((dto: any) => ({
        id: deploymentId,
        ...dto,
      })),
      save: jest.fn<any>().mockImplementation(async (d: any) => d),
    };

    mockProjectRepo = {
      findOne: jest.fn<any>().mockResolvedValue(mockProject),
    };

    mockQueue = {
      add: jest.fn<any>().mockResolvedValue({ id: 'bull-job-123' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeploymentsService,
        {
          provide: getRepositoryToken(Deployment),
          useValue: mockDeploymentRepo,
        },
        {
          provide: getRepositoryToken(Project),
          useValue: mockProjectRepo,
        },
        {
          provide: getQueueToken(DEPLOY_QUEUE),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<DeploymentsService>(DeploymentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByProject', () => {
    it('should return paginated deployments when project exists and belongs to user', async () => {
      const result = await service.findByProject(userId, projectId, {
        page: 1,
        limit: 10,
      });

      expect(mockProjectRepo.findOne).toHaveBeenCalledWith({
        where: { id: projectId, userId },
      });
      expect(mockDeploymentRepo.findAndCount).toHaveBeenCalledWith({
        where: { projectId },
        order: { createdAt: 'DESC' },
        take: 10,
        skip: 0,
      });
      expect(result).toEqual({
        items: [mockDeployment],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('should use default pagination values when none provided', async () => {
      await service.findByProject(userId, projectId);

      expect(mockDeploymentRepo.findAndCount).toHaveBeenCalledWith({
        where: { projectId },
        order: { createdAt: 'DESC' },
        take: 20,
        skip: 0,
      });
    });

    it('should throw NotFoundException if project not found or does not belong to user', async () => {
      mockProjectRepo.findOne?.mockResolvedValueOnce(null);

      await expect(
        service.findByProject(userId, 'non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('should return deployment when it exists and belongs to user', async () => {
      const result = await service.findOne(userId, deploymentId);

      expect(mockDeploymentRepo.findOne).toHaveBeenCalledWith({
        where: { id: deploymentId },
        relations: ['project'],
      });
      expect(result).toEqual(mockDeployment);
    });

    it('should throw NotFoundException if deployment does not exist', async () => {
      mockDeploymentRepo.findOne?.mockResolvedValueOnce(null);

      await expect(service.findOne(userId, 'non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if deployment belongs to a different user', async () => {
      mockDeploymentRepo.findOne?.mockResolvedValueOnce({
        ...mockDeployment,
        project: { ...mockProject, userId: 'other-user' },
      } as any);

      await expect(service.findOne(userId, deploymentId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('triggerManualDeploy', () => {
    it('should create deployment in QUEUED state, enqueue BullMQ job, and return deployment with jobId', async () => {
      const dto = {
        branch: 'release/v1.0',
        commitSha: 'abcdef1234567890abcdef1234567890abcdef12',
        commitMessage: 'feat: production release',
      };
      const user = { id: userId, email: 'dev@titan.com', name: 'Developer' };

      const result = await service.triggerManualDeploy(
        userId,
        projectId,
        dto,
        user,
      );

      expect(mockProjectRepo.findOne).toHaveBeenCalledWith({
        where: { id: projectId, userId },
      });
      expect(mockDeploymentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: mockProject.id,
          status: DeploymentStatus.QUEUED,
          branch: 'release/v1.0',
          commitSha: 'abcdef1234567890abcdef1234567890abcdef12',
          commitMessage: 'feat: production release',
        }),
      );
      expect(mockDeploymentRepo.save).toHaveBeenCalled();
      expect(mockQueue.add).toHaveBeenCalledWith(
        DEPLOY_JOB,
        expect.objectContaining({
          deploymentId,
          projectId: mockProject.id,
          repositoryName: 'org/repo',
          cloneUrl: 'https://github.com/org/repo.git',
          branch: 'release/v1.0',
          commitSha: 'abcdef1234567890abcdef1234567890abcdef12',
          commitMessage: 'feat: production release',
          author: 'Developer',
        }),
        expect.objectContaining({
          removeOnComplete: true,
          attempts: 3,
        }),
      );
      expect(result.id).toBe(deploymentId);
      expect(result.jobId).toBe('bull-job-123');
    });

    it('should use default values when dto fields are omitted', async () => {
      const user = { id: userId, email: 'dev@titan.com' };

      const result = await service.triggerManualDeploy(
        userId,
        projectId,
        undefined,
        user,
      );

      expect(mockDeploymentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: mockProject.id,
          status: DeploymentStatus.QUEUED,
          branch: 'main',
          commitSha: 'HEAD',
          commitMessage: expect.stringContaining(
            'Manual deploy triggered on branch main by @dev@titan.com',
          ),
        }),
      );
      expect(mockQueue.add).toHaveBeenCalledWith(
        DEPLOY_JOB,
        expect.objectContaining({
          branch: 'main',
          commitSha: 'HEAD',
          author: 'dev@titan.com',
        }),
        expect.anything(),
      );
      expect(result.jobId).toBe('bull-job-123');
    });

    it('should succeed without enqueuing when queue is not provided', async () => {
      const moduleWithoutQueue: TestingModule = await Test.createTestingModule({
        providers: [
          DeploymentsService,
          {
            provide: getRepositoryToken(Deployment),
            useValue: mockDeploymentRepo,
          },
          {
            provide: getRepositoryToken(Project),
            useValue: mockProjectRepo,
          },
        ],
      }).compile();

      const serviceWithoutQueue =
        moduleWithoutQueue.get<DeploymentsService>(DeploymentsService);

      const result = await serviceWithoutQueue.triggerManualDeploy(
        userId,
        projectId,
      );

      expect(mockDeploymentRepo.save).toHaveBeenCalled();
      expect(result.id).toBe(deploymentId);
      expect(result.jobId).toBeUndefined();
    });

    it('should throw NotFoundException if project not found or does not belong to user', async () => {
      mockProjectRepo.findOne?.mockResolvedValueOnce(null);

      await expect(
        service.triggerManualDeploy(userId, 'non-existent-project'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
