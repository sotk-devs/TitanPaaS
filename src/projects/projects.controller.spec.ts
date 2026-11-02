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
});
