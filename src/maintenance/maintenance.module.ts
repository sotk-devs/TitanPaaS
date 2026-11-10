import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MAINTENANCE_QUEUE } from './maintenance.constants.js';
import { DockerPruneService } from './docker-prune.service.js';
import { WorkspaceCleanerService } from './workspace-cleaner.service.js';
import { GarbageCollectorService } from './garbage-collector.service.js';
import { GarbageCollectorWorker } from './garbage-collector.worker.js';
import { MaintenanceSchedulerService } from './maintenance-scheduler.service.js';
import { MaintenanceController } from './maintenance.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    BullModule.registerQueue({
      name: MAINTENANCE_QUEUE,
    }),
    AuthModule,
  ],
  controllers: [MaintenanceController],
  providers: [
    DockerPruneService,
    WorkspaceCleanerService,
    GarbageCollectorService,
    GarbageCollectorWorker,
    MaintenanceSchedulerService,
  ],
  exports: [GarbageCollectorService, MaintenanceSchedulerService],
})
export class MaintenanceModule {}
