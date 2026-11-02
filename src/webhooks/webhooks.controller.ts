import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { WebhooksService } from './webhooks.service.js';
import { GitHubSignatureGuard } from './guards/github-signature.guard.js';
import { GitHubPushPayload } from './interfaces/github-payload.interface.js';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('github')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(GitHubSignatureGuard)
  async handleGitHubWebhook(
    @Headers('x-github-event') event: string,
    @Headers('x-github-delivery') deliveryId: string,
    @Body() payload: Record<string, unknown>,
  ) {
    if (!event) {
      throw new BadRequestException('Missing x-github-event header');
    }

    if (event === 'ping') {
      return {
        status: 'ok',
        event: 'ping',
        message: 'Pong! GitHub webhook received successfully.',
        hookId: payload.hook_id,
      };
    }

    if (event === 'push') {
      const pushPayload = payload as unknown as GitHubPushPayload;
      if (!pushPayload.ref || !pushPayload.repository?.full_name) {
        throw new BadRequestException('Invalid GitHub push payload structure');
      }

      return this.webhooksService.processPushEvent(pushPayload, deliveryId);
    }

    return {
      status: 'ignored',
      event,
      message: `Event '${event}' acknowledged but ignored.`,
    };
  }
}
