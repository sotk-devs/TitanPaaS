import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { gzipSync } from 'node:zlib';
import { DatabaseDumpService } from './database-dump.service.js';
import { ProjectDatabase } from '../entities/project-database.entity.js';
import { DatabaseType } from '../enums/database-type.enum.js';
import { DatabaseStatus } from '../enums/database-status.enum.js';

describe('DatabaseDumpService', () => {
  let service: DatabaseDumpService;

  const mockPgDatabase: ProjectDatabase = {
    id: 'db-1',
    name: 'main-postgres',
    type: DatabaseType.POSTGRESQL,
    version: '16-alpine',
    status: DatabaseStatus.RUNNING,
    containerName: 'titan_db_repo_main_postgres',
    containerId: 'cid-1',
    volumeName: 'titan_vol_db_repo_main_postgres',
    port: 5432,
    databaseName: 'app_db',
    username: 'titan_user',
    password: 'password123',
    connectionUrl: 'postgresql://...',
    projectId: 'p-1',
    project: null as any,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockMySqlDatabase: ProjectDatabase = {
    ...mockPgDatabase,
    id: 'db-2',
    name: 'main-mysql',
    type: DatabaseType.MYSQL,
    containerName: 'titan_db_repo_main_mysql',
  };

  const mockRedisDatabase: ProjectDatabase = {
    ...mockPgDatabase,
    id: 'db-3',
    name: 'main-redis',
    type: DatabaseType.REDIS,
    containerName: 'titan_db_repo_main_redis',
  };

  beforeEach(() => {
    service = new DatabaseDumpService();
  });

  describe('generateFileName', () => {
    it('should generate .sql.gz for relational databases and .rdb.gz for redis', () => {
      const pgFile = service.generateFileName(mockPgDatabase);
      const redisFile = service.generateFileName(mockRedisDatabase);

      expect(pgFile).toMatch(/^backup_main-postgres_.*\.sql\.gz$/);
      expect(redisFile).toMatch(/^backup_main-redis_.*\.rdb\.gz$/);
    });
  });

  describe('dump', () => {
    it('should dump and gzip PostgreSQL database', async () => {
      const sqlContent = Buffer.from('CREATE TABLE test (id int);');
      jest.spyOn(service, 'executeDocker').mockResolvedValueOnce(sqlContent);

      const result = await service.dump(mockPgDatabase);

      expect(result.fileName).toContain('backup_main-postgres_');
      expect(service.executeDocker).toHaveBeenCalledWith([
        'exec',
        '-i',
        'titan_db_repo_main_postgres',
        'pg_dump',
        '-U',
        'titan_user',
        '-d',
        'app_db',
        '--no-owner',
        '--clean',
      ]);
      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('should dump and gzip MySQL database', async () => {
      const sqlContent = Buffer.from('CREATE TABLE mysql_test (id int);');
      jest.spyOn(service, 'executeDocker').mockResolvedValueOnce(sqlContent);

      const result = await service.dump(mockMySqlDatabase);

      expect(service.executeDocker).toHaveBeenCalledWith([
        'exec',
        '-i',
        'titan_db_repo_main_mysql',
        'mysqldump',
        '-utitan_user',
        '-ppassword123',
        'app_db',
      ]);
      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('should dump and gzip Redis database via SAVE and cat', async () => {
      const rdbContent = Buffer.from('REDIS0011rdb_binary_content');
      jest
        .spyOn(service, 'executeDocker')
        .mockResolvedValueOnce(Buffer.from('OK\n')) // SAVE
        .mockResolvedValueOnce(rdbContent); // cat

      const result = await service.dump(mockRedisDatabase);

      expect(service.executeDocker).toHaveBeenNthCalledWith(1, [
        'exec',
        'titan_db_repo_main_redis',
        'redis-cli',
        '-a',
        'password123',
        'SAVE',
      ]);
      expect(service.executeDocker).toHaveBeenNthCalledWith(2, [
        'exec',
        'titan_db_repo_main_redis',
        'cat',
        '/data/dump.rdb',
      ]);
      expect(result.fileName).toContain('.rdb.gz');
    });
  });

  describe('restore', () => {
    it('should gunzip and restore PostgreSQL database via psql', async () => {
      const rawSql = Buffer.from('CREATE TABLE test (id int);');
      const compressed = gzipSync(rawSql);
      jest
        .spyOn(service, 'executeDocker')
        .mockResolvedValueOnce(Buffer.from(''));

      await service.restore(mockPgDatabase, compressed);

      expect(service.executeDocker).toHaveBeenCalledWith(
        [
          'exec',
          '-i',
          'titan_db_repo_main_postgres',
          'psql',
          '-U',
          'titan_user',
          '-d',
          'app_db',
        ],
        rawSql,
      );
    });

    it('should gunzip and restore MySQL database via mysql', async () => {
      const rawSql = Buffer.from('CREATE TABLE test (id int);');
      const compressed = gzipSync(rawSql);
      jest
        .spyOn(service, 'executeDocker')
        .mockResolvedValueOnce(Buffer.from(''));

      await service.restore(mockMySqlDatabase, compressed);

      expect(service.executeDocker).toHaveBeenCalledWith(
        [
          'exec',
          '-i',
          'titan_db_repo_main_mysql',
          'mysql',
          '-utitan_user',
          '-ppassword123',
          'app_db',
        ],
        rawSql,
      );
    });

    it('should restore Redis database by writing dump.rdb and restarting', async () => {
      const rawRdb = Buffer.from('REDIS0011rdb_content');
      const compressed = gzipSync(rawRdb);
      jest
        .spyOn(service, 'executeDocker')
        .mockResolvedValueOnce(Buffer.from(''))
        .mockResolvedValueOnce(Buffer.from(''));

      await service.restore(mockRedisDatabase, compressed);

      expect(service.executeDocker).toHaveBeenNthCalledWith(
        1,
        [
          'exec',
          '-i',
          'titan_db_repo_main_redis',
          'sh',
          '-c',
          'cat > /data/dump.rdb',
        ],
        rawRdb,
      );
      expect(service.executeDocker).toHaveBeenNthCalledWith(2, [
        'restart',
        'titan_db_repo_main_redis',
      ]);
    });
  });
});
