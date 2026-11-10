import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { DatabaseBackupsService } from './database-backups.service.js';
import { DatabasesService } from '../databases.service.js';
import { DatabaseDumpService } from './database-dump.service.js';
import { S3StorageService } from '../storage/s3-storage.service.js';
import { DatabaseBackup } from '../entities/database-backup.entity.js';
import { BackupSchedule } from '../entities/backup-schedule.entity.js';
import { ProjectDatabase } from '../entities/project-database.entity.js';
import { DatabaseType } from '../enums/database-type.enum.js';
import { DatabaseStatus } from '../enums/database-status.enum.js';
import { BackupStatus } from '../enums/backup-status.enum.js';
import { BackupTrigger } from '../enums/backup-trigger.enum.js';

describe('DatabaseBackupsService', () => {
  let service: DatabaseBackupsService;
  let mockBackupRepo: jest.Mocked<Partial<Repository<DatabaseBackup>>>;
  let mockScheduleRepo: jest.Mocked<Partial<Repository<BackupSchedule>>>;
  let mockDatabasesService: jest.Mocked<Partial<DatabasesService>>;
  let mockDumpService: jest.Mocked<Partial<DatabaseDumpService>>;
  let mockStorageService: jest.Mocked<Partial<S3StorageService>>;

  const userId = 'user-uuid-1';
  const projectId = 'project-uuid-1';
  const databaseId = 'db-uuid-1';
  const backupId = 'backup-uuid-1';

  const mockDatabase: ProjectDatabase = {
    id: databaseId,
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
    projectId,
    project: null as any,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockBackup: DatabaseBackup = {
    id: backupId,
    databaseId,
    projectId,
    fileName: 'backup_main-postgres_20261110.sql.gz',
    fileSize: 2048,
    storageKey: `backups/${projectId}/${databaseId}/backup.sql.gz`,
    storageBucket: 'titan-backups',
    status: BackupStatus.COMPLETED,
    trigger: BackupTrigger.MANUAL,
    errorMessage: null,
    completedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    database: mockDatabase,
  };

  const mockSchedule: BackupSchedule = {
    id: 'schedule-uuid-1',
    databaseId,
    cronExpression: '0 2 * * *',
    retentionDays: 7,
    isActive: true,
    lastRunAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    database: mockDatabase,
  };

  beforeEach(() => {
    mockBackupRepo = {
      create: jest.fn().mockImplementation((dto: any) => ({
        ...dto,
        id: backupId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })) as any,
      save: jest.fn().mockImplementation((entity: any) =>
        Promise.resolve({
          ...entity,
          id: entity.id || backupId,
        }),
      ) as any,
      findOne: jest.fn().mockResolvedValue(null) as any,
      find: jest.fn().mockResolvedValue([mockBackup]) as any,
      remove: jest.fn().mockResolvedValue(mockBackup as any) as any,
    };

    mockScheduleRepo = {
      create: jest.fn().mockImplementation((dto: any) => ({
        ...dto,
        id: 'schedule-uuid-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      })) as any,
      save: jest.fn().mockImplementation((entity: any) =>
        Promise.resolve({
          ...entity,
          id: entity.id || 'schedule-uuid-1',
        }),
      ) as any,
      findOne: jest.fn().mockResolvedValue(null) as any,
      remove: jest.fn().mockResolvedValue(mockSchedule as any) as any,
    };

    mockDatabasesService = {
      findOne: jest.fn().mockResolvedValue(mockDatabase) as any,
    };

    mockDumpService = {
      generateFileName: jest
        .fn()
        .mockReturnValue('backup_main-postgres_20261110.sql.gz'),
      dump: jest.fn().mockResolvedValue({
        buffer: Buffer.from('compressed sql content'),
        fileName: 'backup_main-postgres_20261110.sql.gz',
      }) as any,
      restore: jest.fn().mockResolvedValue(undefined) as any,
    };

    mockStorageService = {
      getBucketName: jest.fn().mockReturnValue('titan-backups'),
      uploadBuffer: jest.fn().mockResolvedValue({
        bucket: 'titan-backups',
        key: 'key',
        size: 2048,
      }) as any,
      downloadBuffer: jest
        .fn()
        .mockResolvedValue(Buffer.from('downloaded content')) as any,
      deleteObject: jest.fn().mockResolvedValue(undefined) as any,
    };

    service = new DatabaseBackupsService(
      mockBackupRepo as unknown as Repository<DatabaseBackup>,
      mockScheduleRepo as unknown as Repository<BackupSchedule>,
      mockDatabasesService as unknown as DatabasesService,
      mockDumpService as unknown as DatabaseDumpService,
      mockStorageService as unknown as S3StorageService,
    );
  });

  describe('createBackup', () => {
    it('should generate, upload, and save a completed backup', async () => {
      const result = await service.createBackup(userId, projectId, databaseId);

      expect(result.status).toBe(BackupStatus.COMPLETED);
      expect(result.fileSize).toBe(2048);
      expect(mockDumpService.dump).toHaveBeenCalledWith(mockDatabase);
      expect(mockStorageService.uploadBuffer).toHaveBeenCalled();
      expect(mockBackupRepo.save).toHaveBeenCalled();
    });

    it('should mark backup as FAILED if dump fails', async () => {
      mockDumpService.dump = jest
        .fn()
        .mockRejectedValueOnce(new Error('pg_dump error'));

      await expect(
        service.createBackup(userId, projectId, databaseId),
      ).rejects.toThrow('pg_dump error');

      expect(mockBackupRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: BackupStatus.FAILED,
          errorMessage: 'pg_dump error',
        }),
      );
    });
  });

  describe('querying backups', () => {
    it('should list backups for database', async () => {
      const list = await service.findAllByDatabase(
        userId,
        projectId,
        databaseId,
      );
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(backupId);
    });

    it('should return single backup when found', async () => {
      (mockBackupRepo.findOne as any).mockResolvedValueOnce(mockBackup);
      const b = await service.findOneBackup(
        userId,
        projectId,
        databaseId,
        backupId,
      );
      expect(b.id).toBe(backupId);
    });

    it('should throw NotFoundException if backup not found', async () => {
      (mockBackupRepo.findOne as any).mockResolvedValueOnce(null);
      await expect(
        service.findOneBackup(userId, projectId, databaseId, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('restoreBackup', () => {
    it('should restore database from backup successfully', async () => {
      (mockBackupRepo.findOne as any).mockResolvedValueOnce(mockBackup);

      const res = await service.restoreBackup(
        userId,
        projectId,
        databaseId,
        backupId,
      );

      expect(mockStorageService.downloadBuffer).toHaveBeenCalledWith(
        mockBackup.storageKey,
      );
      expect(mockDumpService.restore).toHaveBeenCalledWith(
        mockDatabase,
        expect.any(Buffer),
      );
      expect(res.message).toContain('restaurada exitosamente');
    });

    it('should throw BadRequestException if backup is not COMPLETED', async () => {
      (mockBackupRepo.findOne as any).mockResolvedValueOnce({
        ...mockBackup,
        status: BackupStatus.FAILED,
      });

      await expect(
        service.restoreBackup(userId, projectId, databaseId, backupId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteBackup', () => {
    it('should delete backup from S3 and database', async () => {
      (mockBackupRepo.findOne as any).mockResolvedValueOnce(mockBackup);

      const res = await service.deleteBackup(
        userId,
        projectId,
        databaseId,
        backupId,
      );

      expect(mockStorageService.deleteObject).toHaveBeenCalledWith(
        mockBackup.storageKey,
      );
      expect(mockBackupRepo.remove).toHaveBeenCalledWith(mockBackup);
      expect(res.message).toContain('eliminado exitosamente');
    });
  });

  describe('schedules and purge', () => {
    it('should retrieve existing or default schedule', async () => {
      (mockScheduleRepo.findOne as any).mockResolvedValueOnce(mockSchedule);

      const sched = await service.getSchedule(userId, projectId, databaseId);
      expect(sched.cronExpression).toBe('0 2 * * *');
    });

    it('should update schedule configuration', async () => {
      (mockScheduleRepo.findOne as any).mockResolvedValueOnce(mockSchedule);

      const updated = await service.updateSchedule(
        userId,
        projectId,
        databaseId,
        {
          cronExpression: '0 4 * * *',
          retentionDays: 30,
        },
      );

      expect(updated.cronExpression).toBe('0 4 * * *');
      expect(updated.retentionDays).toBe(30);
    });

    it('should delete schedule', async () => {
      (mockScheduleRepo.findOne as any).mockResolvedValueOnce(mockSchedule);

      const res = await service.deleteSchedule(userId, projectId, databaseId);
      expect(mockScheduleRepo.remove).toHaveBeenCalledWith(mockSchedule);
      expect(res.message).toContain('eliminada exitosamente');
    });

    it('should purge expired backups from S3 and DB', async () => {
      (mockBackupRepo.find as any).mockResolvedValueOnce([mockBackup]);

      const purgedCount = await service.purgeOldBackups(databaseId, 7);

      expect(purgedCount).toBe(1);
      expect(mockStorageService.deleteObject).toHaveBeenCalledWith(
        mockBackup.storageKey,
      );
      expect(mockBackupRepo.remove).toHaveBeenCalledWith(mockBackup);
    });
  });
});
