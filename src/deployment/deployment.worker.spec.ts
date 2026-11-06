import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { DeploymentWorker } from './deployment.worker.js';
import { DockerPipelineService } from './docker-pipeline.service.js';
import { DEPLOY_JOB } from '../webhooks/webhooks.constants.js';
import { DeploymentJobData } from '../webhooks/interfaces/github-payload.interface.js';
import { Deployment } from '../deployments/entities/deployment.entity.js';
import { Project } from '../projects/entities/project.entity.js';
import { DeploymentStatus } from '../deployments/enums/deployment-status.enum.js';
import { LogsGateway } from '../logs/logs.gateway.js';

describe('DeploymentWorker', () => {
  let worker: DeploymentWorker;
  let mockDockerPipeline: jest.Mocked<Partial<DockerPipelineService>>;
  let mockDeploymentRepo: jest.Mocked<Partial<Repository<Deployment>>>;
  let mockProjectRepo: jest.Mocked<Partial<Repository<Project>>>;
  let mockLogsGateway: jest.Mocked<Partial<LogsGateway>>;

  const mockJobData: DeploymentJobData = {
    deliveryId: 'uuid-1234',
    deploymentId: 'uuid-deployment-1',
    projectId: 'uuid-project-1',
    repositoryName: 'sotk-devs/sample-repo',
    cloneUrl: 'https://github.com/sotk-devs/sample-repo.git',
    branch: 'main',
    commitSha: 'a1b2c3d4e5f6789012345678901234567890abcd',
    commitMessage: 'feat: add deployment pipeline',
    author: 'developer',
    receivedAt: new Date().toISOString(),
  };

  const mockProject: Project = {
    id: 'uuid-project-1',
    name: 'sample-project',
    repositoryUrl: 'https://github.com/sotk-devs/sample-repo.git',
    repositoryName: 'sotk-devs/sample-repo',
    branch: 'main',
    port: 8080,
    envVariables: { NODE_ENV: 'production' },
    userId: 'uuid-user-1',
    user: null as any,
    deployments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockDockerPipeline = {
      getWorkspacePath: jest.fn<any>().mockReturnValue('/tmp/test-workspace'),
      generateImageTag: jest
        .fn<any>()
        .mockImplementation(
          (repo: string, sha: string) =>
            `titan-${repo.split('/')[1] || repo}:${sha ? sha.substring(0, 7) : 'latest'}`,
        ),
      generateContainerName: jest
        .fn<any>()
        .mockReturnValue('titan-app-sample-repo'),
      generateSubdomain: jest.fn<any>().mockReturnValue('sample-project'),
      cloneRepository: jest.fn<any>().mockResolvedValue({
        logs: 'Cloned successfully',
        durationMs: 50,
      }),
      buildImage: jest.fn<any>().mockResolvedValue({
        logs: 'Built image successfully',
        durationMs: 100,
      }),
      runContainer: jest.fn<any>().mockResolvedValue({
        containerId: 'container-uuid-999',
        url: 'http://sample-project.localhost',
        logs: 'Container started with ID: container-uuid-999 (routed at http://sample-project.localhost)',
        durationMs: 40,
      }),
      checkHealth: jest.fn<any>().mockResolvedValue({
        logs: 'Container healthy',
        durationMs: 20,
      }),
      cleanup: jest.fn<any>().mockResolvedValue(undefined as never),
    };

    mockDeploymentRepo = {
      update: jest.fn<any>().mockResolvedValue({ affected: 1 } as never),
    };

    mockProjectRepo = {
      findOne: jest.fn<any>().mockResolvedValue(mockProject),
    };

    mockLogsGateway = {
      emitLog: jest.fn(),
      emitStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeploymentWorker,
        {
          provide: DockerPipelineService,
          useValue: mockDockerPipeline,
        },
        {
          provide: getRepositoryToken(Deployment),
          useValue: mockDeploymentRepo,
        },
        {
          provide: getRepositoryToken(Project),
          useValue: mockProjectRepo,
        },
        {
          provide: LogsGateway,
          useValue: mockLogsGateway,
        },
      ],
    }).compile();

    worker = module.get<DeploymentWorker>(DeploymentWorker);
  });

  it('should be defined', () => {
    expect(worker).toBeDefined();
  });

  describe('process', () => {
    it('should successfully execute all deployment stages, configure Traefik routing, update DB and stream logs via LogsGateway', async () => {
      const mockJob = {
        id: 'job-42',
        name: DEPLOY_JOB,
        data: mockJobData,
        updateProgress: jest.fn().mockResolvedValue(undefined as never),
      } as unknown as Job<DeploymentJobData, any, string>;

      const result = await worker.process(mockJob);

      expect(mockJob.updateProgress).toHaveBeenCalledWith(25);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(50);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(75);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(100);

      expect(mockDockerPipeline.cloneRepository).toHaveBeenCalled();
      expect(mockDockerPipeline.buildImage).toHaveBeenCalled();
      expect(mockDockerPipeline.generateSubdomain).toHaveBeenCalledWith(
        'sample-project',
      );
      expect(mockDockerPipeline.runContainer).toHaveBeenCalledWith(
        'titan-sample-repo:a1b2c3d',
        'titan-app-sample-repo',
        8080,
        { NODE_ENV: 'production' },
        expect.objectContaining({
          subdomain: 'sample-project',
          baseDomain: 'localhost',
          network: 'titan-network',
          onLog: expect.any(Function),
        }),
      );
      expect(mockDockerPipeline.checkHealth).toHaveBeenCalledWith(
        'container-uuid-999',
        expect.any(Function),
      );
      expect(mockDockerPipeline.cleanup).toHaveBeenCalledWith(
        '/tmp/test-workspace',
      );

      // Verificación de emisiones en tiempo real a LogsGateway
      expect(mockLogsGateway.emitStatus).toHaveBeenCalledWith(
        'uuid-deployment-1',
        DeploymentStatus.BUILDING,
        0,
        'starting',
      );
      expect(mockLogsGateway.emitStatus).toHaveBeenCalledWith(
        'uuid-deployment-1',
        DeploymentStatus.DEPLOYED,
        100,
        'completed',
      );
      expect(mockLogsGateway.emitLog).toHaveBeenCalled();

      // Verificación de actualizaciones de estado en BD
      expect(mockDeploymentRepo.update).toHaveBeenCalledWith(
        'uuid-deployment-1',
        expect.objectContaining({ status: DeploymentStatus.BUILDING }),
      );
      expect(mockDeploymentRepo.update).toHaveBeenCalledWith(
        'uuid-deployment-1',
        expect.objectContaining({ status: DeploymentStatus.DEPLOYING }),
      );
      expect(mockDeploymentRepo.update).toHaveBeenCalledWith(
        'uuid-deployment-1',
        expect.objectContaining({
          status: DeploymentStatus.DEPLOYED,
          containerId: 'container-uuid-999',
        }),
      );

      expect(result).toEqual(
        expect.objectContaining({
          jobId: 'job-42',
          deliveryId: 'uuid-1234',
          repositoryName: 'sotk-devs/sample-repo',
          branch: 'main',
          commitSha: 'a1b2c3d4e5f6789012345678901234567890abcd',
          status: 'completed',
          url: 'http://sample-project.localhost',
        }),
      );

      expect(result.stages).toHaveLength(4);
      expect(result.stages.map((s) => s.name)).toEqual([
        'clone',
        'build',
        'docker_deploy',
        'healthcheck',
      ]);
    });

    it('should update DB to FAILED, stream error to LogsGateway, and cleanup workspace when a stage fails', async () => {
      (mockDockerPipeline.buildImage as jest.Mock<any>).mockRejectedValue(
        new Error('Docker build failed: syntax error'),
      );

      const mockJob = {
        id: 'job-fail-1',
        name: DEPLOY_JOB,
        data: mockJobData,
        updateProgress: jest.fn().mockResolvedValue(undefined as never),
      } as unknown as Job<DeploymentJobData, any, string>;

      await expect(worker.process(mockJob)).rejects.toThrow(
        'Docker build failed: syntax error',
      );

      expect(mockLogsGateway.emitStatus).toHaveBeenCalledWith(
        'uuid-deployment-1',
        DeploymentStatus.FAILED,
        undefined,
        'failed',
      );
      expect(mockLogsGateway.emitLog).toHaveBeenCalledWith(
        'uuid-deployment-1',
        expect.stringContaining('Docker build failed: syntax error'),
        'stderr',
      );

      expect(mockDeploymentRepo.update).toHaveBeenCalledWith(
        'uuid-deployment-1',
        expect.objectContaining({ status: DeploymentStatus.FAILED }),
      );
      expect(mockDockerPipeline.cleanup).toHaveBeenCalledWith(
        '/tmp/test-workspace',
      );
    });

    it('should update DB to CANCELLED and emit cancelled status when aborted by user', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      (mockDockerPipeline.cloneRepository as jest.Mock<any>).mockRejectedValue(
        abortError,
      );

      const mockJob = {
        id: 'job-cancel-1',
        name: DEPLOY_JOB,
        data: mockJobData,
        updateProgress: jest.fn().mockResolvedValue(undefined as never),
      } as unknown as Job<DeploymentJobData, any, string>;

      await expect(worker.process(mockJob)).rejects.toThrow(
        'The operation was aborted',
      );

      expect(mockLogsGateway.emitStatus).toHaveBeenCalledWith(
        'uuid-deployment-1',
        DeploymentStatus.CANCELLED,
        undefined,
        'cancelled',
      );
      expect(mockDeploymentRepo.update).toHaveBeenCalledWith(
        'uuid-deployment-1',
        expect.objectContaining({ status: DeploymentStatus.CANCELLED }),
      );
      expect(mockDockerPipeline.cleanup).toHaveBeenCalledWith(
        '/tmp/test-workspace',
      );
    });

    it('should trigger automatic rollback to previous DEPLOYED deployment when a stage fails', async () => {
      (mockDockerPipeline.buildImage as jest.Mock<any>).mockRejectedValue(
        new Error('Docker build failed: health check timeout'),
      );

      const previousDeployment = {
        id: 'uuid-prev-deployed-1',
        projectId: 'uuid-project-1',
        status: DeploymentStatus.DEPLOYED,
        commitSha: 'prevsha123456',
        finishedAt: new Date(),
      };

      mockDeploymentRepo.findOne = jest
        .fn<any>()
        .mockResolvedValue(previousDeployment);

      const mockJob = {
        id: 'job-autorollback-1',
        name: DEPLOY_JOB,
        data: mockJobData,
        updateProgress: jest.fn().mockResolvedValue(undefined as never),
      } as unknown as Job<DeploymentJobData, any, string>;

      await expect(worker.process(mockJob)).rejects.toThrow(
        'Docker build failed: health check timeout',
      );

      expect(mockDockerPipeline.runContainer).toHaveBeenCalledWith(
        expect.stringContaining('prevsha'),
        expect.any(String),
        expect.any(Number),
        expect.any(Object),
        expect.objectContaining({
          subdomain: expect.any(String),
        }),
      );
    });

    it('should throw error when job name is unsupported', async () => {
      const mockJob = {
        id: 'job-99',
        name: 'unsupported-job-name',
        data: mockJobData,
        updateProgress: jest.fn(),
      } as unknown as Job<DeploymentJobData, any, string>;

      await expect(worker.process(mockJob)).rejects.toThrow(
        'Unsupported job name: unsupported-job-name',
      );
    });
  });

  describe('Worker events', () => {
    it('should handle onCompleted event', () => {
      const mockJob = { id: 'job-1' } as Job;
      expect(() => worker.onCompleted(mockJob)).not.toThrow();
    });

    it('should handle onFailed event', () => {
      const mockJob = { id: 'job-2' } as Job;
      const error = new Error('Build failed');
      expect(() => worker.onFailed(mockJob, error)).not.toThrow();
    });
  });
});
