import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { GarbageCollectorService } from './garbage-collector.service.js';
import { DockerPruneService } from './docker-prune.service.js';
import { WorkspaceCleanerService } from './workspace-cleaner.service.js';

describe('GarbageCollectorService', () => {
  let service: GarbageCollectorService;
  let mockDockerPruneService: jest.Mocked<Partial<DockerPruneService>>;
  let mockWorkspaceCleanerService: jest.Mocked<
    Partial<WorkspaceCleanerService>
  >;

  beforeEach(async () => {
    mockDockerPruneService = {
      pruneContainers: jest.fn<any>().mockResolvedValue({
        deleted: ['c1', 'c2'],
        spaceReclaimedBytes: 1000,
        raw: '',
      }),
      pruneImages: jest.fn<any>().mockResolvedValue({
        deleted: ['img1'],
        spaceReclaimedBytes: 2000,
        raw: '',
      }),
      pruneVolumes: jest.fn<any>().mockResolvedValue({
        deleted: ['vol1'],
        spaceReclaimedBytes: 500,
        raw: '',
      }),
    };

    mockWorkspaceCleanerService = {
      cleanStaleWorkspaces: jest.fn<any>().mockResolvedValue({
        workspacesDeleted: ['repo/sha1'],
        spaceReclaimedBytes: 3000,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GarbageCollectorService,
        {
          provide: DockerPruneService,
          useValue: mockDockerPruneService,
        },
        {
          provide: WorkspaceCleanerService,
          useValue: mockWorkspaceCleanerService,
        },
      ],
    }).compile();

    service = module.get<GarbageCollectorService>(GarbageCollectorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('runGarbageCollection', () => {
    it('should coordinate all cleaners and return consolidated result', async () => {
      const result = await service.runGarbageCollection({
        olderThanHours: 24,
        pruneContainers: true,
        pruneImages: true,
        pruneVolumes: true,
        cleanWorkspaces: true,
      });

      expect(mockDockerPruneService.pruneContainers).toHaveBeenCalledWith(24);
      expect(mockDockerPruneService.pruneImages).toHaveBeenCalledWith(24);
      expect(mockDockerPruneService.pruneVolumes).toHaveBeenCalled();
      expect(
        mockWorkspaceCleanerService.cleanStaleWorkspaces,
      ).toHaveBeenCalledWith(24);

      expect(result.success).toBe(true);
      expect(result.containersDeletedCount).toBe(2);
      expect(result.imagesDeletedCount).toBe(1);
      expect(result.volumesDeletedCount).toBe(1);
      expect(result.workspacesDeletedCount).toBe(1);
      expect(result.totalSpaceReclaimedBytes).toBe(6500); // 1000 + 2000 + 500 + 3000
      expect(result.totalSpaceReclaimedFormatted).toBe('6.35 KB');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should prevent overlapping executions with ConflictException', async () => {
      let resolveFirstCall: () => void;
      mockDockerPruneService.pruneContainers = jest
        .fn<any>()
        .mockImplementation(
          () =>
            new Promise((resolve) => {
              resolveFirstCall = () =>
                resolve({
                  deleted: [],
                  spaceReclaimedBytes: 0,
                  raw: '',
                });
            }),
        );

      const firstExecution = service.runGarbageCollection();

      await expect(service.runGarbageCollection()).rejects.toThrow(
        ConflictException,
      );

      resolveFirstCall!();
      await firstExecution;
    });

    it('should respect selective flags for pruning', async () => {
      await service.runGarbageCollection({
        pruneContainers: false,
        pruneImages: true,
        pruneVolumes: false,
        cleanWorkspaces: false,
      });

      expect(mockDockerPruneService.pruneContainers).not.toHaveBeenCalled();
      expect(mockDockerPruneService.pruneImages).toHaveBeenCalled();
      expect(mockDockerPruneService.pruneVolumes).not.toHaveBeenCalled();
      expect(
        mockWorkspaceCleanerService.cleanStaleWorkspaces,
      ).not.toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('should return initial idle status', () => {
      const status = service.getStatus();
      expect(status.isRunning).toBe(false);
      expect(status.lastRun).toBeNull();
      expect(status.scheduler.enabled).toBe(true);
      expect(status.scheduler.cronExpression).toBeDefined();
    });

    it('should return last run result after execution', async () => {
      await service.runGarbageCollection();
      const status = service.getStatus();
      expect(status.lastRun).not.toBeNull();
      expect(status.lastRun?.success).toBe(true);
    });
  });

  describe('formatBytes', () => {
    it('should format 0 bytes', () => {
      expect(service.formatBytes(0)).toBe('0 B');
    });

    it('should format bytes to KB', () => {
      expect(service.formatBytes(1024)).toBe('1 KB');
    });

    it('should format bytes to MB', () => {
      expect(service.formatBytes(1024 * 1024 * 2.5)).toBe('2.5 MB');
    });

    it('should format bytes to GB', () => {
      expect(service.formatBytes(1024 * 1024 * 1024 * 5)).toBe('5 GB');
    });
  });
});
