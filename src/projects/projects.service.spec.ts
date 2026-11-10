import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ProjectsService } from './projects.service.js';
import { Project } from './entities/project.entity.js';
import { Deployment } from '../deployments/entities/deployment.entity.js';
import { DeploymentStatus } from '../deployments/enums/deployment-status.enum.js';
import { DomainStatus } from '../domains/enums/domain-status.enum.js';
import { DockerPipelineService } from '../deployment/docker-pipeline.service.js';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let repository: jest.Mocked<Partial<Repository<Project>>>;
  let deploymentRepository: jest.Mocked<Partial<Repository<Deployment>>>;
  let mockDockerPipeline: jest.Mocked<Partial<DockerPipelineService>>;

  const mockUserId = 'uuid-user-1';
  const mockProjectId = 'uuid-project-1';

  const mockProject: Project = {
    id: mockProjectId,
    name: 'sample-project',
    repositoryUrl: 'https://github.com/sotk-devs/sample-repo.git',
    repositoryName: 'sotk-devs/sample-repo',
    branch: 'main',
    port: 3000,
    envVariables: { NODE_ENV: 'production' },
    healthcheckPath: null,
    healthcheckExpectedStatus: 200,
    healthcheckTimeout: 5,
    healthcheckRetries: 3,
    userId: mockUserId,
    user: null as any,
    deployments: [],
    customDomains: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn<any>().mockImplementation((dto: any) => ({
        ...dto,
      })),
      save: jest.fn<any>().mockImplementation((entity: any) =>
        Promise.resolve({
          ...mockProject,
          ...entity,
        }),
      ),
      findOne: jest.fn<any>(),
      find: jest.fn<any>(),
      remove: jest
        .fn<any>()
        .mockImplementation((entity: any) => Promise.resolve(entity)),
    };

    deploymentRepository = {
      findOne: jest.fn<any>(),
      save: jest
        .fn<any>()
        .mockImplementation((entity: any) => Promise.resolve(entity)),
    };

    mockDockerPipeline = {
      generateContainerName: jest
        .fn<any>()
        .mockReturnValue('titan-app-sotk-devs-sample-repo'),
      generateImageTag: jest
        .fn<any>()
        .mockReturnValue('titan-sotk-devs-sample-repo:abc1234'),
      generateSubdomain: jest.fn<any>().mockReturnValue('sample-project'),
      runContainer: jest.fn<any>().mockResolvedValue({
        containerId: 'new-container-id-456',
        url: 'http://sample-project.localhost',
        logs: 'Container started with ID: new-container-id-456',
        durationMs: 50,
      }),
      checkHealth: jest.fn<any>().mockResolvedValue({
        logs: 'Container health verified: running',
        durationMs: 25,
      }),
      getContainerStatus: jest.fn<any>().mockResolvedValue('running'),
      stopContainer: jest.fn<any>().mockResolvedValue({
        logs: 'titan-app-sotk-devs-sample-repo stopped',
        durationMs: 100,
      }),
      startContainer: jest.fn<any>().mockResolvedValue({
        logs: 'titan-app-sotk-devs-sample-repo started',
        durationMs: 100,
      }),
      restartContainer: jest.fn<any>().mockResolvedValue({
        logs: 'titan-app-sotk-devs-sample-repo restarted',
        durationMs: 150,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: getRepositoryToken(Project),
          useValue: repository,
        },
        {
          provide: getRepositoryToken(Deployment),
          useValue: deploymentRepository,
        },
        {
          provide: DockerPipelineService,
          useValue: mockDockerPipeline,
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should successfully create a new project with default values', async () => {
      (repository.findOne as jest.Mock<any>).mockResolvedValue(null);

      const result = await service.create(mockUserId, {
        name: 'sample-project',
        repositoryUrl: 'https://github.com/sotk-devs/sample-repo.git',
        repositoryName: 'sotk-devs/sample-repo',
      });

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { name: 'sample-project', userId: mockUserId },
      });
      expect(repository.create).toHaveBeenCalledWith({
        name: 'sample-project',
        repositoryUrl: 'https://github.com/sotk-devs/sample-repo.git',
        repositoryName: 'sotk-devs/sample-repo',
        branch: 'main',
        port: 3000,
        envVariables: {},
        userId: mockUserId,
      });
      expect(result).toBeDefined();
      expect(result.name).toBe('sample-project');
    });

    it('should create project with resource limits (cpuLimit, memoryLimit, memorySwap)', async () => {
      (repository.findOne as jest.Mock<any>).mockResolvedValue(null);

      const result = await service.create(mockUserId, {
        name: 'limited-project',
        repositoryUrl: 'https://github.com/sotk-devs/sample-repo.git',
        repositoryName: 'sotk-devs/sample-repo',
        cpuLimit: 1.5,
        memoryLimit: '512m',
        memorySwap: '1g',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          cpuLimit: 1.5,
          memoryLimit: '512m',
          memorySwap: '1g',
        }),
      );
      expect(result).toBeDefined();
    });

    it('should throw ConflictException if project name already exists for user', async () => {
      (repository.findOne as jest.Mock<any>).mockResolvedValue(mockProject);

      await expect(
        service.create(mockUserId, {
          name: 'sample-project',
          repositoryUrl: 'https://github.com/sotk-devs/sample-repo.git',
          repositoryName: 'sotk-devs/sample-repo',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all projects belonging to the user', async () => {
      (repository.find as jest.Mock<any>).mockResolvedValue([mockProject]);

      const result = await service.findAll(mockUserId);

      expect(repository.find).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        order: { createdAt: 'DESC' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockProjectId);
    });
  });

  describe('findOne', () => {
    it('should return project when found', async () => {
      (repository.findOne as jest.Mock<any>).mockResolvedValue(mockProject);

      const result = await service.findOne(mockUserId, mockProjectId);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: mockProjectId, userId: mockUserId },
        relations: ['deployments', 'customDomains'],
      });
      expect(result).toEqual(mockProject);
    });

    it('should throw NotFoundException when project does not exist', async () => {
      (repository.findOne as jest.Mock<any>).mockResolvedValue(null);

      await expect(
        service.findOne(mockUserId, 'non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update project fields successfully', async () => {
      (repository.findOne as jest.Mock<any>)
        .mockResolvedValueOnce({ ...mockProject })
        .mockResolvedValueOnce(null);

      const result = await service.update(mockUserId, mockProjectId, {
        name: 'updated-project',
        port: 8080,
      });

      expect(result.name).toBe('updated-project');
      expect(repository.save).toHaveBeenCalled();
    });

    it('should update project resource limits (cpuLimit, memoryLimit, memorySwap)', async () => {
      (repository.findOne as jest.Mock<any>).mockResolvedValueOnce({
        ...mockProject,
      });

      const result = await service.update(mockUserId, mockProjectId, {
        cpuLimit: 2.0,
        memoryLimit: '1g',
        memorySwap: '2g',
      });

      expect(result.cpuLimit).toBe(2.0);
      expect(result.memoryLimit).toBe('1g');
      expect(result.memorySwap).toBe('2g');
      expect(repository.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if new name belongs to another project of user', async () => {
      (repository.findOne as jest.Mock<any>)
        .mockResolvedValueOnce({ ...mockProject })
        .mockResolvedValueOnce({
          ...mockProject,
          id: 'another-project-id',
          name: 'already-used-name',
        });

      await expect(
        service.update(mockUserId, mockProjectId, {
          name: 'already-used-name',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if project to update does not exist', async () => {
      (repository.findOne as jest.Mock<any>).mockResolvedValue(null);

      await expect(
        service.update(mockUserId, 'invalid-id', { name: 'foo' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should recreate container in hot reload when envVariables is modified and project has active deployment', async () => {
      const mockDeployment: Partial<Deployment> = {
        id: 'deploy-uuid-1',
        projectId: mockProjectId,
        status: DeploymentStatus.DEPLOYED,
        commitSha: 'commit123456',
        containerId: 'old-container-id',
        finishedAt: new Date(),
      };

      (repository.findOne as jest.Mock<any>).mockResolvedValue({
        ...mockProject,
      });
      (deploymentRepository.findOne as jest.Mock<any>).mockResolvedValue(
        mockDeployment,
      );

      const result = await service.update(mockUserId, mockProjectId, {
        envVariables: { NODE_ENV: 'staging', DB_PORT: '5432' },
      });

      expect(mockDockerPipeline.generateContainerName).toHaveBeenCalledWith(
        mockProject.repositoryName,
      );
      expect(mockDockerPipeline.getContainerStatus).toHaveBeenCalledWith(
        'titan-app-sotk-devs-sample-repo',
      );
      expect(mockDockerPipeline.generateImageTag).toHaveBeenCalledWith(
        mockProject.repositoryName,
        'commit123456',
      );
      expect(mockDockerPipeline.runContainer).toHaveBeenCalledWith(
        'titan-sotk-devs-sample-repo:abc1234',
        'titan-app-sotk-devs-sample-repo',
        3000,
        { NODE_ENV: 'staging', DB_PORT: '5432' },
        expect.objectContaining({
          subdomain: 'sample-project',
          customDomains: [],
        }),
      );
      expect(mockDockerPipeline.checkHealth).toHaveBeenCalledWith(
        'new-container-id-456',
      );
      expect(deploymentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'deploy-uuid-1',
          containerId: 'new-container-id-456',
        }),
      );
      expect(repository.save).toHaveBeenCalled();
      expect(result.envVariables).toEqual({
        NODE_ENV: 'staging',
        DB_PORT: '5432',
      });
    });

    it('should pass verified custom domains to runContainer when hot reloading', async () => {
      const mockDeployment: Partial<Deployment> = {
        id: 'deploy-uuid-1',
        projectId: mockProjectId,
        status: DeploymentStatus.DEPLOYED,
        commitSha: 'commit123456',
        containerId: 'old-container-id',
      };

      (repository.findOne as jest.Mock<any>).mockResolvedValue({
        ...mockProject,
        customDomains: [
          { domain: 'app.example.com', status: DomainStatus.VERIFIED },
          { domain: 'pending.example.com', status: DomainStatus.PENDING },
        ] as any,
      });
      (deploymentRepository.findOne as jest.Mock<any>).mockResolvedValue(
        mockDeployment,
      );

      await service.update(mockUserId, mockProjectId, {
        envVariables: { NEW_KEY: 'value' },
      });

      expect(mockDockerPipeline.runContainer).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Number),
        expect.any(Object),
        expect.objectContaining({
          customDomains: ['app.example.com'],
        }),
      );
    });

    it('should not recreate container if project has no previous successful deployment', async () => {
      (repository.findOne as jest.Mock<any>).mockResolvedValue({
        ...mockProject,
      });
      (deploymentRepository.findOne as jest.Mock<any>).mockResolvedValue(null);

      await service.update(mockUserId, mockProjectId, {
        envVariables: { NODE_ENV: 'development' },
      });

      expect(mockDockerPipeline.runContainer).not.toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
    });

    it('should not recreate container if containerStatus is not_found', async () => {
      const mockDeployment: Partial<Deployment> = {
        id: 'deploy-uuid-1',
        projectId: mockProjectId,
        status: DeploymentStatus.DEPLOYED,
      };

      (repository.findOne as jest.Mock<any>).mockResolvedValue({
        ...mockProject,
      });
      (
        mockDockerPipeline.getContainerStatus as jest.Mock<any>
      ).mockResolvedValue('not_found');
      (deploymentRepository.findOne as jest.Mock<any>).mockResolvedValue(
        mockDeployment,
      );

      await service.update(mockUserId, mockProjectId, {
        envVariables: { NODE_ENV: 'development' },
      });

      expect(mockDockerPipeline.runContainer).not.toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if runContainer or checkHealth fails during hot reload', async () => {
      const mockDeployment: Partial<Deployment> = {
        id: 'deploy-uuid-1',
        projectId: mockProjectId,
        status: DeploymentStatus.DEPLOYED,
        commitSha: 'commit123456',
      };

      (repository.findOne as jest.Mock<any>).mockResolvedValue({
        ...mockProject,
      });
      (deploymentRepository.findOne as jest.Mock<any>).mockResolvedValue(
        mockDeployment,
      );
      (mockDockerPipeline.checkHealth as jest.Mock<any>).mockRejectedValue(
        new Error('Container crashed on start'),
      );

      await expect(
        service.update(mockUserId, mockProjectId, {
          envVariables: { BROKEN_VAR: 'invalid' },
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should remove project successfully and return confirmation', async () => {
      (repository.findOne as jest.Mock<any>).mockResolvedValue({
        ...mockProject,
      });

      const result = await service.remove(mockUserId, mockProjectId);

      expect(repository.remove).toHaveBeenCalled();
      expect(result).toHaveProperty('message');
      expect(result.message).toContain('eliminado exitosamente');
    });

    it('should throw NotFoundException if project to remove does not exist', async () => {
      (repository.findOne as jest.Mock<any>).mockResolvedValue(null);

      await expect(service.remove(mockUserId, 'invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Container Lifecycle Management', () => {
    describe('stopContainer', () => {
      it('should stop running container successfully', async () => {
        (repository.findOne as jest.Mock<any>).mockResolvedValue(mockProject);
        (
          mockDockerPipeline.getContainerStatus as jest.Mock<any>
        ).mockResolvedValue('running');

        const result = await service.stopContainer(mockUserId, mockProjectId);

        expect(mockDockerPipeline.stopContainer).toHaveBeenCalledWith(
          'titan-app-sotk-devs-sample-repo',
        );
        expect(result).toEqual({
          projectId: mockProjectId,
          containerName: 'titan-app-sotk-devs-sample-repo',
          action: 'stop',
          status: 'stopped',
          message: 'Contenedor detenido exitosamente.',
        });
      });

      it('should return already stopped message if container is exited', async () => {
        (repository.findOne as jest.Mock<any>).mockResolvedValue(mockProject);
        (
          mockDockerPipeline.getContainerStatus as jest.Mock<any>
        ).mockResolvedValue('exited');

        const result = await service.stopContainer(mockUserId, mockProjectId);

        expect(mockDockerPipeline.stopContainer).not.toHaveBeenCalled();
        expect(result.status).toBe('stopped');
        expect(result.message).toContain('ya se encontraba detenido');
      });

      it('should throw BadRequestException if container was never deployed', async () => {
        (repository.findOne as jest.Mock<any>).mockResolvedValue(mockProject);
        (
          mockDockerPipeline.getContainerStatus as jest.Mock<any>
        ).mockResolvedValue('not_found');

        await expect(
          service.stopContainer(mockUserId, mockProjectId),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw NotFoundException if project does not exist', async () => {
        (repository.findOne as jest.Mock<any>).mockResolvedValue(null);

        await expect(
          service.stopContainer(mockUserId, 'non-existent-id'),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe('startContainer', () => {
      it('should start stopped container successfully', async () => {
        (repository.findOne as jest.Mock<any>).mockResolvedValue(mockProject);
        (
          mockDockerPipeline.getContainerStatus as jest.Mock<any>
        ).mockResolvedValue('exited');

        const result = await service.startContainer(mockUserId, mockProjectId);

        expect(mockDockerPipeline.startContainer).toHaveBeenCalledWith(
          'titan-app-sotk-devs-sample-repo',
        );
        expect(result).toEqual({
          projectId: mockProjectId,
          containerName: 'titan-app-sotk-devs-sample-repo',
          action: 'start',
          status: 'running',
          message: 'Contenedor iniciado exitosamente.',
        });
      });

      it('should return already running message if container is running', async () => {
        (repository.findOne as jest.Mock<any>).mockResolvedValue(mockProject);
        (
          mockDockerPipeline.getContainerStatus as jest.Mock<any>
        ).mockResolvedValue('running');

        const result = await service.startContainer(mockUserId, mockProjectId);

        expect(mockDockerPipeline.startContainer).not.toHaveBeenCalled();
        expect(result.status).toBe('running');
        expect(result.message).toContain('ya se encuentra en ejecución');
      });

      it('should throw BadRequestException if container was never deployed', async () => {
        (repository.findOne as jest.Mock<any>).mockResolvedValue(mockProject);
        (
          mockDockerPipeline.getContainerStatus as jest.Mock<any>
        ).mockResolvedValue('not_found');

        await expect(
          service.startContainer(mockUserId, mockProjectId),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('restartContainer', () => {
      it('should restart container successfully', async () => {
        (repository.findOne as jest.Mock<any>).mockResolvedValue(mockProject);
        (
          mockDockerPipeline.getContainerStatus as jest.Mock<any>
        ).mockResolvedValue('running');

        const result = await service.restartContainer(
          mockUserId,
          mockProjectId,
        );

        expect(mockDockerPipeline.restartContainer).toHaveBeenCalledWith(
          'titan-app-sotk-devs-sample-repo',
        );
        expect(result).toEqual({
          projectId: mockProjectId,
          containerName: 'titan-app-sotk-devs-sample-repo',
          action: 'restart',
          status: 'running',
          message: 'Contenedor reiniciado exitosamente.',
        });
      });

      it('should throw BadRequestException if container does not exist', async () => {
        (repository.findOne as jest.Mock<any>).mockResolvedValue(mockProject);
        (
          mockDockerPipeline.getContainerStatus as jest.Mock<any>
        ).mockResolvedValue('not_found');

        await expect(
          service.restartContainer(mockUserId, mockProjectId),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('importEnv', () => {
      it('should import env variables in merge mode and preserve untouched existing keys', async () => {
        (repository.findOne as jest.Mock<any>).mockResolvedValue({
          ...mockProject,
          envVariables: {
            EXISTING_A: 'val_a',
            NODE_ENV: 'development',
          },
        });
        (
          mockDockerPipeline.getContainerStatus as jest.Mock<any>
        ).mockResolvedValue('not_found');

        const result = await service.importEnv(mockUserId, mockProjectId, {
          content: 'NODE_ENV=production\nPORT=8080\nNEW_VAR="new value"',
        });

        expect(result.mode).toBe('merge');
        expect(result.importedCount).toBe(3);
        expect(result.totalCount).toBe(4);
        expect(result.variables).toEqual({
          EXISTING_A: 'val_a',
          NODE_ENV: 'production',
          PORT: '8080',
          NEW_VAR: 'new value',
        });
        expect(repository.save).toHaveBeenCalled();
      });

      it('should import env variables in replace mode discarding previous keys', async () => {
        (repository.findOne as jest.Mock<any>).mockResolvedValue({
          ...mockProject,
          envVariables: {
            OLD_KEY_1: 'val1',
            OLD_KEY_2: 'val2',
          },
        });
        (
          mockDockerPipeline.getContainerStatus as jest.Mock<any>
        ).mockResolvedValue('not_found');

        const result = await service.importEnv(mockUserId, mockProjectId, {
          content: 'REPLACED_KEY=active\nPORT=3000',
          mode: 'replace' as any,
        });

        expect(result.mode).toBe('replace');
        expect(result.importedCount).toBe(2);
        expect(result.totalCount).toBe(2);
        expect(result.variables).toEqual({
          REPLACED_KEY: 'active',
          PORT: '3000',
        });
        expect(result.variables.OLD_KEY_1).toBeUndefined();
      });

      it('should throw BadRequestException if content contains invalid key or format', async () => {
        (repository.findOne as jest.Mock<any>).mockResolvedValue(mockProject);

        await expect(
          service.importEnv(mockUserId, mockProjectId, {
            content: '123_INVALID=value',
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it('should recreate container in hot reload when imported into running deployed project', async () => {
        (repository.findOne as jest.Mock<any>).mockResolvedValue(mockProject);
        (
          mockDockerPipeline.getContainerStatus as jest.Mock<any>
        ).mockResolvedValue('running');
        (deploymentRepository.findOne as jest.Mock<any>).mockResolvedValue({
          id: 'deploy-uuid-1',
          commitSha: 'commit123',
          status: DeploymentStatus.DEPLOYED,
        });
        (mockDockerPipeline.runContainer as jest.Mock<any>).mockResolvedValue({
          containerId: 'new-container-id',
          name: 'titan-app-sotk-devs-sample-repo',
          status: 'running',
        });

        await service.importEnv(mockUserId, mockProjectId, {
          content: 'PORT=9000\nAPI_URL=https://api.example.com',
        });

        expect(mockDockerPipeline.runContainer).toHaveBeenCalledWith(
          'titan-sotk-devs-sample-repo:abc1234',
          'titan-app-sotk-devs-sample-repo',
          3000,
          {
            NODE_ENV: 'production',
            PORT: '9000',
            API_URL: 'https://api.example.com',
          },
          expect.objectContaining({
            subdomain: 'sample-project',
          }),
        );
      });
    });

    describe('exportEnv', () => {
      it('should export environment variables formatted as .env text', async () => {
        (repository.findOne as jest.Mock<any>).mockResolvedValue({
          ...mockProject,
          envVariables: {
            PORT: '3000',
            APP_NAME: 'Titan PaaS',
          },
        });

        const result = await service.exportEnv(mockUserId, mockProjectId);

        expect(result.count).toBe(2);
        expect(result.variables).toEqual({
          PORT: '3000',
          APP_NAME: 'Titan PaaS',
        });
        expect(result.raw).toBe('APP_NAME="Titan PaaS"\nPORT=3000\n');
      });

      it('should return empty raw string when no variables exist', async () => {
        (repository.findOne as jest.Mock<any>).mockResolvedValue({
          ...mockProject,
          envVariables: {},
        });

        const result = await service.exportEnv(mockUserId, mockProjectId);

        expect(result.count).toBe(0);
        expect(result.raw).toBe('');
      });

      it('should throw NotFoundException if project is not found', async () => {
        (repository.findOne as jest.Mock<any>).mockResolvedValue(null);

        await expect(
          service.exportEnv(mockUserId, 'non-existent-id'),
        ).rejects.toThrow(NotFoundException);
      });
    });
  });
});
