import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DEPLOY_QUEUE } from './webhooks.constants.js';
import { WebhooksController } from './webhooks.controller.js';
import { WebhooksService } from './webhooks.service.js';
import { GitHubSignatureGuard } from './guards/github-signature.guard.js';
import { Project } from '../projects/entities/project.entity.js';
import { Deployment } from '../deployments/entities/deployment.entity.js';

const databaseImports =
  process.env.NODE_ENV !== 'test'
    ? [TypeOrmModule.forFeature([Project, Deployment])]
    : [];

@Module({
  imports: [
    BullModule.registerQueue({
      name: DEPLOY_QUEUE,
    }),
    ...databaseImports,
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService, GitHubSignatureGuard],
  exports: [WebhooksService],
})
export class WebhooksModule {}
