import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { DatabaseBackupsController } from './database-backups.controller.js';
import { DatabaseBackupsService } from '../services/database-backups.service.js';
import { BackupStatus } from '../enums/backup-status.enum.js';
import { BackupTrigger } from '../enums/backup-trigger.enum.js';
import { DatabaseBackup } from '../entities/database-backup.entity.js';
import { BackupSchedule } from '../entities/backup-schedule.entity.js';

describe('DatabaseBackupsController', () => {
  let controller: DatabaseBackupsController;
  let mockBackupsService: jest.Mocked<Partial<DatabaseBackupsService>>;

  const mockUser = { id: 'user-uuid-1', email: 'dev@titanpaas.local' };
  const mockReq = { user: mockUser };
  const projectId = 'project-uuid-1';
  const databaseId = 'db-uuid-1';
  const backupId = 'backup-uuid-1';

  const sampleBackup: DatabaseBackup = {
    id: backupId,
    databaseId,
    projectId,
    fileName: 'backup_main-postgres_20261110.sql.gz',
    fileSize: 4096,
    storageKey: `backups/${projectId}/${databaseId}/backup.sql.gz`,
    storageBucket: 'titan-backups',
    status: BackupStatus.COMPLETED,
    trigger: BackupTrigger.MANUAL,
    errorMessage: null,
    completedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    database: null as any,
  };

  const sampleSchedule: BackupSchedule = {
    id: 'schedule-uuid-1',
    databaseId,
    cronExpression: '0 2 * * *',
    retentionDays: 7,
    isActive: true,
    lastRunAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    database: null as any,
  };

  beforeEach(() => {
    mockBackupsService = {
      createBackup: jest.fn().mockResolvedValue(sampleBackup as any) as any,
      findAllByDatabase: jest.fn().mockResolvedValue([sampleBackup]) as any,
      findOneBackup: jest.fn().mockResolvedValue(sampleBackup as any) as any,
      restoreBackup: jest.fn().mockResolvedValue({
        message: 'Base de datos restaurada exitosamente',
        backup: sampleBackup,
      }) as any,
      deleteBackup: jest.fn().mockResolvedValue({
        message: 'Respaldo eliminado exitosamente',
      }) as any,
      getSchedule: jest.fn().mockResolvedValue(sampleSchedule as any) as any,
      updateSchedule: jest.fn().mockResolvedValue(sampleSchedule as any) as any,
      deleteSchedule: jest.fn().mockResolvedValue({
        message: 'Programacion eliminada exitosamente',
      }) as any,
    };

    controller = new DatabaseBackupsController(
      mockBackupsService as unknown as DatabaseBackupsService,
    );
  });

  it('should trigger manual backup creation', async () => {
    const res = await controller.createBackup(mockReq, projectId, databaseId);
    expect(res).toEqual(sampleBackup);
    expect(mockBackupsService.createBackup).toHaveBeenCalledWith(
      mockUser.id,
      projectId,
      databaseId,
    );
  });

  it('should list all backups of database', async () => {
    const list = await controller.findAllBackups(
      mockReq,
      projectId,
      databaseId,
    );
    expect(list).toHaveLength(1);
    expect(mockBackupsService.findAllByDatabase).toHaveBeenCalledWith(
      mockUser.id,
      projectId,
      databaseId,
    );
  });

  it('should retrieve single backup details', async () => {
    const res = await controller.findOneBackup(
      mockReq,
      projectId,
      databaseId,
      backupId,
    );
    expect(res.id).toBe(backupId);
    expect(mockBackupsService.findOneBackup).toHaveBeenCalledWith(
      mockUser.id,
      projectId,
      databaseId,
      backupId,
    );
  });

  it('should restore database from backup', async () => {
    const res = await controller.restoreBackup(
      mockReq,
      projectId,
      databaseId,
      backupId,
    );
    expect(res.message).toContain('restaurada exitosamente');
    expect(mockBackupsService.restoreBackup).toHaveBeenCalledWith(
      mockUser.id,
      projectId,
      databaseId,
      backupId,
    );
  });

  it('should delete backup', async () => {
    const res = await controller.deleteBackup(
      mockReq,
      projectId,
      databaseId,
      backupId,
    );
    expect(res.message).toContain('eliminado exitosamente');
    expect(mockBackupsService.deleteBackup).toHaveBeenCalledWith(
      mockUser.id,
      projectId,
      databaseId,
      backupId,
    );
  });

  it('should get backup schedule', async () => {
    const sched = await controller.getSchedule(mockReq, projectId, databaseId);
    expect(sched.cronExpression).toBe('0 2 * * *');
  });

  it('should update backup schedule', async () => {
    const sched = await controller.updateSchedule(
      mockReq,
      projectId,
      databaseId,
      {
        cronExpression: '0 3 * * *',
        retentionDays: 14,
      },
    );
    expect(sched).toEqual(sampleSchedule);
    expect(mockBackupsService.updateSchedule).toHaveBeenCalled();
  });

  it('should delete backup schedule', async () => {
    const res = await controller.deleteSchedule(mockReq, projectId, databaseId);
    expect(res.message).toContain('eliminada exitosamente');
    expect(mockBackupsService.deleteSchedule).toHaveBeenCalledWith(
      mockUser.id,
      projectId,
      databaseId,
    );
  });
});
