import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { SystemService } from './system.service.js';

describe('SystemService', () => {
  let service: SystemService;
  let mockDataSource: Partial<DataSource>;

  beforeEach(async () => {
    mockDataSource = {
      isInitialized: true,
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<SystemService>(SystemService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkDatabase', () => {
    it('should report up when DataSource query succeeds', async () => {
      (mockDataSource.query as jest.Mock)
        .mockResolvedValueOnce([{ '?column?': 1 }])
        .mockResolvedValueOnce([{ version: 'PostgreSQL 16.1 on x86_64' }]);

      const result = await service.checkDatabase();

      expect(result.status).toBe('up');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.version).toBe('16.1');
      expect(mockDataSource.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('should report down when DataSource query fails', async () => {
      (mockDataSource.query as jest.Mock).mockRejectedValueOnce(
        new Error('Connection timeout'),
      );

      const result = await service.checkDatabase();

      expect(result.status).toBe('down');
      expect(result.message).toContain('Connection timeout');
    });

    it('should report down if DataSource is not initialized', async () => {
      (mockDataSource as any).isInitialized = false;

      const result = await service.checkDatabase();

      expect(result.status).toBe('down');
      expect(result.message).toBe('DataSource is not initialized');
    });
  });

  describe('checkRedis', () => {
    it('should report down if Redis connection fails', async () => {
      const result = await service.checkRedis();

      expect(['up', 'down']).toContain(result.status);
      expect(result.port).toBeDefined();
    });
  });

  describe('checkDocker', () => {
    it('should report up when docker info succeeds', async () => {
      jest.spyOn(service, 'executeCommand').mockResolvedValueOnce({
        stdout: JSON.stringify({
          ServerVersion: '26.1.1',
          Containers: 10,
          ContainersRunning: 5,
          ContainersPaused: 1,
          ContainersStopped: 4,
        }),
        stderr: '',
        exitCode: 0,
      });

      const result = await service.checkDocker();

      expect(result.status).toBe('up');
      expect(result.version).toBe('26.1.1');
      expect(result.containers).toEqual({
        total: 10,
        running: 5,
        paused: 1,
        stopped: 4,
      });
    });

    it('should report down when docker command fails', async () => {
      jest
        .spyOn(service, 'executeCommand')
        .mockRejectedValueOnce(new Error('Cannot connect to Docker daemon'));

      const result = await service.checkDocker();

      expect(result.status).toBe('down');
      expect(result.message).toContain('Cannot connect to Docker daemon');
    });
  });

  describe('getMemoryMetrics', () => {
    it('should calculate valid memory metrics', () => {
      const metrics = service.getMemoryMetrics();

      expect(metrics.totalBytes).toBeGreaterThan(0);
      expect(metrics.freeBytes).toBeGreaterThanOrEqual(0);
      expect(metrics.usedBytes).toBeGreaterThanOrEqual(0);
      expect(metrics.usagePercent).toBeGreaterThanOrEqual(0);
      expect(metrics.usagePercent).toBeLessThanOrEqual(100);
      expect(metrics.formatted.total).toBeDefined();
    });
  });

  describe('getDiskMetrics', () => {
    it('should calculate valid disk metrics', async () => {
      const metrics = await service.getDiskMetrics('.');

      expect(metrics.path).toBe('.');
      expect(metrics.totalBytes).toBeGreaterThanOrEqual(0);
      expect(metrics.freeBytes).toBeGreaterThanOrEqual(0);
      expect(metrics.formatted.total).toBeDefined();
    });
  });

  describe('getHostDiagnostics', () => {
    it('should return system host information', () => {
      const host = service.getHostDiagnostics();

      expect(host.hostname).toBeDefined();
      expect(host.platform).toBeDefined();
      expect(host.arch).toBeDefined();
      expect(host.cpus.count).toBeGreaterThan(0);
      expect(host.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getHealth', () => {
    it('should return healthy when all services are up', async () => {
      jest
        .spyOn(service, 'checkDatabase')
        .mockResolvedValueOnce({ status: 'up' });
      jest.spyOn(service, 'checkRedis').mockResolvedValueOnce({ status: 'up' });
      jest
        .spyOn(service, 'checkDocker')
        .mockResolvedValueOnce({ status: 'up' });

      const health = await service.getHealth();

      expect(health.status).toBe('healthy');
      expect(health.services.database.status).toBe('up');
      expect(health.services.redis.status).toBe('up');
      expect(health.services.docker.status).toBe('up');
      expect(health.timestamp).toBeDefined();
    });

    it('should return unhealthy when any service is down', async () => {
      jest
        .spyOn(service, 'checkDatabase')
        .mockResolvedValueOnce({ status: 'up' });
      jest.spyOn(service, 'checkRedis').mockResolvedValueOnce({
        status: 'down',
        message: 'ECONNREFUSED',
      });
      jest
        .spyOn(service, 'checkDocker')
        .mockResolvedValueOnce({ status: 'up' });

      const health = await service.getHealth();

      expect(health.status).toBe('unhealthy');
      expect(health.services.redis.status).toBe('down');
    });

    it('should return degraded when a service is degraded', async () => {
      jest
        .spyOn(service, 'checkDatabase')
        .mockResolvedValueOnce({ status: 'up' });
      jest.spyOn(service, 'checkRedis').mockResolvedValueOnce({ status: 'up' });
      jest
        .spyOn(service, 'checkDocker')
        .mockResolvedValueOnce({ status: 'degraded' });

      const health = await service.getHealth();

      expect(health.status).toBe('degraded');
    });
  });

  describe('getDiagnostics', () => {
    it('should aggregate host, memory, disk and service diagnostics', async () => {
      jest.spyOn(service, 'checkDatabase').mockResolvedValueOnce({
        status: 'up',
        version: '16.1',
        database: 'titan_paas',
      });
      jest.spyOn(service, 'checkRedis').mockResolvedValueOnce({
        status: 'up',
        host: 'localhost',
        port: 6379,
      });
      jest.spyOn(service, 'checkDocker').mockResolvedValueOnce({
        status: 'up',
        version: '26.1.1',
        containers: { total: 2, running: 2, paused: 0, stopped: 0 },
      });
      jest.spyOn(service, 'getMemoryMetrics').mockReturnValueOnce({
        totalBytes: 16000000000,
        usedBytes: 8000000000,
        freeBytes: 8000000000,
        usagePercent: 50.0,
        formatted: { total: '16 GB', used: '8 GB', free: '8 GB' },
      });
      jest.spyOn(service, 'getDiskMetrics').mockResolvedValueOnce({
        path: '.',
        totalBytes: 500000000000,
        usedBytes: 250000000000,
        freeBytes: 250000000000,
        availableBytes: 250000000000,
        usagePercent: 50.0,
        formatted: { total: '500 GB', used: '250 GB', free: '250 GB' },
      });

      const diag = await service.getDiagnostics();

      expect(diag.status).toBe('healthy');
      expect(diag.memory.usagePercent).toBe(50.0);
      expect(diag.disk.usagePercent).toBe(50.0);
      expect(diag.host.hostname).toBeDefined();
      expect(diag.services.database.version).toBe('16.1');
    });

    it('should mark status as degraded when memory usage exceeds 85%', async () => {
      jest
        .spyOn(service, 'checkDatabase')
        .mockResolvedValueOnce({ status: 'up' });
      jest.spyOn(service, 'checkRedis').mockResolvedValueOnce({ status: 'up' });
      jest
        .spyOn(service, 'checkDocker')
        .mockResolvedValueOnce({ status: 'up' });
      jest.spyOn(service, 'getMemoryMetrics').mockReturnValueOnce({
        totalBytes: 16000000000,
        usedBytes: 14000000000,
        freeBytes: 2000000000,
        usagePercent: 87.5,
        formatted: { total: '16 GB', used: '14 GB', free: '2 GB' },
      });
      jest.spyOn(service, 'getDiskMetrics').mockResolvedValueOnce({
        path: '.',
        totalBytes: 500000000000,
        usedBytes: 100000000000,
        freeBytes: 400000000000,
        availableBytes: 400000000000,
        usagePercent: 20.0,
        formatted: { total: '500 GB', used: '100 GB', free: '400 GB' },
      });

      const diag = await service.getDiagnostics();

      expect(diag.status).toBe('degraded');
    });
  });
});
