import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { MaintenanceController } from './maintenance.controller.js';
import { GarbageCollectorService } from './garbage-collector.service.js';
import type { TriggerGcDto } from './dto/trigger-gc.dto.js';

describe('MaintenanceController', () => {
  let controller: MaintenanceController;
  let mockGarbageCollectorService: jest.Mocked<
    Partial<GarbageCollectorService>
  >;

  beforeEach(async () => {
    mockGarbageCollectorService = {
      runGarbageCollection: jest.fn<any>().mockResolvedValue({
        success: true,
        durationMs: 250,
        imagesDeletedCount: 4,
        containersDeletedCount: 2,
        volumesDeletedCount: 0,
        workspacesDeletedCount: 1,
        totalSpaceReclaimedBytes: 1048576,
        totalSpaceReclaimedFormatted: '1 MB',
      }),
      getStatus: jest.fn<any>().mockReturnValue({
        isRunning: false,
        lastRun: null,
        scheduler: {
          enabled: true,
          cronExpression: '0 3 * * *',
        },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MaintenanceController],
      providers: [
        {
          provide: GarbageCollectorService,
          useValue: mockGarbageCollectorService,
        },
      ],
    }).compile();

    controller = module.get<MaintenanceController>(MaintenanceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('triggerGarbageCollection', () => {
    it('should invoke runGarbageCollection with provided DTO options', async () => {
      const dto: TriggerGcDto = {
        olderThanHours: 48,
        pruneImages: true,
        pruneContainers: false,
      };

      const result = await controller.triggerGarbageCollection(dto);

      expect(
        mockGarbageCollectorService.runGarbageCollection,
      ).toHaveBeenCalledWith(dto);
      expect(result.success).toBe(true);
      expect(result.imagesDeletedCount).toBe(4);
    });
  });

  describe('getStatus', () => {
    it('should return garbage collection status from service', () => {
      const status = controller.getStatus();

      expect(mockGarbageCollectorService.getStatus).toHaveBeenCalled();
      expect(status.isRunning).toBe(false);
      expect(status.scheduler.enabled).toBe(true);
    });
  });
});
