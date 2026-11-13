import { Injectable, Logger, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Redis } from 'ioredis';
import { spawn } from 'node:child_process';
import * as os from 'node:os';
import * as fs from 'node:fs/promises';
import type {
  ClusterHealthStatus,
  DatabaseServiceHealth,
  DiskDiagnostics,
  DockerServiceHealth,
  HostDiagnostics,
  MemoryDiagnostics,
  RedisServiceHealth,
  SystemDiagnosticsResponse,
  SystemHealthResponse,
} from './interfaces/system-health.interface.js';

@Injectable()
export class SystemService {
  private readonly logger = new Logger(SystemService.name);

  constructor(
    @Optional()
    private readonly dataSource?: DataSource,
  ) {}

  async checkDatabase(): Promise<DatabaseServiceHealth> {
    if (!this.dataSource || !this.dataSource.isInitialized) {
      return {
        status: 'down',
        message: 'DataSource is not initialized',
      };
    }

    const start = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      const latencyMs = Date.now() - start;

      let version: string | undefined;
      try {
        const versionResult = (await this.dataSource.query(
          'SELECT version()',
        )) as Array<{ version: string }>;
        if (versionResult && versionResult[0]?.version) {
          version =
            versionResult[0].version.split(' ')[1] || versionResult[0].version;
        }
      } catch {
        // Version query is optional
      }

      return {
        status: 'up',
        latencyMs,
        version,
        database: process.env.POSTGRES_DB || 'titan_paas',
      };
    } catch (error: unknown) {
      const latencyMs = Date.now() - start;
      const message =
        error instanceof Error ? error.message : 'Database check failed';
      this.logger.warn(`Database health check failed: ${message}`);
      return {
        status: 'down',
        latencyMs,
        message,
      };
    }
  }

  async checkRedis(): Promise<RedisServiceHealth> {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = Number(process.env.REDIS_PORT) || 6379;
    const password = process.env.REDIS_PASSWORD || undefined;

    const start = Date.now();
    let client: Redis | null = null;

    try {
      client = new Redis({
        host,
        port,
        password,
        connectTimeout: 2000,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        retryStrategy: () => null,
      });

      await client.connect();
      const pingResult = await client.ping();
      const latencyMs = Date.now() - start;

      if (pingResult !== 'PONG') {
        throw new Error(`Unexpected Redis ping response: ${pingResult}`);
      }

      return {
        status: 'up',
        latencyMs,
        host,
        port,
      };
    } catch (error: unknown) {
      const latencyMs = Date.now() - start;
      const message =
        error instanceof Error ? error.message : 'Redis check failed';
      this.logger.warn(`Redis health check failed: ${message}`);
      return {
        status: 'down',
        latencyMs,
        message,
        host,
        port,
      };
    } finally {
      if (client) {
        try {
          client.disconnect();
        } catch {
          // Ignore disconnect error
        }
      }
    }
  }

  async checkDocker(): Promise<DockerServiceHealth> {
    const start = Date.now();
    try {
      const { stdout } = await this.executeCommand('docker', [
        'info',
        '--format',
        '{{json .}}',
      ]);
      const latencyMs = Date.now() - start;

      let version = 'unknown';
      let containers = { total: 0, running: 0, paused: 0, stopped: 0 };

      try {
        const parsed = JSON.parse(stdout.trim()) as {
          ServerVersion?: string;
          Containers?: number;
          ContainersRunning?: number;
          ContainersPaused?: number;
          ContainersStopped?: number;
        };

        version = parsed.ServerVersion || 'unknown';
        containers = {
          total: parsed.Containers ?? 0,
          running: parsed.ContainersRunning ?? 0,
          paused: parsed.ContainersPaused ?? 0,
          stopped: parsed.ContainersStopped ?? 0,
        };
      } catch {
        // Fallback if output format wasn't standard JSON
      }

      return {
        status: 'up',
        latencyMs,
        version,
        containers,
      };
    } catch (error: unknown) {
      const latencyMs = Date.now() - start;
      const message =
        error instanceof Error ? error.message : 'Docker check failed';
      this.logger.warn(`Docker daemon health check failed: ${message}`);
      return {
        status: 'down',
        latencyMs,
        message,
      };
    }
  }

  getMemoryMetrics(): MemoryDiagnostics {
    const totalBytes = os.totalmem();
    const freeBytes = os.freemem();
    const usedBytes = Math.max(0, totalBytes - freeBytes);
    const usagePercent =
      totalBytes > 0 ? Number(((usedBytes / totalBytes) * 100).toFixed(2)) : 0;

    return {
      totalBytes,
      usedBytes,
      freeBytes,
      usagePercent,
      formatted: {
        total: this.formatBytes(totalBytes),
        used: this.formatBytes(usedBytes),
        free: this.formatBytes(freeBytes),
      },
    };
  }

  async getDiskMetrics(targetPath = '.'): Promise<DiskDiagnostics> {
    try {
      const stats = await fs.statfs(targetPath);
      const bsize = stats.bsize;
      const totalBytes = stats.blocks * bsize;
      const freeBytes = stats.bfree * bsize;
      const availableBytes = stats.bavail * bsize;
      const usedBytes = Math.max(0, totalBytes - freeBytes);
      const usagePercent =
        totalBytes > 0
          ? Number(((usedBytes / totalBytes) * 100).toFixed(2))
          : 0;

      return {
        path: targetPath,
        totalBytes,
        usedBytes,
        freeBytes,
        availableBytes,
        usagePercent,
        formatted: {
          total: this.formatBytes(totalBytes),
          used: this.formatBytes(usedBytes),
          free: this.formatBytes(freeBytes),
        },
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Disk statfs failed';
      this.logger.warn(
        `Disk metrics check failed for "${targetPath}": ${message}`,
      );
      return {
        path: targetPath,
        totalBytes: 0,
        usedBytes: 0,
        freeBytes: 0,
        availableBytes: 0,
        usagePercent: 0,
        formatted: {
          total: '0 B',
          used: '0 B',
          free: '0 B',
        },
      };
    }
  }

  getHostDiagnostics(): HostDiagnostics {
    const cpus = os.cpus() || [];
    const firstCpu = cpus[0];

    return {
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      cpus: {
        count: cpus.length,
        model: firstCpu?.model || 'unknown',
        speed: firstCpu?.speed || 0,
      },
      loadAvg: os.loadavg(),
      uptimeSeconds: Math.floor(os.uptime()),
    };
  }

  async getHealth(): Promise<SystemHealthResponse> {
    const [dbResult, redisResult, dockerResult] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkDocker(),
    ]);

    const isCoreDown =
      dbResult.status === 'down' ||
      redisResult.status === 'down' ||
      dockerResult.status === 'down';

    const isDegraded =
      dbResult.status === 'degraded' ||
      redisResult.status === 'degraded' ||
      dockerResult.status === 'degraded';

    let status: ClusterHealthStatus = 'healthy';
    if (isCoreDown) {
      status = 'unhealthy';
    } else if (isDegraded) {
      status = 'degraded';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: dbResult,
        redis: redisResult,
        docker: dockerResult,
      },
    };
  }

  async getDiagnostics(): Promise<SystemDiagnosticsResponse> {
    const [dbResult, redisResult, dockerResult, disk] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkDocker(),
      this.getDiskMetrics('.'),
    ]);

    const memory = this.getMemoryMetrics();
    const host = this.getHostDiagnostics();

    const isCoreDown =
      dbResult.status === 'down' ||
      redisResult.status === 'down' ||
      dockerResult.status === 'down';

    const isHighResourceUsage =
      memory.usagePercent > 95 || disk.usagePercent > 95;
    const isMediumResourceUsage =
      memory.usagePercent > 85 || disk.usagePercent > 85;

    let status: ClusterHealthStatus = 'healthy';
    if (isCoreDown || isHighResourceUsage) {
      status = 'unhealthy';
    } else if (isMediumResourceUsage) {
      status = 'degraded';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      host,
      memory,
      disk,
      services: {
        database: dbResult,
        redis: redisResult,
        docker: dockerResult,
      },
    };
  }

  async executeCommand(
    command: string,
    args: string[],
    timeoutMs = 5000,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { shell: true });
      let stdout = '';
      let stderr = '';
      let finished = false;

      const timer = setTimeout(() => {
        if (!finished) {
          finished = true;
          try {
            child.kill();
          } catch {
            // ignore
          }
          reject(
            new Error(
              `Command timed out after ${timeoutMs}ms: ${command} ${args.join(' ')}`,
            ),
          );
        }
      }, timeoutMs);

      child.stdout?.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (err) => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          reject(err);
        }
      });

      child.on('close', (code) => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          if (code !== 0) {
            reject(
              new Error(
                stderr.trim() ||
                  stdout.trim() ||
                  `Command failed with code ${code}`,
              ),
            );
          } else {
            resolve({ stdout, stderr, exitCode: code ?? 0 });
          }
        }
      });
    });
  }

  private formatBytes(bytes: number): string {
    if (bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
    return `${value} ${sizes[i]}`;
  }
}
