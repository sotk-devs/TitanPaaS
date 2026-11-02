import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProjectsService } from './projects.service.js';
import { Project } from './entities/project.entity.js';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let repository: jest.Mocked<Partial<Repository<Project>>>;

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
    userId: mockUserId,
    user: null as any,
    deployments: [],
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: getRepositoryToken(Project),
          useValue: repository,
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
        relations: ['deployments'],
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
});
