import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { DatabasesController } from './databases.controller.js';
import { DatabasesService } from './databases.service.js';
import { DatabaseType } from './enums/database-type.enum.js';
import { DatabaseStatus } from './enums/database-status.enum.js';
import { CreateDatabaseDto } from './dto/create-database.dto.js';
import { ProjectDatabase } from './entities/project-database.entity.js';

describe('DatabasesController', () => {
  let controller: DatabasesController;
  let mockDatabasesService: jest.Mocked<Partial<DatabasesService>>;

  const mockUser = { id: 'user-uuid-1', email: 'dev@titanpaas.local' };
  const mockReq = { user: mockUser };
  const projectId = 'project-uuid-1';
  const databaseId = 'database-uuid-1';

  const sampleDatabase: ProjectDatabase = {
    id: databaseId,
    name: 'main-postgres',
    type: DatabaseType.POSTGRESQL,
    version: '16-alpine',
    status: DatabaseStatus.RUNNING,
    containerName: 'titan_db_repo_main_postgres',
    containerId: 'docker-cid-1',
    volumeName: 'titan_vol_db_repo_main_postgres',
    port: 5432,
    databaseName: 'app_db',
    username: 'titan_user',
    password: 'secure_password',
    connectionUrl:
      'postgresql://titan_user:secure_password@titan_db_repo_main_postgres:5432/app_db',
    projectId,
    project: null as any,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockDatabasesService = {
      create: jest.fn().mockResolvedValue(sampleDatabase as any) as any,
      findAllByProject: jest.fn().mockResolvedValue([sampleDatabase]) as any,
      findOne: jest.fn().mockResolvedValue(sampleDatabase as any) as any,
      getCredentials: jest.fn().mockResolvedValue({
        host: sampleDatabase.containerName,
        port: sampleDatabase.port,
        databaseName: sampleDatabase.databaseName,
        username: sampleDatabase.username,
        password: sampleDatabase.password,
        connectionUrl: sampleDatabase.connectionUrl,
      }) as any,
      start: jest.fn().mockResolvedValue(sampleDatabase as any) as any,
      stop: jest.fn().mockResolvedValue({
        ...sampleDatabase,
        status: DatabaseStatus.STOPPED,
      } as any) as any,
      restart: jest.fn().mockResolvedValue(sampleDatabase as any) as any,
      remove: jest.fn().mockResolvedValue({
        message: 'Base de datos "main-postgres" eliminada exitosamente',
      }) as any,
    };

    controller = new DatabasesController(
      mockDatabasesService as unknown as DatabasesService,
    );
  });

  it('should create a database', async () => {
    const dto: CreateDatabaseDto = {
      name: 'main-postgres',
      type: DatabaseType.POSTGRESQL,
      autoInjectEnv: true,
    };

    const result = await controller.create(mockReq, projectId, dto);

    expect(result).toEqual(sampleDatabase);
    expect(mockDatabasesService.create).toHaveBeenCalledWith(
      mockUser.id,
      projectId,
      dto,
    );
  });

  it('should list databases for a project', async () => {
    const list = await controller.findAll(mockReq, projectId);

    expect(list).toHaveLength(1);
    expect(mockDatabasesService.findAllByProject).toHaveBeenCalledWith(
      mockUser.id,
      projectId,
    );
  });

  it('should retrieve a single database', async () => {
    const result = await controller.findOne(mockReq, projectId, databaseId);

    expect(result.id).toBe(databaseId);
    expect(mockDatabasesService.findOne).toHaveBeenCalledWith(
      mockUser.id,
      projectId,
      databaseId,
    );
  });

  it('should retrieve credentials of a database', async () => {
    const creds = await controller.getCredentials(
      mockReq,
      projectId,
      databaseId,
    );

    expect(creds.host).toBe(sampleDatabase.containerName);
    expect(creds.connectionUrl).toBe(sampleDatabase.connectionUrl);
  });

  it('should start a database', async () => {
    const result = await controller.start(mockReq, projectId, databaseId);
    expect(result.status).toBe(DatabaseStatus.RUNNING);
    expect(mockDatabasesService.start).toHaveBeenCalledWith(
      mockUser.id,
      projectId,
      databaseId,
    );
  });

  it('should stop a database', async () => {
    const result = await controller.stop(mockReq, projectId, databaseId);
    expect(result.status).toBe(DatabaseStatus.STOPPED);
    expect(mockDatabasesService.stop).toHaveBeenCalledWith(
      mockUser.id,
      projectId,
      databaseId,
    );
  });

  it('should restart a database', async () => {
    const result = await controller.restart(mockReq, projectId, databaseId);
    expect(result.status).toBe(DatabaseStatus.RUNNING);
    expect(mockDatabasesService.restart).toHaveBeenCalledWith(
      mockUser.id,
      projectId,
      databaseId,
    );
  });

  it('should remove a database and pass volume deletion preference', async () => {
    const result = await controller.remove(
      mockReq,
      projectId,
      databaseId,
      'false',
    );
    expect(result.message).toContain('eliminada exitosamente');
    expect(mockDatabasesService.remove).toHaveBeenCalledWith(
      mockUser.id,
      projectId,
      databaseId,
      false,
    );
  });
});
