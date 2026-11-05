import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { DeploymentsController } from './deployments.controller.js';
import { DeploymentsService } from './deployments.service.js';
import { DeploymentStatus } from './enums/deployment-status.enum.js';

describe('DeploymentsController', () => {
  let controller: DeploymentsController;
  let mockDeploymentsService: jest.Mocked<Partial<DeploymentsService>>;

  const mockUser = {
    id: 'user-uuid-1',
    email: 'dev@titan.com',
    name: 'Developer',
  };
  const mockReq = { user: mockUser };
  const projectId = 'project-uuid-1';
  const deploymentId = 'deployment-uuid-1';

  const mockDeployment = {
    id: deploymentId,
    projectId,
    status: DeploymentStatus.DEPLOYED,
    commitSha: 'abcdef123456',
    commitMessage: 'feat: new feature',
    branch: 'main',
    logs: 'Done',
    stages: [],
    containerId: 'cont-123',
    startedAt: new Date(),
    finishedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockDeploymentsService = {
      findByProject: jest.fn<any>().mockResolvedValue({
        items: [mockDeployment],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      }),
      findOne: jest.fn<any>().mockResolvedValue(mockDeployment),
      triggerManualDeploy: jest.fn<any>().mockResolvedValue({
        ...mockDeployment,
        status: DeploymentStatus.QUEUED,
        jobId: 'bull-job-123',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeploymentsController],
      providers: [
        {
          provide: DeploymentsService,
          useValue: mockDeploymentsService,
        },
      ],
    }).compile();

    controller = module.get<DeploymentsController>(DeploymentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findByProject', () => {
    it('should call service.findByProject with user id, project id, and query', async () => {
      const query = { page: 1, limit: 10 };
      const result = await controller.findByProject(
        mockReq as any,
        projectId,
        query,
      );

      expect(mockDeploymentsService.findByProject).toHaveBeenCalledWith(
        mockUser.id,
        projectId,
        query,
      );
      expect(result.items).toEqual([mockDeployment]);
    });
  });

  describe('findOne', () => {
    it('should call service.findOne with user id and deployment id', async () => {
      const result = await controller.findOne(mockReq as any, deploymentId);

      expect(mockDeploymentsService.findOne).toHaveBeenCalledWith(
        mockUser.id,
        deploymentId,
      );
      expect(result).toEqual(mockDeployment);
    });
  });

  describe('triggerDeploy', () => {
    it('should call service.triggerManualDeploy with user id, project id, dto, and user profile', async () => {
      const dto = {
        branch: 'staging',
        commitSha: '1234567890abcdef',
        commitMessage: 'deploy staging manually',
      };

      const result = await controller.triggerDeploy(
        mockReq as any,
        projectId,
        dto,
      );

      expect(mockDeploymentsService.triggerManualDeploy).toHaveBeenCalledWith(
        mockUser.id,
        projectId,
        dto,
        mockUser,
      );
      expect(result).toEqual({
        ...mockDeployment,
        status: DeploymentStatus.QUEUED,
        jobId: 'bull-job-123',
      });
    });
  });
});
