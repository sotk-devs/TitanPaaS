import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DEPLOY_QUEUE } from '../webhooks/webhooks.constants.js';
import { DeploymentWorker } from './deployment.worker.js';

@Module({
  imports: [
    BullModule.registerQueue({
      name: DEPLOY_QUEUE,
    }),
  ],
  providers: [DeploymentWorker],
  exports: [DeploymentWorker],
})
export class DeploymentModule {}
