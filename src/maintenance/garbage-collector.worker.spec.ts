import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { GarbageCollectorWorker } from './garbage-collector.worker.js';
import { GarbageCollectorService } from './garbage-collector.service.js';
import { GARBAGE_COLLECTION_JOB } from './maintenance.constants.js';

describe('GarbageCollectorWorker', () => {
  let worker: GarbageCollectorWorker;
  let mockGarbageCollectorService: jest.Mocked<
    Partial<GarbageCollectorService>
  >;

  beforeEach(async () => {
    mockGarbageCollectorService = {
      runGarbageCollection: jest.fn<any>().mockResolvedValue({
        success: true,
        durationMs: 150,
        imagesDeletedCount: 2,
        totalSpaceReclaimedBytes: 1024,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GarbageCollectorWorker,
        {
          provide: GarbageCollectorService,
          useValue: mockGarbageCollectorService,
        },
      ],
    }).compile();

    worker = module.get<GarbageCollectorWorker>(GarbageCollectorWorker);
  });

  it('should be defined', () => {
    expect(worker).toBeDefined();
  });

  describe('process', () => {
    it('should process garbage collection job and update progress', async () => {
      const mockJob = {
        id: 'job-gc-1',
        name: GARBAGE_COLLECTION_JOB,
        data: { olderThanHours: 12 },
        updateProgress: jest.fn<any>().mockResolvedValue(undefined as never),
      } as unknown as Job;

      const result = await worker.process(mockJob as any);

      expect(mockJob.updateProgress).toHaveBeenCalledWith(10);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(30);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(100);
      expect(
        mockGarbageCollectorService.runGarbageCollection,
      ).toHaveBeenCalledWith({ olderThanHours: 12 });
      expect(result.success).toBe(true);
    });

    it('should throw error when job name is unsupported', async () => {
      const mockJob = {
        id: 'job-unsupported',
        name: 'unknown-job',
        data: {},
      } as unknown as Job;

      await expect(worker.process(mockJob as any)).rejects.toThrow(
        'Unsupported maintenance job: unknown-job',
      );
    });
  });

  describe('Worker events', () => {
    it('should handle onCompleted event without throwing', () => {
      const mockJob = { id: 'job-1' } as Job;
      expect(() => worker.onCompleted(mockJob)).not.toThrow();
    });

    it('should handle onFailed event without throwing', () => {
      const mockJob = { id: 'job-2' } as Job;
      expect(() =>
        worker.onFailed(mockJob, new Error('Prune failed')),
      ).not.toThrow();
    });
  });
});
