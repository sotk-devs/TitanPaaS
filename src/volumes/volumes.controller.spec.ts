import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { VolumesController } from './volumes.controller.js';
import { VolumesService } from './volumes.service.js';

describe('VolumesController', () => {
  let controller: VolumesController;
  let mockVolumesService: jest.Mocked<Partial<VolumesService>>;

  const mockUserReq = {
    user: {
      id: 'user-uuid-1',
      email: 'dev@example.com',
      name: 'Developer',
    },
  };

  const projectId = 'project-uuid-1';
  const volumeId = 'volume-uuid-1';

  const mockVolume = {
    id: volumeId,
    name: 'storage',
    volumeName: 'titan_vol_repo_storage',
    mountPath: '/app/storage',
    readOnly: false,
    size: '10GB',
    projectId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockVolumesService = {
      create: jest.fn<any>().mockResolvedValue(mockVolume),
      findAllByProject: jest.fn<any>().mockResolvedValue([mockVolume]),
      findOne: jest.fn<any>().mockResolvedValue(mockVolume),
      update: jest
        .fn<any>()
        .mockResolvedValue({ ...mockVolume, readOnly: true }),
      remove: jest.fn<any>().mockResolvedValue({
        message: 'Volumen "storage" eliminado exitosamente',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VolumesController],
      providers: [
        {
          provide: VolumesService,
          useValue: mockVolumesService,
        },
      ],
    }).compile();

    controller = module.get<VolumesController>(VolumesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call volumesService.create with correct parameters', async () => {
      const dto = {
        name: 'storage',
        mountPath: '/app/storage',
        readOnly: false,
      };

      const result = await controller.create(mockUserReq, projectId, dto);

      expect(mockVolumesService.create).toHaveBeenCalledWith(
        'user-uuid-1',
        projectId,
        dto,
      );
      expect(result).toEqual(mockVolume);
    });
  });

  describe('findAll', () => {
    it('should call volumesService.findAllByProject', async () => {
      const result = await controller.findAll(mockUserReq, projectId);

      expect(mockVolumesService.findAllByProject).toHaveBeenCalledWith(
        'user-uuid-1',
        projectId,
      );
      expect(result).toEqual([mockVolume]);
    });
  });

  describe('findOne', () => {
    it('should call volumesService.findOne', async () => {
      const result = await controller.findOne(mockUserReq, projectId, volumeId);

      expect(mockVolumesService.findOne).toHaveBeenCalledWith(
        'user-uuid-1',
        projectId,
        volumeId,
      );
      expect(result).toEqual(mockVolume);
    });
  });

  describe('update', () => {
    it('should call volumesService.update', async () => {
      const dto = { readOnly: true };
      const result = await controller.update(
        mockUserReq,
        projectId,
        volumeId,
        dto,
      );

      expect(mockVolumesService.update).toHaveBeenCalledWith(
        'user-uuid-1',
        projectId,
        volumeId,
        dto,
      );
      expect(result.readOnly).toBe(true);
    });
  });

  describe('remove', () => {
    it('should call volumesService.remove', async () => {
      const result = await controller.remove(mockUserReq, projectId, volumeId);

      expect(mockVolumesService.remove).toHaveBeenCalledWith(
        'user-uuid-1',
        projectId,
        volumeId,
      );
      expect(result.message).toContain('eliminado exitosamente');
    });
  });
});
