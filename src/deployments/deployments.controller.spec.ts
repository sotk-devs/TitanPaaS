import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { DeploymentsController } from './deployments.controller.js';
import { DeploymentsService } from './deployments.service.js';
import { DeploymentStatus } from './enums/deployment-status.enum.js';
import { LogDownloadFormat } from './dto/download-logs-query.dto.js';

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
      cancelDeployment: jest.fn<any>().mockResolvedValue({
        ...mockDeployment,
        status: DeploymentStatus.CANCELLED,
      }),
      rollbackDeployment: jest.fn<any>().mockResolvedValue({
        ...mockDeployment,
        id: 'rollback-deployment-id',
        status: DeploymentStatus.QUEUED,
        jobId: 'bull-rollback-job-123',
      }),
      getDeploymentLogsForDownload: jest.fn<any>().mockResolvedValue({
        filename: 'sample-project-deployment-uuid-logs.txt',
        contentType: 'text/plain; charset=utf-8',
        content: 'Sample deployment logs text',
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

  describe('cancelDeployment', () => {
    it('should call service.cancelDeployment with user id and deployment id', async () => {
      const result = await controller.cancelDeployment(
        mockReq as any,
        deploymentId,
      );

      expect(mockDeploymentsService.cancelDeployment).toHaveBeenCalledWith(
        mockUser.id,
        deploymentId,
      );
      expect(result).toEqual({
        ...mockDeployment,
        status: DeploymentStatus.CANCELLED,
      });
    });
  });

  describe('rollbackDeployment', () => {
    it('should call service.rollbackDeployment with user id, deployment id, dto, and user profile', async () => {
      const dto = { reason: 'critical bug' };

      const result = await controller.rollbackDeployment(
        mockReq as any,
        deploymentId,
        dto,
      );

      expect(mockDeploymentsService.rollbackDeployment).toHaveBeenCalledWith(
        mockUser.id,
        deploymentId,
        dto,
        mockUser,
      );
      expect(result).toEqual({
        ...mockDeployment,
        id: 'rollback-deployment-id',
        status: DeploymentStatus.QUEUED,
        jobId: 'bull-rollback-job-123',
      });
    });
  });

  describe('downloadLogs', () => {
    it('should set headers and return text logs content', async () => {
      const mockRes: any = {
        setHeader: jest.fn(),
      };

      const result = await controller.downloadLogs(
        mockReq as any,
        deploymentId,
        { format: LogDownloadFormat.TXT },
        mockRes,
      );

      expect(
        mockDeploymentsService.getDeploymentLogsForDownload,
      ).toHaveBeenCalledWith(mockUser.id, deploymentId, LogDownloadFormat.TXT);
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/plain; charset=utf-8',
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="sample-project-deployment-uuid-logs.txt"',
      );
      expect(result).toBe('Sample deployment logs text');
    });

    it('should set headers and return json logs content', async () => {
      const mockRes: any = {
        setHeader: jest.fn(),
      };

      (
        mockDeploymentsService.getDeploymentLogsForDownload as jest.Mock<any>
      ).mockResolvedValueOnce({
        filename: 'sample-project-deployment-uuid-logs.json',
        contentType: 'application/json; charset=utf-8',
        content: JSON.stringify({ logs: 'json formatted logs' }),
      });

      const result = await controller.downloadLogs(
        mockReq as any,
        deploymentId,
        { format: LogDownloadFormat.JSON },
        mockRes,
      );

      expect(
        mockDeploymentsService.getDeploymentLogsForDownload,
      ).toHaveBeenCalledWith(mockUser.id, deploymentId, LogDownloadFormat.JSON);
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/json; charset=utf-8',
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="sample-project-deployment-uuid-logs.json"',
      );
      expect(result).toBe(JSON.stringify({ logs: 'json formatted logs' }));
    });
  });
});
