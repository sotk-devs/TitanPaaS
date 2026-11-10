import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { Repository } from 'typeorm';
import { MetricsService } from './metrics.service.js';
import { MetricsGateway } from './metrics.gateway.js';
import { Project } from '../projects/entities/project.entity.js';
import { Deployment } from '../deployments/entities/deployment.entity.js';
import { DeploymentStatus } from '../deployments/enums/deployment-status.enum.js';

describe('MetricsService', () => {
  let service: MetricsService;
  let mockGateway: jest.Mocked<Partial<MetricsGateway>>;
  let mockProjectRepo: jest.Mocked<Partial<Repository<Project>>>;
  let mockDeploymentRepo: jest.Mocked<Partial<Repository<Deployment>>>;

  const sampleDockerStatsJson = JSON.stringify({
    BlockIO: '10MB / 20MB',
    CPUPerc: '12.50%',
    Container: 'titan-app-demo',
    ID: 'container-uuid-1',
    MemPerc: '4.25%',
    MemUsage: '128MiB / 2GiB',
    Name: 'titan-app-demo',
    NetIO: '1.5MB / 3.0MB',
    PIDs: '8',
  });

  beforeEach(() => {
    mockGateway = {
      emitContainerMetrics: jest.fn(),
      emitProjectMetrics: jest.fn(),
    };

    mockProjectRepo = {
      findOne: jest.fn<any>(),
    };

    mockDeploymentRepo = {
      findOne: jest.fn<any>(),
    };

    service = new MetricsService(
      mockGateway as MetricsGateway,
      mockProjectRepo as Repository<Project>,
      mockDeploymentRepo as Repository<Deployment>,
    );
  });

  afterEach(() => {
    service.stopPolling();
  });

  describe('parseDockerStatsLine', () => {
    it('should correctly parse valid docker stats json', () => {
      const parsed = service.parseDockerStatsLine(sampleDockerStatsJson);

      expect(parsed).not.toBeNull();
      expect(parsed?.containerId).toBe('titan-app-demo');
      expect(parsed?.name).toBe('titan-app-demo');
      expect(parsed?.cpuPercentage).toBe(12.5);
      expect(parsed?.memoryPercentage).toBe(4.25);
      expect(parsed?.memoryUsage).toBe('128MiB');
      expect(parsed?.memoryLimit).toBe('2GiB');
      expect(parsed?.networkInput).toBe('1.5MB');
      expect(parsed?.networkOutput).toBe('3.0MB');
      expect(parsed?.blockInput).toBe('10MB');
      expect(parsed?.blockOutput).toBe('20MB');
      expect(parsed?.pids).toBe(8);
      expect(parsed?.timestamp).toBeDefined();
    });

    it('should return null for empty or invalid line', () => {
      expect(service.parseDockerStatsLine('')).toBeNull();
      expect(service.parseDockerStatsLine('   ')).toBeNull();
      expect(service.parseDockerStatsLine('{ invalid json')).toBeNull();
    });

    it('should use fallback defaults when fields are missing', () => {
      const parsed = service.parseDockerStatsLine('{}');
      expect(parsed).not.toBeNull();
      expect(parsed?.cpuPercentage).toBe(0);
      expect(parsed?.memoryPercentage).toBe(0);
      expect(parsed?.memoryUsage).toBe('0B');
      expect(parsed?.memoryLimit).toBe('0B');
      expect(parsed?.networkInput).toBe('0B');
      expect(parsed?.networkOutput).toBe('0B');
      expect(parsed?.pids).toBe(0);
    });
  });

  describe('getContainerMetrics', () => {
    it('should return parsed metrics when docker stats command succeeds', async () => {
      jest
        .spyOn(service, 'executeCommand')
        .mockResolvedValue(sampleDockerStatsJson + '\n');

      const result = await service.getContainerMetrics('titan-app-demo');

      expect(service.executeCommand).toHaveBeenCalledWith('docker', [
        'stats',
        '--no-stream',
        '--format',
        '{{json .}}',
        'titan-app-demo',
      ]);
      expect(result).not.toBeNull();
      expect(result?.name).toBe('titan-app-demo');
      expect(result?.cpuPercentage).toBe(12.5);
    });

    it('should return null when docker stats command throws', async () => {
      jest
        .spyOn(service, 'executeCommand')
        .mockRejectedValue(new Error('No such container'));

      const result = await service.getContainerMetrics('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getAllContainersMetrics', () => {
    it('should return multiple container metrics', async () => {
      const secondContainer = JSON.stringify({
        BlockIO: '0B / 0B',
        CPUPerc: '1.20%',
        Container: 'titan-postgres',
        ID: 'container-uuid-2',
        MemPerc: '1.00%',
        MemUsage: '64MiB / 2GiB',
        Name: 'titan-postgres',
        NetIO: '500B / 200B',
        PIDs: '5',
      });

      jest
        .spyOn(service, 'executeCommand')
        .mockResolvedValue(`${sampleDockerStatsJson}\n${secondContainer}\n`);

      const results = await service.getAllContainersMetrics();

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('titan-app-demo');
      expect(results[1].name).toBe('titan-postgres');
    });

    it('should return empty array on failure', async () => {
      jest
        .spyOn(service, 'executeCommand')
        .mockRejectedValue(new Error('Docker daemon down'));

      const results = await service.getAllContainersMetrics();

      expect(results).toEqual([]);
    });
  });

  describe('getProjectMetrics', () => {
    it('should retrieve metrics by active deployment containerId', async () => {
      mockDeploymentRepo.findOne = jest.fn<any>().mockResolvedValue({
        id: 'deploy-1',
        projectId: 'project-uuid-1',
        status: DeploymentStatus.DEPLOYED,
        containerId: 'container-deploy-1',
      });

      jest
        .spyOn(service, 'getContainerMetrics')
        .mockResolvedValue(service.parseDockerStatsLine(sampleDockerStatsJson));

      const result = await service.getProjectMetrics('project-uuid-1');

      expect(mockDeploymentRepo.findOne).toHaveBeenCalledWith({
        where: {
          projectId: 'project-uuid-1',
          status: DeploymentStatus.DEPLOYED,
        },
        order: { createdAt: 'DESC' },
      });
      expect(service.getContainerMetrics).toHaveBeenCalledWith(
        'container-deploy-1',
      );
      expect(result).not.toBeNull();
    });

    it('should fall back to project repository name container when no deployment containerId', async () => {
      mockDeploymentRepo.findOne = jest.fn<any>().mockResolvedValue(null);
      mockProjectRepo.findOne = jest.fn<any>().mockResolvedValue({
        id: 'project-uuid-2',
        repositoryName: 'sotk-devs/sample-api',
      });

      jest
        .spyOn(service, 'getContainerMetrics')
        .mockResolvedValue(service.parseDockerStatsLine(sampleDockerStatsJson));

      const result = await service.getProjectMetrics('project-uuid-2');

      expect(service.getContainerMetrics).toHaveBeenCalledWith(
        'titan-app-sotk-devs-sample-api',
      );
      expect(result).not.toBeNull();
    });

    it('should return null when neither deployment nor project found', async () => {
      mockDeploymentRepo.findOne = jest.fn<any>().mockResolvedValue(null);
      mockProjectRepo.findOne = jest.fn<any>().mockResolvedValue(null);

      const result = await service.getProjectMetrics('unknown-uuid');
      expect(result).toBeNull();
    });
  });

  describe('collectAndEmitMetrics', () => {
    it('should fetch metrics and emit them to gateway', async () => {
      const parsed = service.parseDockerStatsLine(sampleDockerStatsJson)!;
      jest
        .spyOn(service, 'getAllContainersMetrics')
        .mockResolvedValue([parsed]);

      const emitted = await service.collectAndEmitMetrics();

      expect(emitted).toEqual([parsed]);
      expect(mockGateway.emitContainerMetrics).toHaveBeenCalledWith(
        'titan-app-demo',
        parsed,
      );
    });
  });

  describe('lifecycle and polling', () => {
    it('should start and stop polling properly', () => {
      service.startPolling(1000);
      expect((service as any).pollingInterval).not.toBeNull();
      service.stopPolling();
      expect((service as any).pollingInterval).toBeNull();
    });

    it('should handle onModuleDestroy', () => {
      service.startPolling(1000);
      service.onModuleDestroy();
      expect((service as any).pollingInterval).toBeNull();
    });
  });
});
