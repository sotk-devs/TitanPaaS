import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Deployment } from './entities/deployment.entity.js';
import { Project } from '../projects/entities/project.entity.js';
import { DeploymentsService } from './deployments.service.js';
import { DeploymentsController } from './deployments.controller.js';
import { DEPLOY_QUEUE } from '../webhooks/webhooks.constants.js';
import { DeploymentModule } from '../deployment/deployment.module.js';
import { LogsModule } from '../logs/logs.module.js';
import { TeamsModule } from '../teams/teams.module.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Deployment, Project]),
    BullModule.registerQueue({
      name: DEPLOY_QUEUE,
    }),
    DeploymentModule,
    LogsModule,
    TeamsModule,
    AuditModule,
  ],
  controllers: [DeploymentsController],
  providers: [DeploymentsService],
  exports: [DeploymentsService],
})
export class DeploymentsModule {}
