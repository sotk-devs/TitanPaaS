import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { DatabaseBackup } from '../entities/database-backup.entity.js';
import { BackupSchedule } from '../entities/backup-schedule.entity.js';
import { ProjectDatabase } from '../entities/project-database.entity.js';
import { DatabasesService } from '../databases.service.js';
import { DatabaseDumpService } from './database-dump.service.js';
import { S3StorageService } from '../storage/s3-storage.service.js';
import { BackupStatus } from '../enums/backup-status.enum.js';
import { BackupTrigger } from '../enums/backup-trigger.enum.js';
import { UpdateBackupScheduleDto } from '../dto/update-backup-schedule.dto.js';

@Injectable()
export class DatabaseBackupsService {
  private readonly logger = new Logger(DatabaseBackupsService.name);

  constructor(
    @InjectRepository(DatabaseBackup)
    private readonly backupRepository: Repository<DatabaseBackup>,
    @InjectRepository(BackupSchedule)
    private readonly scheduleRepository: Repository<BackupSchedule>,
    private readonly databasesService: DatabasesService,
    private readonly dumpService: DatabaseDumpService,
    private readonly storageService: S3StorageService,
  ) {}

  async verifyDatabaseOwnership(
    userId: string,
    projectId: string,
    databaseId: string,
  ): Promise<ProjectDatabase> {
    return await this.databasesService.findOne(userId, projectId, databaseId);
  }

  async createBackup(
    userId: string,
    projectId: string,
    databaseId: string,
    trigger = BackupTrigger.MANUAL,
  ): Promise<DatabaseBackup> {
    const database = await this.verifyDatabaseOwnership(
      userId,
      projectId,
      databaseId,
    );

    const initialFileName = this.dumpService.generateFileName(database);
    const storageKey = `backups/${projectId}/${databaseId}/${initialFileName}`;

    const backup = this.backupRepository.create({
      databaseId,
      projectId,
      fileName: initialFileName,
      storageKey,
      storageBucket: this.storageService.getBucketName(),
      status: BackupStatus.PENDING,
      trigger,
    });

    await this.backupRepository.save(backup);

    try {
      const dumpResult = await this.dumpService.dump(database);
      backup.fileName = dumpResult.fileName;
      backup.storageKey = `backups/${projectId}/${databaseId}/${dumpResult.fileName}`;

      const uploadResult = await this.storageService.uploadBuffer(
        backup.storageKey,
        dumpResult.buffer,
      );

      backup.fileSize = uploadResult.size;
      backup.status = BackupStatus.COMPLETED;
      backup.completedAt = new Date();

      const saved = await this.backupRepository.save(backup);
      this.logger.log(
        `Respaldo #${saved.id} (${saved.fileName}) completado exitosamente para la base de datos ${database.name}`,
      );
      return saved;
    } catch (err) {
      backup.status = BackupStatus.FAILED;
      backup.errorMessage = (err as Error).message;
      await this.backupRepository.save(backup);
      this.logger.error(
        `Fallo al generar respaldo para ${database.name}: ${(err as Error).message}`,
      );
      throw err;
    }
  }

