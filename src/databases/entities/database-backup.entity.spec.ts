import { describe, it, expect } from '@jest/globals';
import { DatabaseBackup } from './database-backup.entity.js';
import { BackupSchedule } from './backup-schedule.entity.js';
import { BackupStatus } from '../enums/backup-status.enum.js';
import { BackupTrigger } from '../enums/backup-trigger.enum.js';

describe('DatabaseBackup & BackupSchedule Entities', () => {
  it('should instantiate a valid DatabaseBackup entity', () => {
    const backup = new DatabaseBackup();
    backup.id = 'backup-uuid-1';
    backup.databaseId = 'db-uuid-1';
    backup.projectId = 'project-uuid-1';
    backup.fileName = 'backup_main-postgres_20261110.sql.gz';
    backup.fileSize = 1048576;
    backup.storageKey = 'backups/project-uuid-1/db-uuid-1/backup.sql.gz';
    backup.storageBucket = 'titan-backups';
    backup.status = BackupStatus.COMPLETED;
    backup.trigger = BackupTrigger.MANUAL;
    backup.errorMessage = null;
    backup.completedAt = new Date();
    backup.createdAt = new Date();
    backup.updatedAt = new Date();

    expect(backup.id).toBe('backup-uuid-1');
    expect(backup.databaseId).toBe('db-uuid-1');
    expect(backup.status).toBe(BackupStatus.COMPLETED);
    expect(backup.trigger).toBe(BackupTrigger.MANUAL);
    expect(backup.fileSize).toBe(1048576);
  });

  it('should instantiate a valid BackupSchedule entity', () => {
    const schedule = new BackupSchedule();
    schedule.id = 'schedule-uuid-1';
    schedule.databaseId = 'db-uuid-1';
    schedule.cronExpression = '0 2 * * *';
    schedule.retentionDays = 14;
    schedule.isActive = true;
    schedule.lastRunAt = null;
    schedule.createdAt = new Date();
    schedule.updatedAt = new Date();

    expect(schedule.id).toBe('schedule-uuid-1');
    expect(schedule.databaseId).toBe('db-uuid-1');
    expect(schedule.cronExpression).toBe('0 2 * * *');
    expect(schedule.retentionDays).toBe(14);
    expect(schedule.isActive).toBe(true);
  });
});
