import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import {
  DatabasesDockerService,
  ProvisionDatabaseOptions,
} from './databases-docker.service.js';
import { DockerPipelineService } from '../deployment/docker-pipeline.service.js';
import { DatabaseType } from './enums/database-type.enum.js';
import { DatabaseStatus } from './enums/database-status.enum.js';

describe('DatabasesDockerService', () => {
  let service: DatabasesDockerService;
  let mockDockerPipeline: jest.Mocked<Partial<DockerPipelineService>>;

  beforeEach(() => {
    mockDockerPipeline = {
      executeCommand: jest.fn().mockImplementation(() =>
        Promise.resolve({
          stdout: 'container-id-123456\n',
          stderr: '',
          exitCode: 0,
        }),
      ),
    };

    service = new DatabasesDockerService(
      mockDockerPipeline as unknown as DockerPipelineService,
    );
  });

  describe('name generators and helpers', () => {
    it('should sanitize repository and database names correctly', () => {
      const containerName = service.generateContainerName(
        'org/my-repo',
        'main-db',
      );
      const volumeName = service.generateVolumeName('org/my-repo', 'main-db');

      expect(containerName).toBe('titan_db_org_my-repo_main-db');
      expect(volumeName).toBe('titan_vol_db_org_my-repo_main-db');
    });

    it('should return correct default ports and mount paths', () => {
      expect(service.getDefaultPort(DatabaseType.POSTGRESQL)).toBe(5432);
      expect(service.getDefaultPort(DatabaseType.MYSQL)).toBe(3306);
      expect(service.getDefaultPort(DatabaseType.REDIS)).toBe(6379);

      expect(service.getVolumeMountPath(DatabaseType.POSTGRESQL)).toBe(
        '/var/lib/postgresql/data',
      );
      expect(service.getVolumeMountPath(DatabaseType.MYSQL)).toBe(
        '/var/lib/mysql',
      );
      expect(service.getVolumeMountPath(DatabaseType.REDIS)).toBe('/data');
    });

    it('should build connection URLs correctly', () => {
      const pgUrl = service.buildConnectionUrl(
        DatabaseType.POSTGRESQL,
        'titan_db_repo_pg',
        5432,
        'myuser',
        'mypass',
        'mydb',
      );
      expect(pgUrl).toBe(
        'postgresql://myuser:mypass@titan_db_repo_pg:5432/mydb',
      );

      const myUrl = service.buildConnectionUrl(
        DatabaseType.MYSQL,
        'titan_db_repo_mysql',
        3306,
        'root',
        'rootpass',
        'mysqldb',
      );
      expect(myUrl).toBe(
        'mysql://root:rootpass@titan_db_repo_mysql:3306/mysqldb',
      );

      const redisUrl = service.buildConnectionUrl(
        DatabaseType.REDIS,
        'titan_db_repo_redis',
        6379,
        null,
        'secretredis',
        null,
      );
      expect(redisUrl).toBe('redis://:secretredis@titan_db_repo_redis:6379');
    });
  });

  describe('provisionContainer', () => {
    it('should provision PostgreSQL container with persistent volume and env flags', async () => {
      const options: ProvisionDatabaseOptions = {
        type: DatabaseType.POSTGRESQL,
        version: '16-alpine',
        containerName: 'titan_db_repo_postgres',
        volumeName: 'titan_vol_db_repo_postgres',
        port: 5432,
        databaseName: 'production_db',
        username: 'titan_admin',
        password: 'secure_password_123',
        network: 'titan-network',
      };

      const result = await service.provisionContainer(options);

      expect(result.containerId).toBe('container-id-123456');
      expect(mockDockerPipeline.executeCommand).toHaveBeenCalledWith('docker', [
        'volume',
        'create',
        'titan_vol_db_repo_postgres',
      ]);
      expect(mockDockerPipeline.executeCommand).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining([
          'run',
          '-d',
          '--name',
          'titan_db_repo_postgres',
          '--network',
          'titan-network',
          '-v',
          'titan_vol_db_repo_postgres:/var/lib/postgresql/data',
          '-e',
          'POSTGRES_DB=production_db',
          '-e',
          'POSTGRES_USER=titan_admin',
          '-e',
          'POSTGRES_PASSWORD=secure_password_123',
          'postgres:16-alpine',
        ]),
      );
    });

    it('should provision Redis container with requirepass command', async () => {
      const options: ProvisionDatabaseOptions = {
        type: DatabaseType.REDIS,
        containerName: 'titan_db_repo_redis',
        volumeName: 'titan_vol_db_repo_redis',
        port: 6379,
        password: 'redis_pass_xyz',
      };

      const result = await service.provisionContainer(options);

      expect(result.containerId).toBe('container-id-123456');
      expect(mockDockerPipeline.executeCommand).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining([
          'run',
          '-d',
          '--name',
          'titan_db_repo_redis',
          '-v',
          'titan_vol_db_repo_redis:/data',
          'redis:7-alpine',
          'redis-server',
          '--requirepass',
          'redis_pass_xyz',
          '--appendonly',
          'yes',
        ]),
      );
    });
  });

  describe('lifecycle management', () => {
    it('should start, stop, and restart containers', async () => {
      await service.startContainer('titan_db_test');
      expect(mockDockerPipeline.executeCommand).toHaveBeenCalledWith('docker', [
        'start',
        'titan_db_test',
      ]);

      await service.stopContainer('titan_db_test');
      expect(mockDockerPipeline.executeCommand).toHaveBeenCalledWith('docker', [
        'stop',
        'titan_db_test',
      ]);

      await service.restartContainer('titan_db_test');
      expect(mockDockerPipeline.executeCommand).toHaveBeenCalledWith('docker', [
        'restart',
        'titan_db_test',
      ]);
    });

    it('should remove container and volume safely', async () => {
      await service.removeContainer('titan_db_test');
      expect(mockDockerPipeline.executeCommand).toHaveBeenCalledWith('docker', [
        'rm',
        '-f',
        'titan_db_test',
      ]);

      await service.removeVolume('titan_vol_test');
      expect(mockDockerPipeline.executeCommand).toHaveBeenCalledWith('docker', [
        'volume',
        'rm',
        'titan_vol_test',
      ]);
    });

    it('should inspect container status properly', async () => {
      (mockDockerPipeline.executeCommand as any).mockResolvedValueOnce({
        stdout: 'running\n',
        stderr: '',
        exitCode: 0,
      });

      const statusRunning = await service.inspectStatus('titan_db_running');
      expect(statusRunning).toBe(DatabaseStatus.RUNNING);

      (mockDockerPipeline.executeCommand as any).mockResolvedValueOnce({
        stdout: 'exited\n',
        stderr: '',
        exitCode: 0,
      });

      const statusStopped = await service.inspectStatus('titan_db_stopped');
      expect(statusStopped).toBe(DatabaseStatus.STOPPED);
    });
  });
});
