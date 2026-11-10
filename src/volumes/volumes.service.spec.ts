import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { VolumesService } from './volumes.service.js';
import { ProjectVolume } from './entities/project-volume.entity.js';
import { Project } from '../projects/entities/project.entity.js';
import { DockerPipelineService } from '../deployment/docker-pipeline.service.js';

describe('VolumesService', () => {
  let service: VolumesService;
  let mockVolumeRepo: jest.Mocked<Partial<Repository<ProjectVolume>>>;
  let mockProjectRepo: jest.Mocked<Partial<Repository<Project>>>;
  let mockDockerPipeline: jest.Mocked<Partial<DockerPipelineService>>;

  const userId = 'user-uuid-1';
  const otherUserId = 'user-uuid-2';
  const projectId = 'project-uuid-1';

  const mockProject: Project = {
    id: projectId,
    name: 'sample-project',
    repositoryUrl: 'https://github.com/org/sample-repo.git',
    repositoryName: 'org/sample-repo',
    branch: 'main',
    port: 3000,
    envVariables: {},
    userId,
    user: null as any,
    deployments: [],
    customDomains: [],
    healthcheckPath: null,
    healthcheckExpectedStatus: 200,
    healthcheckTimeout: 5,
    healthcheckRetries: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockVolume: ProjectVolume = {
    id: 'vol-uuid-1',
    name: 'uploads',
    volumeName: 'titan_vol_org_sample_repo_uploads',
    mountPath: '/app/uploads',
    readOnly: false,
    size: '10GB',
    projectId,
    project: mockProject,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockVolumeRepo = {
      create: jest.fn<any>().mockImplementation((dto: any) => ({
        ...dto,
        id: 'vol-uuid-new',
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      save: jest
        .fn<any>()
        .mockImplementation((vol: any) => Promise.resolve(vol)),
      find: jest.fn<any>().mockResolvedValue([mockVolume]),
      findOne: jest.fn<any>().mockResolvedValue(null),
      delete: jest.fn<any>().mockResolvedValue({ affected: 1 }),
    };

    mockProjectRepo = {
      findOne: jest.fn<any>().mockResolvedValue(mockProject),
    };

    mockDockerPipeline = {
      createDockerVolume: jest.fn<any>().mockResolvedValue(undefined),
      removeDockerVolume: jest.fn<any>().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VolumesService,
        {
          provide: getRepositoryToken(ProjectVolume),
          useValue: mockVolumeRepo,
        },
        {
          provide: getRepositoryToken(Project),
          useValue: mockProjectRepo,
        },
        {
          provide: DockerPipelineService,
          useValue: mockDockerPipeline,
        },
      ],
    }).compile();

    service = module.get<VolumesService>(VolumesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should successfully create a volume and call docker volume create', async () => {
      const dto = {
        name: 'uploads',
        mountPath: '/app/uploads',
        readOnly: false,
        size: '10GB',
      };

      const result = await service.create(userId, projectId, dto);

      expect(mockProjectRepo.findOne).toHaveBeenCalledWith({
        where: { id: projectId },
      });
      expect(mockDockerPipeline.createDockerVolume).toHaveBeenCalledWith(
        'titan_vol_org_sample_repo_uploads',
      );
      expect(mockVolumeRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'uploads',
          volumeName: 'titan_vol_org_sample_repo_uploads',
          mountPath: '/app/uploads',
          readOnly: false,
          size: '10GB',
          projectId,
        }),
      );
      expect(result.volumeName).toBe('titan_vol_org_sample_repo_uploads');
    });

    it('should throw NotFoundException if project does not exist', async () => {
      mockProjectRepo.findOne = jest.fn<any>().mockResolvedValue(null);

      await expect(
        service.create(userId, projectId, {
          name: 'data',
          mountPath: '/data',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not the project owner', async () => {
      await expect(
        service.create(otherUserId, projectId, {
          name: 'data',
          mountPath: '/data',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if mountPath already exists for project', async () => {
      mockVolumeRepo.findOne = jest.fn<any>().mockResolvedValueOnce(mockVolume); // existing path

      await expect(
        service.create(userId, projectId, {
          name: 'another-name',
          mountPath: '/app/uploads',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if name already exists for project', async () => {
      mockVolumeRepo.findOne = jest
        .fn<any>()
        .mockResolvedValueOnce(null) // no duplicate path
        .mockResolvedValueOnce(mockVolume); // duplicate name

      await expect(
        service.create(userId, projectId, {
          name: 'uploads',
          mountPath: '/app/other-path',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAllByProject', () => {
    it('should return all volumes for the given project', async () => {
      const volumes = await service.findAllByProject(userId, projectId);

      expect(mockVolumeRepo.find).toHaveBeenCalledWith({
        where: { projectId },
        order: { createdAt: 'ASC' },
      });
      expect(volumes).toHaveLength(1);
      expect(volumes[0].name).toBe('uploads');
    });
  });

  describe('findOne', () => {
    it('should return volume if found', async () => {
      mockVolumeRepo.findOne = jest.fn<any>().mockResolvedValue(mockVolume);

      const volume = await service.findOne(userId, projectId, 'vol-uuid-1');

      expect(volume).toEqual(mockVolume);
    });

    it('should throw NotFoundException if volume does not exist', async () => {
      mockVolumeRepo.findOne = jest.fn<any>().mockResolvedValue(null);

      await expect(
        service.findOne(userId, projectId, 'nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update readOnly and size properties', async () => {
      mockVolumeRepo.findOne = jest
        .fn<any>()
        .mockResolvedValue({ ...mockVolume });

      const updated = await service.update(userId, projectId, 'vol-uuid-1', {
        readOnly: true,
        size: '25GB',
      });

      expect(updated.readOnly).toBe(true);
      expect(updated.size).toBe('25GB');
      expect(mockVolumeRepo.save).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should remove volume from database and call docker volume rm', async () => {
      mockVolumeRepo.findOne = jest.fn<any>().mockResolvedValue(mockVolume);

      const result = await service.remove(userId, projectId, 'vol-uuid-1');

      expect(mockDockerPipeline.removeDockerVolume).toHaveBeenCalledWith(
        'titan_vol_org_sample_repo_uploads',
      );
      expect(mockVolumeRepo.delete).toHaveBeenCalledWith('vol-uuid-1');
      expect(result.message).toContain('eliminado exitosamente');
    });
  });
});
