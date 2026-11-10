import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DEPLOY_QUEUE } from '../webhooks/webhooks.constants.js';
import { DeploymentWorker } from './deployment.worker.js';
import { DockerPipelineService } from './docker-pipeline.service.js';
import { Project } from '../projects/entities/project.entity.js';
import { Deployment } from '../deployments/entities/deployment.entity.js';
import { LogsModule } from '../logs/logs.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

const databaseImports =
  process.env.NODE_ENV !== 'test'
    ? [TypeOrmModule.forFeature([Project, Deployment]), NotificationsModule]
    : [];

@Module({
  imports: [
    BullModule.registerQueue({
      name: DEPLOY_QUEUE,
    }),
    LogsModule,
    ...databaseImports,
  ],
  providers: [DeploymentWorker, DockerPipelineService],
  exports: [DeploymentWorker, DockerPipelineService],
})
export class DeploymentModule {}
