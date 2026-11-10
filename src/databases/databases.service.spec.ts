import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { DatabasesService } from './databases.service.js';
import { DatabasesDockerService } from './databases-docker.service.js';
import { ProjectDatabase } from './entities/project-database.entity.js';
import { Project } from '../projects/entities/project.entity.js';
import { DatabaseType } from './enums/database-type.enum.js';
import { DatabaseStatus } from './enums/database-status.enum.js';
import { CreateDatabaseDto } from './dto/create-database.dto.js';

describe('DatabasesService', () => {
  let service: DatabasesService;
  let mockDatabaseRepo: jest.Mocked<Partial<Repository<ProjectDatabase>>>;
  let mockProjectRepo: jest.Mocked<Partial<Repository<Project>>>;
  let mockDatabasesDocker: jest.Mocked<Partial<DatabasesDockerService>>;

  const userId = 'user-uuid-1';
  const otherUserId = 'user-uuid-2';
  const projectId = 'project-uuid-1';

  const mockProject: Project = {
    id: projectId,
    name: 'Sample App',
    repositoryName: 'sotk/sample-app',
    repositoryUrl: 'https://github.com/sotk/sample-app.git',
    branch: 'main',
    port: 3000,
    envVariables: { NODE_ENV: 'production' },
    userId,
    user: null as any,
    deployments: [],
    customDomains: [],
    healthcheckPath: null,
    healthcheckExpectedStatus: 200,
    healthcheckTimeout: 5,
    healthcheckRetries: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDatabase: ProjectDatabase = {
    id: 'db-uuid-1',
    name: 'main-postgres',
    type: DatabaseType.POSTGRESQL,
    version: '16-alpine',
    status: DatabaseStatus.RUNNING,
    containerName: 'titan_db_sotk_sample_app_main_postgres',
    containerId: 'docker-cid-1',
    volumeName: 'titan_vol_db_sotk_sample_app_main_postgres',
    port: 5432,
    databaseName: 'db_sample_app',
    username: 'titan_user',
    password: 'secure_password',
    connectionUrl:
      'postgresql://titan_user:secure_password@titan_db_sotk_sample_app_main_postgres:5432/db_sample_app',
    projectId,
    project: null as any,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockDatabaseRepo = {
      create: jest.fn().mockImplementation((dto: any) => ({
        ...dto,
        id: 'db-uuid-new',
        createdAt: new Date(),
        updatedAt: new Date(),
      })) as any,
      save: jest.fn().mockImplementation((entity: any) =>
        Promise.resolve({
          ...entity,
          id: entity.id || 'db-uuid-new',
        }),
      ) as any,
      findOne: jest.fn().mockResolvedValue(null) as any,
      find: jest.fn().mockResolvedValue([mockDatabase]) as any,
      remove: jest.fn().mockResolvedValue(mockDatabase as any) as any,
    };

    mockProjectRepo = {
      findOne: jest.fn().mockResolvedValue(mockProject) as any,
      save: jest.fn().mockImplementation((p: any) => Promise.resolve(p)) as any,
    };

    mockDatabasesDocker = {
      generateContainerName: jest
        .fn()
        .mockReturnValue('titan_db_sotk_sample_app_main_postgres'),
      generateVolumeName: jest
        .fn()
        .mockReturnValue('titan_vol_db_sotk_sample_app_main_postgres'),
      getDefaultPort: jest.fn().mockReturnValue(5432),
      buildConnectionUrl: jest
        .fn()
        .mockReturnValue(
          'postgresql://titan_user:secure_password@titan_db_sotk_sample_app_main_postgres:5432/db_sample_app',
        ),
      provisionContainer: jest
        .fn()
        .mockResolvedValue({ containerId: 'docker-cid-new' }),
      startContainer: jest.fn().mockResolvedValue(undefined),
      stopContainer: jest.fn().mockResolvedValue(undefined),
      restartContainer: jest.fn().mockResolvedValue(undefined),
      removeContainer: jest.fn().mockResolvedValue(undefined),
      removeVolume: jest.fn().mockResolvedValue(undefined),
      inspectStatus: jest.fn().mockResolvedValue(DatabaseStatus.RUNNING),
    };

    service = new DatabasesService(
      mockDatabaseRepo as unknown as Repository<ProjectDatabase>,
      mockProjectRepo as unknown as Repository<Project>,
      mockDatabasesDocker as unknown as DatabasesDockerService,
    );
  });

  describe('verifyProjectOwnership', () => {
    it('should throw NotFoundException if project does not exist', async () => {
      (mockProjectRepo.findOne as any).mockResolvedValueOnce(null);
      await expect(
        service.verifyProjectOwnership(userId, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not project owner', async () => {
      await expect(
        service.verifyProjectOwnership(otherUserId, projectId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return project if user is owner', async () => {
      const result = await service.verifyProjectOwnership(userId, projectId);
      expect(result.id).toBe(projectId);
    });
  });

  describe('create', () => {
    it('should throw ConflictException if a database with the same name exists', async () => {
      (mockDatabaseRepo.findOne as any).mockResolvedValueOnce(mockDatabase);

      const dto: CreateDatabaseDto = {
        name: 'main-postgres',
        type: DatabaseType.POSTGRESQL,
      };

      await expect(service.create(userId, projectId, dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should provision PostgreSQL and auto-inject DATABASE_URL when requested', async () => {
      const dto: CreateDatabaseDto = {
        name: 'main-postgres',
        type: DatabaseType.POSTGRESQL,
        autoInjectEnv: true,
      };

      const result = await service.create(userId, projectId, dto);

      expect(result.name).toBe('main-postgres');
      expect(result.status).toBe(DatabaseStatus.RUNNING);
      expect(mockDatabasesDocker.provisionContainer).toHaveBeenCalled();
      expect(mockProjectRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          envVariables: expect.objectContaining({
            DATABASE_URL: expect.any(String),
          }),
        }),
      );
    });
  });

  describe('queries', () => {
    it('should list databases and sync live status', async () => {
      const list = await service.findAllByProject(userId, projectId);
      expect(list).toHaveLength(1);
      expect(mockDatabasesDocker.inspectStatus).toHaveBeenCalledWith(
        mockDatabase.containerName,
      );
    });

    it('should find single database', async () => {
      (mockDatabaseRepo.findOne as any).mockResolvedValueOnce(mockDatabase);
      const db = await service.findOne(userId, projectId, mockDatabase.id);
      expect(db.id).toBe(mockDatabase.id);
    });

    it('should throw NotFoundException if database not found', async () => {
      (mockDatabaseRepo.findOne as any).mockResolvedValueOnce(null);
      await expect(
        service.findOne(userId, projectId, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return database credentials', async () => {
      (mockDatabaseRepo.findOne as any).mockResolvedValueOnce(mockDatabase);
      const creds = await service.getCredentials(
        userId,
        projectId,
        mockDatabase.id,
      );
      expect(creds.host).toBe(mockDatabase.containerName);
      expect(creds.password).toBe('secure_password');
      expect(creds.connectionUrl).toContain('postgresql://');
    });
  });

  describe('lifecycle actions', () => {
    beforeEach(() => {
      (mockDatabaseRepo.findOne as any).mockResolvedValue(mockDatabase);
    });

    it('should start database container', async () => {
      const res = await service.start(userId, projectId, mockDatabase.id);
      expect(mockDatabasesDocker.startContainer).toHaveBeenCalledWith(
        mockDatabase.containerName,
      );
      expect(res.status).toBe(DatabaseStatus.RUNNING);
    });

    it('should stop database container', async () => {
      const res = await service.stop(userId, projectId, mockDatabase.id);
      expect(mockDatabasesDocker.stopContainer).toHaveBeenCalledWith(
        mockDatabase.containerName,
      );
      expect(res.status).toBe(DatabaseStatus.STOPPED);
    });

    it('should restart database container', async () => {
      const res = await service.restart(userId, projectId, mockDatabase.id);
      expect(mockDatabasesDocker.restartContainer).toHaveBeenCalledWith(
        mockDatabase.containerName,
      );
      expect(res.status).toBe(DatabaseStatus.RUNNING);
    });

    it('should remove database and persistent volume', async () => {
      const result = await service.remove(
        userId,
        projectId,
        mockDatabase.id,
        true,
      );
      expect(mockDatabasesDocker.removeContainer).toHaveBeenCalledWith(
        mockDatabase.containerName,
      );
      expect(mockDatabasesDocker.removeVolume).toHaveBeenCalledWith(
        mockDatabase.volumeName,
      );
      expect(mockDatabaseRepo.remove).toHaveBeenCalledWith(mockDatabase);
      expect(result.message).toContain('eliminada exitosamente');
    });
  });
});
