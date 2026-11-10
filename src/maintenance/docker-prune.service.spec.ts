import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { DockerPruneService } from './docker-prune.service.js';

describe('DockerPruneService', () => {
  let service: DockerPruneService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DockerPruneService],
    }).compile();

    service = module.get<DockerPruneService>(DockerPruneService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('pruneImages', () => {
    it('should parse deleted images and space reclaimed successfully', async () => {
      const mockStdout = `
Deleted Images:
deleted: sha256:abc123def456
untagged: titan-app:old
deleted: sha256:789xyz123456

Total reclaimed space: 1.5GB
`;
      jest.spyOn(service, 'executeCommand').mockResolvedValue({
        stdout: mockStdout,
        stderr: '',
        exitCode: 0,
      });

      const result = await service.pruneImages(24);

      expect(service.executeCommand).toHaveBeenCalledWith('docker', [
        'image',
        'prune',
        '-a',
        '-f',
        '--filter',
        'until=24h',
      ]);
      expect(result.deleted).toEqual([
        'sha256:abc123def456',
        'titan-app:old',
        'sha256:789xyz123456',
      ]);
      expect(result.spaceReclaimedBytes).toBe(
        Math.round(1.5 * 1024 * 1024 * 1024),
      );
    });

    it('should handle errors gracefully and return zero metrics', async () => {
      jest
        .spyOn(service, 'executeCommand')
        .mockRejectedValue(new Error('Docker daemon not responding'));

      const result = await service.pruneImages(12);

      expect(result.deleted).toEqual([]);
      expect(result.spaceReclaimedBytes).toBe(0);
      expect(result.raw).toContain('Docker daemon not responding');
    });
  });

  describe('pruneContainers', () => {
    it('should parse deleted containers and space reclaimed', async () => {
      const mockStdout = `
c123456789ab
d987654321fe
Total reclaimed space: 250MB
`;
      jest.spyOn(service, 'executeCommand').mockResolvedValue({
        stdout: mockStdout,
        stderr: '',
        exitCode: 0,
      });

      const result = await service.pruneContainers(48);

      expect(result.deleted).toEqual(['c123456789ab', 'd987654321fe']);
      expect(result.spaceReclaimedBytes).toBe(250 * 1024 * 1024);
    });
  });

  describe('pruneVolumes', () => {
    it('should parse deleted volumes and space reclaimed', async () => {
      const mockStdout = `
vol_orphan_1
vol_orphan_2
Total reclaimed space: 12.5MB
`;
      jest.spyOn(service, 'executeCommand').mockResolvedValue({
        stdout: mockStdout,
        stderr: '',
        exitCode: 0,
      });

      const result = await service.pruneVolumes();

      expect(result.deleted).toEqual(['vol_orphan_1', 'vol_orphan_2']);
      expect(result.spaceReclaimedBytes).toBe(Math.round(12.5 * 1024 * 1024));
    });
  });

  describe('parseSpaceReclaimed', () => {
    it('should return 0 when no match is found', () => {
      expect(service.parseSpaceReclaimed('No space reclaimed')).toBe(0);
    });

    it('should parse bytes (B)', () => {
      expect(service.parseSpaceReclaimed('Total reclaimed space: 500B')).toBe(
        500,
      );
    });

    it('should parse kilobytes (KB)', () => {
      expect(service.parseSpaceReclaimed('Total reclaimed space: 200kB')).toBe(
        200 * 1024,
      );
    });

    it('should parse megabytes (MB)', () => {
      expect(service.parseSpaceReclaimed('Total reclaimed space: 100MB')).toBe(
        100 * 1024 * 1024,
      );
    });

    it('should parse gigabytes (GB)', () => {
      expect(service.parseSpaceReclaimed('Total reclaimed space: 2GB')).toBe(
        2 * 1024 * 1024 * 1024,
      );
    });
  });
});
