import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { MetricsController } from './metrics.controller.js';
import { MetricsService } from './metrics.service.js';
import { ContainerMetrics } from './interfaces/container-metrics.interface.js';

describe('MetricsController', () => {
  let controller: MetricsController;
  let mockMetricsService: jest.Mocked<Partial<MetricsService>>;

  const mockMetric: ContainerMetrics = {
    containerId: 'container-1',
    name: 'titan-app-demo',
    cpuPercentage: 10.5,
    memoryUsage: '100MiB',
    memoryLimit: '1GiB',
    memoryPercentage: 10.0,
    networkInput: '1MB',
    networkOutput: '2MB',
    blockInput: '0B',
    blockOutput: '0B',
    pids: 4,
    timestamp: new Date().toISOString(),
  };

  beforeEach(() => {
    mockMetricsService = {
      getAllContainersMetrics: jest.fn<any>(),
      getContainerMetrics: jest.fn<any>(),
      getProjectMetrics: jest.fn<any>(),
    };

    controller = new MetricsController(mockMetricsService as MetricsService);
  });

  describe('getAllMetrics', () => {
    it('should return all container metrics', async () => {
      mockMetricsService.getAllContainersMetrics = jest
        .fn<any>()
        .mockResolvedValue([mockMetric]);

      const result = await controller.getAllMetrics();

      expect(mockMetricsService.getAllContainersMetrics).toHaveBeenCalled();
      expect(result).toEqual([mockMetric]);
    });
  });

  describe('getContainerMetrics', () => {
    it('should return metrics for existing container', async () => {
      mockMetricsService.getContainerMetrics = jest
        .fn<any>()
        .mockResolvedValue(mockMetric);

      const result = await controller.getContainerMetrics('container-1');

      expect(mockMetricsService.getContainerMetrics).toHaveBeenCalledWith(
        'container-1',
      );
      expect(result).toEqual(mockMetric);
    });

    it('should throw NotFoundException when container metrics not found', async () => {
      mockMetricsService.getContainerMetrics = jest
        .fn<any>()
        .mockResolvedValue(null);

      await expect(
        controller.getContainerMetrics('non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getProjectMetrics', () => {
    it('should return metrics for existing project', async () => {
      mockMetricsService.getProjectMetrics = jest
        .fn<any>()
        .mockResolvedValue(mockMetric);

      const result = await controller.getProjectMetrics('uuid-project-1');

      expect(mockMetricsService.getProjectMetrics).toHaveBeenCalledWith(
        'uuid-project-1',
      );
      expect(result).toEqual(mockMetric);
    });

    it('should throw NotFoundException when project metrics not found', async () => {
      mockMetricsService.getProjectMetrics = jest
        .fn<any>()
        .mockResolvedValue(null);

      await expect(
        controller.getProjectMetrics('uuid-unknown'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
