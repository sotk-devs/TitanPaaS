import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Queue } from 'bullmq';
import { DeploymentsService } from './deployments.service.js';
import { Deployment } from './entities/deployment.entity.js';
import { Project } from '../projects/entities/project.entity.js';
import { DeploymentStatus } from './enums/deployment-status.enum.js';
import { DEPLOY_QUEUE, DEPLOY_JOB } from '../webhooks/webhooks.constants.js';
import { DockerPipelineService } from '../deployment/docker-pipeline.service.js';
import { LogsGateway } from '../logs/logs.gateway.js';

describe('DeploymentsService', () => {
  let service: DeploymentsService;
  let mockDeploymentRepo: jest.Mocked<Partial<Repository<Deployment>>>;
  let mockProjectRepo: jest.Mocked<Partial<Repository<Project>>>;
  let mockQueue: jest.Mocked<Partial<Queue>>;
  let mockDockerPipeline: jest.Mocked<Partial<DockerPipelineService>>;
  let mockLogsGateway: jest.Mocked<Partial<LogsGateway>>;

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
      findOne: jest.fn<any>().mockResolvedValue({ ...mockDeployment }),
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
      getJobs: jest.fn<any>().mockResolvedValue([]),
    };

    mockDockerPipeline = {
      abortDeployment: jest.fn<any>().mockReturnValue(true),
    };

    mockLogsGateway = {
      emitStatus: jest.fn(),
      emitLog: jest.fn(),
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
        {
          provide: DockerPipelineService,
          useValue: mockDockerPipeline,
        },
        {
          provide: LogsGateway,
          useValue: mockLogsGateway,
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
        items: [{ ...mockDeployment }],
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
      expect(result.jobId).toBe('bull-job-123');
    });

    it('should throw NotFoundException if project not found or does not belong to user', async () => {
      mockProjectRepo.findOne?.mockResolvedValueOnce(null);

      await expect(
        service.triggerManualDeploy(userId, 'non-existent-project'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancelDeployment', () => {
    it('should cancel a queued deployment and remove job from BullMQ', async () => {
      const queuedDeployment = {
        ...mockDeployment,
        status: DeploymentStatus.QUEUED,
      };
      mockDeploymentRepo.findOne?.mockResolvedValueOnce(
        queuedDeployment as any,
      );

      const mockJob = {
        id: 'job-1',
        data: { deploymentId },
        remove: jest.fn<any>().mockResolvedValue(true),
      };
      mockQueue.getJobs?.mockResolvedValueOnce([mockJob as any]);

      const result = await service.cancelDeployment(userId, deploymentId);

      expect(mockJob.remove).toHaveBeenCalled();
      expect(mockDeploymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: DeploymentStatus.CANCELLED,
        }),
      );
      expect(mockLogsGateway.emitStatus).toHaveBeenCalledWith(
        deploymentId,
        DeploymentStatus.CANCELLED,
        undefined,
        'cancelled',
      );
      expect(result.status).toBe(DeploymentStatus.CANCELLED);
    });

    it('should cancel an active building deployment and abort docker process', async () => {
      const buildingDeployment = {
        ...mockDeployment,
        status: DeploymentStatus.BUILDING,
      };
      mockDeploymentRepo.findOne?.mockResolvedValueOnce(
        buildingDeployment as any,
      );

      const result = await service.cancelDeployment(userId, deploymentId);

      expect(mockDockerPipeline.abortDeployment).toHaveBeenCalledWith(
        deploymentId,
      );
      expect(mockDeploymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: DeploymentStatus.CANCELLED,
        }),
      );
      expect(result.status).toBe(DeploymentStatus.CANCELLED);
    });

    it('should throw BadRequestException if deployment is already DEPLOYED', async () => {
      mockDeploymentRepo.findOne?.mockResolvedValueOnce({
        ...mockDeployment,
        status: DeploymentStatus.DEPLOYED,
      } as any);

      await expect(
        service.cancelDeployment(userId, deploymentId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if deployment is already FAILED or CANCELLED', async () => {
      mockDeploymentRepo.findOne?.mockResolvedValueOnce({
        ...mockDeployment,
        status: DeploymentStatus.CANCELLED,
      } as any);

      await expect(
        service.cancelDeployment(userId, deploymentId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if deployment does not exist', async () => {
      mockDeploymentRepo.findOne?.mockResolvedValueOnce(null);

      await expect(
        service.cancelDeployment(userId, 'non-existent-deploy'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if deployment belongs to another user', async () => {
      mockDeploymentRepo.findOne?.mockResolvedValueOnce({
        ...mockDeployment,
        project: { ...mockProject, userId: 'other-user' },
      } as any);

      await expect(
        service.cancelDeployment(userId, deploymentId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('rollbackDeployment', () => {
    it('should rollback to a previously DEPLOYED deployment and enqueue job', async () => {
      mockDeploymentRepo.findOne?.mockResolvedValueOnce({
        ...mockDeployment,
        status: DeploymentStatus.DEPLOYED,
      } as any);

      const result = await service.rollbackDeployment(userId, deploymentId, {
        reason: 'revert breaking bug',
      });

      expect(mockDeploymentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: mockProject.id,
          status: DeploymentStatus.QUEUED,
          branch: 'main',
          commitSha: 'abcdef1234567890',
          commitMessage: expect.stringContaining('revert breaking bug'),
        }),
      );
      expect(mockDeploymentRepo.save).toHaveBeenCalled();
      expect(mockQueue.add).toHaveBeenCalledWith(
        DEPLOY_JOB,
        expect.objectContaining({
          projectId: mockProject.id,
          repositoryName: 'org/repo',
          cloneUrl: 'https://github.com/org/repo.git',
          branch: 'main',
          commitSha: 'abcdef1234567890',
        }),
        expect.anything(),
      );
      expect(result.jobId).toBe('bull-job-123');
    });

    it('should find the last DEPLOYED deployment if target deployment is FAILED', async () => {
      const failedDeployment = {
        ...mockDeployment,
        id: 'failed-deployment-id',
        status: DeploymentStatus.FAILED,
      };

      const lastSuccessful = {
        ...mockDeployment,
        id: 'successful-deploy-prev',
        commitSha: 'prev123456789',
        status: DeploymentStatus.DEPLOYED,
      };

      mockDeploymentRepo.findOne
        ?.mockResolvedValueOnce(failedDeployment as any)
        ?.mockResolvedValueOnce(lastSuccessful as any);

      const result = await service.rollbackDeployment(
        userId,
        'failed-deployment-id',
      );

      expect(mockDeploymentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: mockProject.id,
          status: DeploymentStatus.QUEUED,
          commitSha: 'prev123456789',
          commitMessage: expect.stringContaining(
            'Rollback to deployment #successful-deploy-prev',
          ),
        }),
      );
      expect(result.jobId).toBe('bull-job-123');
    });

    it('should throw BadRequestException if no previous DEPLOYED deployment exists', async () => {
      const failedDeployment = {
        ...mockDeployment,
        status: DeploymentStatus.FAILED,
      };

      mockDeploymentRepo.findOne
        ?.mockResolvedValueOnce(failedDeployment as any)
        ?.mockResolvedValueOnce(null);

      await expect(
        service.rollbackDeployment(userId, deploymentId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if deployment does not exist', async () => {
      mockDeploymentRepo.findOne?.mockResolvedValueOnce(null);

      await expect(
        service.rollbackDeployment(userId, 'non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if deployment belongs to another user', async () => {
      mockDeploymentRepo.findOne?.mockResolvedValueOnce({
        ...mockDeployment,
        project: { ...mockProject, userId: 'other-user' },
      } as any);

      await expect(
        service.rollbackDeployment(userId, deploymentId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