  async findAllByDatabase(
    userId: string,
    projectId: string,
    databaseId: string,
  ): Promise<DatabaseBackup[]> {
    await this.verifyDatabaseOwnership(userId, projectId, databaseId);

    return await this.backupRepository.find({
      where: { databaseId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOneBackup(
    userId: string,
    projectId: string,
    databaseId: string,
    backupId: string,
  ): Promise<DatabaseBackup> {
    await this.verifyDatabaseOwnership(userId, projectId, databaseId);

    const backup = await this.backupRepository.findOne({
      where: { id: backupId, databaseId },
    });

    if (!backup) {
      throw new NotFoundException(
        `Respaldo #${backupId} no encontrado en esta base de datos`,
      );
    }

    return backup;
  }

  async restoreBackup(
    userId: string,
    projectId: string,
    databaseId: string,
    backupId: string,
  ): Promise<{ message: string; backup: DatabaseBackup }> {
    const database = await this.verifyDatabaseOwnership(
      userId,
      projectId,
      databaseId,
    );
    const backup = await this.findOneBackup(
      userId,
      projectId,
      databaseId,
      backupId,
    );

    if (backup.status !== BackupStatus.COMPLETED) {
      throw new BadRequestException(
        'El respaldo no esta en estado COMPLETED y no puede ser restaurado',
      );
    }

    backup.status = BackupStatus.RESTORING;
    await this.backupRepository.save(backup);

    try {
      const buffer = await this.storageService.downloadBuffer(
        backup.storageKey,
      );
      await this.dumpService.restore(database, buffer);

      backup.status = BackupStatus.COMPLETED;
      await this.backupRepository.save(backup);

      return {
        message: `Base de datos "${database.name}" restaurada exitosamente desde el respaldo "${backup.fileName}"`,
        backup,
      };
    } catch (err) {
      backup.status = BackupStatus.COMPLETED;
      await this.backupRepository.save(backup);
      this.logger.error(
        `Error al restaurar respaldo #${backup.id}: ${(err as Error).message}`,
      );
      throw err;
    }
  }

  async deleteBackup(
    userId: string,
    projectId: string,
    databaseId: string,
    backupId: string,
  ): Promise<{ message: string }> {
    await this.verifyDatabaseOwnership(userId, projectId, databaseId);
    const backup = await this.findOneBackup(
      userId,
      projectId,
      databaseId,
      backupId,
    );

    await this.storageService.deleteObject(backup.storageKey);
    await this.backupRepository.remove(backup);

    return {
      message: `Respaldo "${backup.fileName}" eliminado exitosamente`,
    };
  }

  async getSchedule(
    userId: string,
    projectId: string,
    databaseId: string,
  ): Promise<BackupSchedule> {
    await this.verifyDatabaseOwnership(userId, projectId, databaseId);

    let schedule = await this.scheduleRepository.findOne({
      where: { databaseId },
    });

    if (!schedule) {
      schedule = this.scheduleRepository.create({
        databaseId,
        cronExpression: '0 2 * * *',
        retentionDays: 7,
        isActive: true,
      });
      schedule = await this.scheduleRepository.save(schedule);
    }

    return schedule;
  }

  async updateSchedule(
    userId: string,
    projectId: string,
    databaseId: string,
    dto: UpdateBackupScheduleDto,
  ): Promise<BackupSchedule> {
    await this.verifyDatabaseOwnership(userId, projectId, databaseId);

    let schedule = await this.scheduleRepository.findOne({
      where: { databaseId },
    });

    if (!schedule) {
      schedule = this.scheduleRepository.create({
        databaseId,
        cronExpression: dto.cronExpression || '0 2 * * *',
        retentionDays: dto.retentionDays || 7,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      });
    } else {
      if (dto.cronExpression !== undefined) {
        schedule.cronExpression = dto.cronExpression;
      }
      if (dto.retentionDays !== undefined) {
        schedule.retentionDays = dto.retentionDays;
      }
      if (dto.isActive !== undefined) {
        schedule.isActive = dto.isActive;
      }
    }

    return await this.scheduleRepository.save(schedule);
  }

  async deleteSchedule(
    userId: string,
    projectId: string,
    databaseId: string,
  ): Promise<{ message: string }> {
    await this.verifyDatabaseOwnership(userId, projectId, databaseId);

    const schedule = await this.scheduleRepository.findOne({
      where: { databaseId },
    });

    if (schedule) {
      await this.scheduleRepository.remove(schedule);
    }

    return {
      message: 'Programacion de respaldos eliminada exitosamente',
    };
  }

  async purgeOldBackups(
    databaseId: string,
    retentionDays: number,
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const expiredBackups = await this.backupRepository.find({
      where: {
        databaseId,
        createdAt: LessThan(cutoffDate),
      },
    });

    for (const backup of expiredBackups) {
      await this.storageService.deleteObject(backup.storageKey);
      await this.backupRepository.remove(backup);
    }

    return expiredBackups.length;
  }
}
