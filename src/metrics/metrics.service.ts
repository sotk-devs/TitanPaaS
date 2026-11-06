import {
  Injectable,
  Logger,
  Optional,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { spawn } from 'node:child_process';
import {
  ContainerMetrics,
  RawDockerStats,
} from './interfaces/container-metrics.interface.js';
import { MetricsGateway } from './metrics.gateway.js';
import { Project } from '../projects/entities/project.entity.js';
import { Deployment } from '../deployments/entities/deployment.entity.js';
import { DeploymentStatus } from '../deployments/enums/deployment-status.enum.js';

@Injectable()
export class MetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MetricsService.name);
  private pollingInterval: NodeJS.Timeout | null = null;

  constructor(
    @Optional()
    private readonly metricsGateway?: MetricsGateway,
    @Optional()
    @InjectRepository(Project)
    private readonly projectRepository?: Repository<Project>,
    @Optional()
    @InjectRepository(Deployment)
    private readonly deploymentRepository?: Repository<Deployment>,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV !== 'test') {
      this.startPolling(5000);
    }
  }

  onModuleDestroy() {
    this.stopPolling();
  }

  startPolling(intervalMs = 5000) {
    this.stopPolling();
    this.pollingInterval = setInterval(async () => {
      await this.collectAndEmitMetrics();
    }, intervalMs);
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  async executeCommand(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { shell: true });
      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (err) => {
        reject(err);
      });

      child.on('close', (exitCode) => {
        if (exitCode !== 0) {
          reject(
            new Error(
              stderr || stdout || `Process exited with code ${exitCode}`,
            ),
          );
        } else {
          resolve(stdout);
        }
      });
    });
  }

  parseDockerStatsLine(line: string): ContainerMetrics | null {
    const trimmed = line.trim();
    if (!trimmed) {
      return null;
    }

    try {
      const raw: RawDockerStats = JSON.parse(trimmed);
      const containerId = raw.Container || raw.ID || '';
      const name = raw.Name || containerId;

      const cpuPercentage =
        parseFloat((raw.CPUPerc || '0').replace('%', '')) || 0;
      const memPerc = parseFloat((raw.MemPerc || '0').replace('%', '')) || 0;

      const memParts = (raw.MemUsage || '0B / 0B')
        .split('/')
        .map((s) => s.trim());
      const memoryUsage = memParts[0] || '0B';
      const memoryLimit = memParts[1] || '0B';

      const netParts = (raw.NetIO || '0B / 0B').split('/').map((s) => s.trim());
      const networkInput = netParts[0] || '0B';
      const networkOutput = netParts[1] || '0B';

      const blockParts = (raw.BlockIO || '0B / 0B')
        .split('/')
        .map((s) => s.trim());
      const blockInput = blockParts[0] || '0B';
      const blockOutput = blockParts[1] || '0B';

      const pids = parseInt(raw.PIDs || '0', 10) || 0;

      return {
        containerId,
        name,
        cpuPercentage,
        memoryUsage,
        memoryLimit,
        memoryPercentage: memPerc,
        networkInput,
        networkOutput,
        blockInput,
        blockOutput,
        pids,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      void error;
      return null;
    }
  }

  async getContainerMetrics(
    containerIdOrName: string,
  ): Promise<ContainerMetrics | null> {
    try {
      const output = await this.executeCommand('docker', [
        'stats',
        '--no-stream',
        '--format',
        '{{json .}}',
        containerIdOrName,
      ]);
      const lines = output.trim().split('\n');
      for (const line of lines) {
        const parsed = this.parseDockerStatsLine(line);
        if (parsed) {
          return parsed;
        }
      }
      return null;
    } catch (error) {
      this.logger.warn(
        `Failed to collect metrics for container ${containerIdOrName}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  async getAllContainersMetrics(): Promise<ContainerMetrics[]> {
    try {
      const output = await this.executeCommand('docker', [
        'stats',
        '--no-stream',
        '--format',
        '{{json .}}',
      ]);
      const metrics: ContainerMetrics[] = [];
      const lines = output.trim().split('\n');
      for (const line of lines) {
        const parsed = this.parseDockerStatsLine(line);
        if (parsed) {
          metrics.push(parsed);
        }
      }
      return metrics;
    } catch (error) {
      this.logger.warn(
        `Failed to collect docker metrics: ${(error as Error).message}`,
      );
      return [];
    }
  }

  async getProjectMetrics(projectId: string): Promise<ContainerMetrics | null> {
    if (this.deploymentRepository) {
      const deployment = await this.deploymentRepository.findOne({
        where: { projectId, status: DeploymentStatus.DEPLOYED },
        order: { createdAt: 'DESC' },
      });
      if (deployment?.containerId) {
        return this.getContainerMetrics(deployment.containerId);
      }
    }

    if (this.projectRepository) {
      const project = await this.projectRepository.findOne({
        where: { id: projectId },
      });
      if (project) {
        const sanitizedRepo = project.repositoryName
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, '-');
        const containerName = `titan-app-${sanitizedRepo}`;
        return this.getContainerMetrics(containerName);
      }
    }

    return null;
  }

  async collectAndEmitMetrics(): Promise<ContainerMetrics[]> {
    const metrics = await this.getAllContainersMetrics();
    if (this.metricsGateway) {
      for (const metric of metrics) {
        this.metricsGateway.emitContainerMetrics(metric.containerId, metric);
        if (metric.name && metric.name !== metric.containerId) {
          this.metricsGateway.emitContainerMetrics(metric.name, metric);
        }
      }
    }
    return metrics;
  }
}
