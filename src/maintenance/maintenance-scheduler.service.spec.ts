import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { MaintenanceSchedulerService } from './maintenance-scheduler.service.js';
import {
  MAINTENANCE_QUEUE,
  GARBAGE_COLLECTION_JOB,
} from './maintenance.constants.js';

describe('MaintenanceSchedulerService', () => {
  let service: MaintenanceSchedulerService;
  let mockQueue: any;

  beforeEach(async () => {
    mockQueue = {
      getRepeatableJobs: jest.fn().mockResolvedValue([
        {
          name: GARBAGE_COLLECTION_JOB,
          key: 'key-old-job',
        },
      ]),
      removeRepeatableByKey: jest.fn().mockResolvedValue(true),
      add: jest.fn().mockResolvedValue({ id: 'job-123' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceSchedulerService,
        {
          provide: getQueueToken(MAINTENANCE_QUEUE),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<MaintenanceSchedulerService>(
      MaintenanceSchedulerService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('setupRecurringGarbageCollection', () => {
    it('should clear existing repeatable jobs and register new cron schedule', async () => {
      await service.setupRecurringGarbageCollection();

      expect(mockQueue.getRepeatableJobs).toHaveBeenCalled();
      expect(mockQueue.removeRepeatableByKey).toHaveBeenCalledWith(
        'key-old-job',
      );
      expect(mockQueue.add).toHaveBeenCalledWith(
        GARBAGE_COLLECTION_JOB,
        expect.any(Object),
        expect.objectContaining({
          repeat: expect.objectContaining({
            pattern: expect.any(String),
          }),
        }),
      );
    });
  });

  describe('triggerImmediateJob', () => {
    it('should enqueue job immediately and return its id', async () => {
      const id = await service.triggerImmediateJob({ olderThanHours: 6 });

      expect(mockQueue.add).toHaveBeenCalledWith(
        GARBAGE_COLLECTION_JOB,
        { olderThanHours: 6 },
        expect.any(Object),
      );
      expect(id).toBe('job-123');
    });
  });
});
