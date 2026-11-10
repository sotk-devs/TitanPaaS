import { describe, it, expect } from '@jest/globals';
import { ProjectDatabase } from './project-database.entity.js';
import { DatabaseType } from '../enums/database-type.enum.js';
import { DatabaseStatus } from '../enums/database-status.enum.js';

describe('ProjectDatabase Entity', () => {
  it('should create a valid ProjectDatabase instance for PostgreSQL', () => {
    const db = new ProjectDatabase();
    db.id = 'uuid-db-1';
    db.name = 'main-postgres';
    db.type = DatabaseType.POSTGRESQL;
    db.version = '16-alpine';
    db.status = DatabaseStatus.RUNNING;
    db.containerName = 'titan_db_repo_main_postgres';
    db.containerId = 'docker-cid-123';
    db.volumeName = 'titan_vol_db_repo_main_postgres';
    db.port = 5432;
    db.databaseName = 'app_db';
    db.username = 'titan_user';
    db.password = 'supersecretpass';
    db.connectionUrl =
      'postgresql://titan_user:supersecretpass@titan_db_repo_main_postgres:5432/app_db';
    db.projectId = 'uuid-project-1';
    db.createdAt = new Date();
    db.updatedAt = new Date();

    expect(db.id).toBe('uuid-db-1');
    expect(db.name).toBe('main-postgres');
    expect(db.type).toBe(DatabaseType.POSTGRESQL);
    expect(db.status).toBe(DatabaseStatus.RUNNING);
    expect(db.port).toBe(5432);
    expect(db.connectionUrl).toContain(
      'titan_db_repo_main_postgres:5432/app_db',
    );
  });

  it('should create a valid ProjectDatabase instance for Redis', () => {
    const db = new ProjectDatabase();
    db.id = 'uuid-db-2';
    db.name = 'cache-redis';
    db.type = DatabaseType.REDIS;
    db.version = '7-alpine';
    db.status = DatabaseStatus.PROVISIONING;
    db.containerName = 'titan_db_repo_cache_redis';
    db.containerId = null;
    db.volumeName = 'titan_vol_db_repo_cache_redis';
    db.port = 6379;
    db.databaseName = null;
    db.username = null;
    db.password = 'redispass123';
    db.connectionUrl = 'redis://:redispass123@titan_db_repo_cache_redis:6379';
    db.projectId = 'uuid-project-1';

    expect(db.type).toBe(DatabaseType.REDIS);
    expect(db.status).toBe(DatabaseStatus.PROVISIONING);
    expect(db.databaseName).toBeNull();
    expect(db.username).toBeNull();
    expect(db.port).toBe(6379);
    expect(db.connectionUrl).toBe(
      'redis://:redispass123@titan_db_repo_cache_redis:6379',
    );
  });
});
