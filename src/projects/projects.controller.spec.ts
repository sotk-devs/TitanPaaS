import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';
import { Project } from './entities/project.entity.js';

describe('ProjectsController', () => {
  let controller: ProjectsController;
  let service: jest.Mocked<Partial<ProjectsService>>;

  const mockUser = {
    id: 'uuid-user-1',
    email: 'dev@example.com',
    name: 'Developer',
  };

  const mockReq = {
    user: mockUser,
  };

  const mockProject: Project = {
    id: 'uuid-project-1',
    name: 'sample-project',
    repositoryUrl: 'https://github.com/sotk-devs/sample-repo.git',
    repositoryName: 'sotk-devs/sample-repo',
    branch: 'main',
    port: 3000,
    envVariables: { NODE_ENV: 'production' },
    userId: mockUser.id,
    user: null as any,
    deployments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    service = {
      create: jest.fn<any>().mockResolvedValue(mockProject),
      findAll: jest.fn<any>().mockResolvedValue([mockProject]),
      findOne: jest.fn<any>().mockResolvedValue(mockProject),
      update: jest.fn<any>().mockResolvedValue({
        ...mockProject,
        name: 'updated-name',
      }),
      remove: jest.fn<any>().mockResolvedValue({
        message: 'Proyecto "sample-project" eliminado exitosamente',
      }),
      stopContainer: jest.fn<any>().mockResolvedValue({
        projectId: mockProject.id,
        containerName: 'titan-app-sample-repo',
        action: 'stop',
        status: 'stopped',
        message: 'Contenedor detenido exitosamente.',
      }),
      startContainer: jest.fn<any>().mockResolvedValue({
        projectId: mockProject.id,
        containerName: 'titan-app-sample-repo',
        action: 'start',
        status: 'running',
        message: 'Contenedor iniciado exitosamente.',
      }),
      restartContainer: jest.fn<any>().mockResolvedValue({
        projectId: mockProject.id,
        containerName: 'titan-app-sample-repo',
        action: 'restart',
        status: 'running',
        message: 'Contenedor reiniciado exitosamente.',
      }),
      importEnv: jest.fn<any>().mockResolvedValue({
        message: 'Variables de entorno importadas exitosamente',
        mode: 'merge',
        importedCount: 2,
        totalCount: 3,
        variables: {
          NODE_ENV: 'production',
          PORT: '8080',
          DB_HOST: 'localhost',
        },
      }),
      exportEnv: jest.fn<any>().mockResolvedValue({
        raw: 'NODE_ENV=production\nPORT=3000\n',
        variables: { NODE_ENV: 'production', PORT: '3000' },
        count: 2,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [
        {
          provide: ProjectsService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<ProjectsController>(ProjectsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call service.create with authenticated user ID and DTO', async () => {
      const dto = {
        name: 'sample-project',
        repositoryUrl: 'https://github.com/sotk-devs/sample-repo.git',
        repositoryName: 'sotk-devs/sample-repo',
      };

      const result = await controller.create(mockReq, dto);

      expect(service.create).toHaveBeenCalledWith(mockUser.id, dto);
      expect(result).toEqual(mockProject);
    });

    it('should forward resource limits (cpuLimit, memoryLimit, memorySwap) to service.create', async () => {
      const dto = {
        name: 'sample-project',
        repositoryUrl: 'https://github.com/sotk-devs/sample-repo.git',
        repositoryName: 'sotk-devs/sample-repo',
        cpuLimit: 1.0,
        memoryLimit: '512m',
        memorySwap: '1g',
      };

      await controller.create(mockReq, dto);

      expect(service.create).toHaveBeenCalledWith(mockUser.id, dto);
    });
  });

  describe('findAll', () => {
    it('should call service.findAll with authenticated user ID', async () => {
      const result = await controller.findAll(mockReq);

      expect(service.findAll).toHaveBeenCalledWith(mockUser.id);
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('should call service.findOne with user ID and project ID', async () => {
      const result = await controller.findOne(mockReq, mockProject.id);

      expect(service.findOne).toHaveBeenCalledWith(mockUser.id, mockProject.id);
      expect(result).toEqual(mockProject);
    });
  });

  describe('update', () => {
    it('should call service.update with user ID, project ID and update DTO', async () => {
      const updateDto = { name: 'updated-name' };

      const result = await controller.update(
        mockReq,
        mockProject.id,
        updateDto,
      );

      expect(service.update).toHaveBeenCalledWith(
        mockUser.id,
        mockProject.id,
        updateDto,
      );
      expect(result.name).toBe('updated-name');
    });
  });

  describe('remove', () => {
    it('should call service.remove with user ID and project ID', async () => {
      const result = await controller.remove(mockReq, mockProject.id);

      expect(service.remove).toHaveBeenCalledWith(mockUser.id, mockProject.id);
      expect(result).toHaveProperty('message');
    });
  });

  describe('Container Lifecycle endpoints', () => {
    describe('stop', () => {
      it('should call service.stopContainer with user ID and project ID', async () => {
        const result = await controller.stop(mockReq, mockProject.id);

        expect(service.stopContainer).toHaveBeenCalledWith(
          mockUser.id,
          mockProject.id,
        );
        expect(result).toEqual({
          projectId: mockProject.id,
          containerName: 'titan-app-sample-repo',
          action: 'stop',
          status: 'stopped',
          message: 'Contenedor detenido exitosamente.',
        });
      });
    });

    describe('start', () => {
      it('should call service.startContainer with user ID and project ID', async () => {
        const result = await controller.start(mockReq, mockProject.id);

        expect(service.startContainer).toHaveBeenCalledWith(
          mockUser.id,
          mockProject.id,
        );
        expect(result).toEqual({
          projectId: mockProject.id,
          containerName: 'titan-app-sample-repo',
          action: 'start',
          status: 'running',
          message: 'Contenedor iniciado exitosamente.',
        });
      });
    });

    describe('restart', () => {
      it('should call service.restartContainer with user ID and project ID', async () => {
        const result = await controller.restart(mockReq, mockProject.id);

        expect(service.restartContainer).toHaveBeenCalledWith(
          mockUser.id,
          mockProject.id,
        );
        expect(result).toEqual({
          projectId: mockProject.id,
          containerName: 'titan-app-sample-repo',
          action: 'restart',
          status: 'running',
          message: 'Contenedor reiniciado exitosamente.',
        });
      });
    });

    describe('importEnv', () => {
      it('should call service.importEnv with user ID, project ID, and dto', async () => {
        const dto = {
          content: 'PORT=8080\nDB_HOST=localhost',
        };

        const result = await controller.importEnv(
          mockReq,
          mockProject.id,
          dto as any,
        );

        expect(service.importEnv).toHaveBeenCalledWith(
          mockUser.id,
          mockProject.id,
          dto,
        );
        expect(result).toEqual({
          message: 'Variables de entorno importadas exitosamente',
          mode: 'merge',
          importedCount: 2,
          totalCount: 3,
          variables: {
            NODE_ENV: 'production',
            PORT: '8080',
            DB_HOST: 'localhost',
          },
        });
      });
    });

    describe('exportEnv', () => {
      it('should return JSON payload by default', async () => {
        const result = await controller.exportEnv(mockReq, mockProject.id);

        expect(service.exportEnv).toHaveBeenCalledWith(
          mockUser.id,
          mockProject.id,
        );
        expect(result).toEqual({
          raw: 'NODE_ENV=production\nPORT=3000\n',
          variables: { NODE_ENV: 'production', PORT: '3000' },
          count: 2,
        });
      });

      it('should set headers and return raw text string when format is text or raw', async () => {
        const mockRes = {
          setHeader: jest.fn(),
        };

        const result = await controller.exportEnv(
          mockReq,
          mockProject.id,
          'text',
          mockRes as any,
        );

        expect(mockRes.setHeader).toHaveBeenCalledWith(
          'Content-Type',
          'text/plain; charset=utf-8',
        );
        expect(mockRes.setHeader).toHaveBeenCalledWith(
          'Content-Disposition',
          'attachment; filename=".env"',
        );
        expect(result).toBe('NODE_ENV=production\nPORT=3000\n');
      });
    });
  });
});
