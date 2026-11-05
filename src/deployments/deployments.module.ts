import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Deployment } from './entities/deployment.entity.js';
import { Project } from '../projects/entities/project.entity.js';
import { DeploymentsService } from './deployments.service.js';
import { DeploymentsController } from './deployments.controller.js';
import { DEPLOY_QUEUE } from '../webhooks/webhooks.constants.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Deployment, Project]),
    BullModule.registerQueue({
      name: DEPLOY_QUEUE,
    }),
  ],
  controllers: [DeploymentsController],
  providers: [DeploymentsService],
  exports: [DeploymentsService],
})
export class DeploymentsModule {}
