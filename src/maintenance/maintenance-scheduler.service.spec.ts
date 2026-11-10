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
      upsertJobScheduler: jest.fn().mockResolvedValue({ id: 'sched-1' }),
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
    it('should register cron schedule via upsertJobScheduler', async () => {
      await service.setupRecurringGarbageCollection();

      expect(mockQueue.upsertJobScheduler).toHaveBeenCalledWith(
        'docker-gc-scheduler',
        expect.objectContaining({
          pattern: expect.any(String),
        }),
        expect.objectContaining({
          name: GARBAGE_COLLECTION_JOB,
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
