import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceCleanerService } from './workspace-cleaner.service.js';

describe('WorkspaceCleanerService', () => {
  let service: WorkspaceCleanerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WorkspaceCleanerService],
    }).compile();

    service = module.get<WorkspaceCleanerService>(WorkspaceCleanerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('cleanStaleWorkspaces', () => {
    it('should delete folders older than cutoff and calculate reclaimed space', async () => {
      const now = Date.now();
      const oldTime = now - 48 * 60 * 60 * 1000; // 48 hours ago
      const recentTime = now - 2 * 60 * 60 * 1000; // 2 hours ago

      jest
        .spyOn(service, 'getBaseBuildsPath')
        .mockReturnValue('/tmp/test-builds');

      const mockRepoDirent = {
        name: 'sample_repo',
        isDirectory: () => true,
        isFile: () => false,
      };

      const mockBuild1Dirent = {
        name: 'sha_old_1',
        isDirectory: () => true,
        isFile: () => false,
      };

      const mockBuild2Dirent = {
        name: 'sha_recent_2',
        isDirectory: () => true,
        isFile: () => false,
      };

      let buildScanCount = 0;
      jest
        .spyOn(service, 'readDirectory')
        .mockImplementation((path: string) => {
          if (path === '/tmp/test-builds') {
            return Promise.resolve([mockRepoDirent]);
          }
          if (path.includes('sample_repo')) {
            buildScanCount++;
            if (buildScanCount === 1) {
              return Promise.resolve([mockBuild1Dirent, mockBuild2Dirent]);
            }
            // Second read (check remaining): 1 folder left
            return Promise.resolve([mockBuild2Dirent]);
          }
          return Promise.resolve([]);
        });

      jest.spyOn(service, 'getFileStats').mockImplementation((path: string) => {
        if (path.includes('sha_old_1')) {
          return Promise.resolve({
            mtimeMs: oldTime,
            size: 5000,
          });
        }
        return Promise.resolve({
          mtimeMs: recentTime,
          size: 10000,
        });
      });

      jest.spyOn(service, 'calculateDirectorySize').mockResolvedValue(5000);
      const removeSpy = jest
        .spyOn(service, 'removePath')
        .mockResolvedValue(undefined);

      const result = await service.cleanStaleWorkspaces(24);

      expect(result.workspacesDeleted).toEqual(['sample_repo/sha_old_1']);
      expect(result.spaceReclaimedBytes).toBe(5000);
      expect(removeSpy).toHaveBeenCalledWith(
        expect.stringContaining('sha_old_1'),
      );
    });

    it('should return empty result if base directory read throws an error', async () => {
      jest
        .spyOn(service, 'getBaseBuildsPath')
        .mockReturnValue('/tmp/nonexistent');
      jest
        .spyOn(service, 'readDirectory')
        .mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const result = await service.cleanStaleWorkspaces(24);

      expect(result.workspacesDeleted).toEqual([]);
      expect(result.spaceReclaimedBytes).toBe(0);
    });
  });

  describe('calculateDirectorySize', () => {
    it('should recursively calculate size of files in directory', async () => {
      const mockFile1 = {
        name: 'file1.txt',
        isDirectory: () => false,
        isFile: () => true,
      };
      const mockFile2 = {
        name: 'file2.txt',
        isDirectory: () => false,
        isFile: () => true,
      };

      jest
        .spyOn(service, 'readDirectory')
        .mockResolvedValue([mockFile1, mockFile2]);

      jest.spyOn(service, 'getFileStats').mockResolvedValue({
        mtimeMs: Date.now(),
        size: 1024,
      });

      const total = await service.calculateDirectorySize('/tmp/test-folder');

      expect(total).toBe(2048);
    });
  });
});
