import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { WebhooksService } from '../webhooks.service.js';

@Injectable()
export class GitHubSignatureGuard implements CanActivate {
  private readonly logger = new Logger(GitHubSignatureGuard.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const secret = process.env.GITHUB_WEBHOOK_SECRET;

    // If no secret is configured (e.g. in local development), allow through with warning
    if (!secret) {
      this.logger.warn(
        'GITHUB_WEBHOOK_SECRET is not configured; skipping signature verification.',
      );
      return true;
    }

    const signature = request.headers['x-hub-signature-256'] as
      string | undefined;
    if (!signature) {
      throw new UnauthorizedException(
        'Missing GitHub webhook signature header (x-hub-signature-256)',
      );
    }

    const rawPayload =
      (request as Request & { rawBody?: Buffer }).rawBody ||
      JSON.stringify(request.body);

    const isValid = this.webhooksService.verifySignature(
      rawPayload,
      signature,
      secret,
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid GitHub webhook signature');
    }

    return true;
  }
}
