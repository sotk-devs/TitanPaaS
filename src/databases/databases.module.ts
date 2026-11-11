import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectDatabase } from './entities/project-database.entity.js';
import { DatabaseBackup } from './entities/database-backup.entity.js';
import { BackupSchedule } from './entities/backup-schedule.entity.js';
import { Project } from '../projects/entities/project.entity.js';
import { DeploymentModule } from '../deployment/deployment.module.js';
import { DatabasesService } from './databases.service.js';
import { DatabasesDockerService } from './databases-docker.service.js';
import { DatabasesController } from './databases.controller.js';
import { S3StorageService } from './storage/s3-storage.service.js';
import { DatabaseDumpService } from './services/database-dump.service.js';
import { DatabaseBackupsService } from './services/database-backups.service.js';
import { DatabaseBackupsController } from './controllers/database-backups.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProjectDatabase,
      Project,
      DatabaseBackup,
      BackupSchedule,
    ]),
    DeploymentModule,
  ],
  controllers: [DatabasesController, DatabaseBackupsController],
  providers: [
    DatabasesService,
    DatabasesDockerService,
    S3StorageService,
    DatabaseDumpService,
    DatabaseBackupsService,
  ],
  exports: [
    DatabasesService,
    DatabasesDockerService,
    S3StorageService,
    DatabaseDumpService,
    DatabaseBackupsService,
  ],
})
export class DatabasesModule {}
