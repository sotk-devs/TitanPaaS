import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DEPLOY_QUEUE } from './webhooks.constants.js';
import { WebhooksController } from './webhooks.controller.js';
import { WebhooksService } from './webhooks.service.js';
import { GitHubSignatureGuard } from './guards/github-signature.guard.js';

@Module({
  imports: [
    BullModule.registerQueue({
      name: DEPLOY_QUEUE,
    }),
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService, GitHubSignatureGuard],
  exports: [WebhooksService],
})
export class WebhooksModule {}
