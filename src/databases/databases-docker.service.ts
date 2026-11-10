import { Injectable, Logger } from '@nestjs/common';
import { DockerPipelineService } from '../deployment/docker-pipeline.service.js';
import { DatabaseType } from './enums/database-type.enum.js';
import { DatabaseStatus } from './enums/database-status.enum.js';

export interface ProvisionDatabaseOptions {
  type: DatabaseType;
  version?: string;
  containerName: string;
  volumeName: string;
  port: number;
  databaseName?: string | null;
  username?: string | null;
  password: string;
  network?: string;
}

@Injectable()
export class DatabasesDockerService {
  private readonly logger = new Logger(DatabasesDockerService.name);

  constructor(private readonly dockerPipeline: DockerPipelineService) {}

  generateContainerName(repositoryName: string, name: string): string {
    const cleanRepo = repositoryName.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const cleanName = name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    return `titan_db_${cleanRepo}_${cleanName}`;
  }

  generateVolumeName(repositoryName: string, name: string): string {
    const cleanRepo = repositoryName.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const cleanName = name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    return `titan_vol_db_${cleanRepo}_${cleanName}`;
  }

  getDefaultPort(type: DatabaseType): number {
    switch (type) {
      case DatabaseType.POSTGRESQL:
        return 5432;
      case DatabaseType.MYSQL:
        return 3306;
      case DatabaseType.REDIS:
        return 6379;
    }
  }

  getDefaultImage(type: DatabaseType, version?: string): string {
    switch (type) {
      case DatabaseType.POSTGRESQL:
        return `postgres:${version || '16-alpine'}`;
      case DatabaseType.MYSQL:
        return `mysql:${version || '8.0'}`;
      case DatabaseType.REDIS:
        return `redis:${version || '7-alpine'}`;
    }
  }

  getVolumeMountPath(type: DatabaseType): string {
    switch (type) {
      case DatabaseType.POSTGRESQL:
        return '/var/lib/postgresql/data';
      case DatabaseType.MYSQL:
        return '/var/lib/mysql';
      case DatabaseType.REDIS:
        return '/data';
    }
  }

  buildConnectionUrl(
    type: DatabaseType,
    containerName: string,
    port: number,
    username: string | null,
    password: string,
    databaseName: string | null,
  ): string {
    switch (type) {
      case DatabaseType.POSTGRESQL:
        return `postgresql://${username || 'postgres'}:${password}@${containerName}:${port}/${databaseName || 'postgres'}`;
      case DatabaseType.MYSQL:
        return `mysql://${username || 'root'}:${password}@${containerName}:${port}/${databaseName || 'mysql'}`;
      case DatabaseType.REDIS:
        return `redis://:${password}@${containerName}:${port}`;
    }
  }

  async provisionContainer(
    options: ProvisionDatabaseOptions,
  ): Promise<{ containerId: string }> {
    this.logger.log(
      `Aprovisionando base de datos ${options.type} (${options.containerName})...`,
    );

    // 1. Crear volumen de datos persistente (idempotente)
    try {
      await this.dockerPipeline.executeCommand('docker', [
        'volume',
        'create',
        options.volumeName,
      ]);
    } catch (err) {
      this.logger.warn(
        `Aviso al crear volumen ${options.volumeName}: ${(err as Error).message}`,
      );
    }

    const network =
      options.network || process.env.DOCKER_NETWORK || 'titan-network';
    const mountPath = this.getVolumeMountPath(options.type);
    const image = this.getDefaultImage(options.type, options.version);

    const envArgs: string[] = [];
    const extraCmdArgs: string[] = [];

    if (options.type === DatabaseType.POSTGRESQL) {
      if (options.databaseName) {
        envArgs.push('-e', `POSTGRES_DB=${options.databaseName}`);
      }
      if (options.username) {
        envArgs.push('-e', `POSTGRES_USER=${options.username}`);
      }
      envArgs.push('-e', `POSTGRES_PASSWORD=${options.password}`);
    } else if (options.type === DatabaseType.MYSQL) {
      if (options.databaseName) {
        envArgs.push('-e', `MYSQL_DATABASE=${options.databaseName}`);
      }
      if (options.username) {
        envArgs.push('-e', `MYSQL_USER=${options.username}`);
      }
      envArgs.push('-e', `MYSQL_PASSWORD=${options.password}`);
      envArgs.push('-e', `MYSQL_ROOT_PASSWORD=${options.password}`);
    } else if (options.type === DatabaseType.REDIS) {
      extraCmdArgs.push(
        'redis-server',
        '--requirepass',
        options.password,
        '--appendonly',
        'yes',
      );
    }

    const runArgs = [
      'run',
      '-d',
      '--name',
      options.containerName,
      '--network',
      network,
      '--restart',
      'unless-stopped',
      '-v',
      `${options.volumeName}:${mountPath}`,
      ...envArgs,
      image,
      ...extraCmdArgs,
    ];

    const result = await this.dockerPipeline.executeCommand('docker', runArgs);
    const containerId = result.stdout.trim().split('\n')[0];

    this.logger.log(
      `Contenedor ${options.containerName} aprovisionado con ID: ${containerId}`,
    );

    return { containerId };
  }

  async startContainer(containerName: string): Promise<void> {
    await this.dockerPipeline.executeCommand('docker', [
      'start',
      containerName,
    ]);
  }

  async stopContainer(containerName: string): Promise<void> {
    await this.dockerPipeline.executeCommand('docker', ['stop', containerName]);
  }

  async restartContainer(containerName: string): Promise<void> {
    await this.dockerPipeline.executeCommand('docker', [
      'restart',
      containerName,
    ]);
  }

  async removeContainer(containerName: string): Promise<void> {
    try {
      await this.dockerPipeline.executeCommand('docker', [
        'rm',
        '-f',
        containerName,
      ]);
    } catch (err) {
      this.logger.warn(
        `Error al eliminar contenedor ${containerName}: ${(err as Error).message}`,
      );
    }
  }

  async removeVolume(volumeName: string): Promise<void> {
    try {
      await this.dockerPipeline.executeCommand('docker', [
        'volume',
        'rm',
        volumeName,
      ]);
    } catch (err) {
      this.logger.warn(
        `Error al eliminar volumen ${volumeName}: ${(err as Error).message}`,
      );
    }
  }

  async inspectStatus(containerName: string): Promise<DatabaseStatus> {
    try {
      const res = await this.dockerPipeline.executeCommand('docker', [
        'inspect',
        '--format',
        '{{.State.Status}}',
        containerName,
      ]);
      const rawStatus = res.stdout.trim().toLowerCase();
      if (rawStatus === 'running') {
        return DatabaseStatus.RUNNING;
      }
      if (rawStatus === 'exited' || rawStatus === 'created') {
        return DatabaseStatus.STOPPED;
      }
      return DatabaseStatus.ERROR;
    } catch {
      return DatabaseStatus.STOPPED;
    }
  }
}
