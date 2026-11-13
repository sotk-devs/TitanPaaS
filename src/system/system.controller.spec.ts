import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { SystemController } from './system.controller.js';
import { SystemService } from './system.service.js';
import type {
  SystemDiagnosticsResponse,
  SystemHealthResponse,
} from './interfaces/system-health.interface.js';

describe('SystemController', () => {
  let controller: SystemController;
  let systemService: jest.Mocked<SystemService>;

  beforeEach(async () => {
    const mockSystemService = {
      getHealth: jest.fn(),
      getDiagnostics: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SystemController],
      providers: [
        {
          provide: SystemService,
          useValue: mockSystemService,
        },
      ],
    }).compile();

    controller = module.get<SystemController>(SystemController);
    systemService = module.get(SystemService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getHealth', () => {
    it('should return healthy system status', async () => {
      const mockHealth: SystemHealthResponse = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: 100,
        services: {
          database: { status: 'up' },
          redis: { status: 'up' },
          docker: { status: 'up' },
        },
      };

      systemService.getHealth.mockResolvedValueOnce(mockHealth);

      const mockRes = {
        status: jest.fn(),
      } as unknown as Response;

      const result = await controller.getHealth(mockRes);

      expect(result).toEqual(mockHealth);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should set HTTP 503 status when system is unhealthy', async () => {
      const mockHealth: SystemHealthResponse = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: 100,
        services: {
          database: { status: 'down', message: 'Connection refused' },
          redis: { status: 'up' },
          docker: { status: 'up' },
        },
      };

      systemService.getHealth.mockResolvedValueOnce(mockHealth);

      const mockRes = {
        status: jest.fn(),
      } as unknown as Response;

      const result = await controller.getHealth(mockRes);

      expect(result).toEqual(mockHealth);
      expect(mockRes.status).toHaveBeenCalledWith(
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    });
  });

  describe('getDiagnostics', () => {
    it('should return full system diagnostics', async () => {
      const mockDiag: SystemDiagnosticsResponse = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        host: {
          hostname: 'srv-1',
          platform: 'linux',
          release: '5.15.0',
          arch: 'x64',
          cpus: { count: 4, model: 'Intel', speed: 2500 },
          loadAvg: [0.1, 0.2, 0.3],
          uptimeSeconds: 12000,
        },
        memory: {
          totalBytes: 16000000000,
          usedBytes: 8000000000,
          freeBytes: 8000000000,
          usagePercent: 50.0,
          formatted: { total: '16 GB', used: '8 GB', free: '8 GB' },
        },
        disk: {
          path: '.',
          totalBytes: 500000000000,
          usedBytes: 250000000000,
          freeBytes: 250000000000,
          availableBytes: 250000000000,
          usagePercent: 50.0,
          formatted: { total: '500 GB', used: '250 GB', free: '250 GB' },
        },
        services: {
          database: { status: 'up', version: '16.1' },
          redis: { status: 'up', host: 'localhost', port: 6379 },
          docker: { status: 'up', version: '26.1.1' },
        },
      };

      systemService.getDiagnostics.mockResolvedValueOnce(mockDiag);

      const result = await controller.getDiagnostics();

      expect(result).toEqual(mockDiag);
      expect(systemService.getDiagnostics).toHaveBeenCalled();
    });
  });
});
