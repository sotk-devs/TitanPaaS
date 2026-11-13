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
import {
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service.js';
import { GitHubSignatureGuard } from './guards/github-signature.guard.js';
import { GitHubPushPayload } from './interfaces/github-payload.interface.js';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('github')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(GitHubSignatureGuard)
  @ApiOperation({
    summary: 'Recibir eventos webhook de GitHub',
    description:
      'Procesa eventos `ping` y `push` enviados por GitHub para disparar despliegues automáticos cuando coincide el repositorio y la rama configurada.',
  })
  @ApiHeader({
    name: 'x-github-event',
    required: true,
    description: 'Tipo de evento enviado por GitHub (`ping`, `push`, etc.)',
    example: 'push',
  })
  @ApiHeader({
    name: 'x-github-delivery',
    required: false,
    description: 'Identificador único de entrega del webhook en GitHub',
    example: '72d3162e-cc78-11e3-81ab-4c9367dc0958',
  })
  @ApiHeader({
    name: 'x-hub-signature-256',
    required: false,
    description:
      'Firma HMAC-SHA256 del cuerpo de la petición cuando GITHUB_WEBHOOK_SECRET está configurado',
    example:
      'sha256=5a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b',
  })
  @ApiBody({
    description: 'Payload JSON enviado por GitHub Webhook',
    schema: {
      type: 'object',
      example: {
        ref: 'refs/heads/main',
        after: 'a1b2c3d4e5f67890abcdef1234567890abcdef12',
        repository: {
          full_name: 'sotk-devs/TitanPaaS',
          clone_url: 'https://github.com/sotk-devs/TitanPaaS.git',
        },
        head_commit: {
          id: 'a1b2c3d4e5f67890abcdef1234567890abcdef12',
          message: 'feat: update production config',
        },
      },
    },
  })
  @ApiResponse({
    status: 202,
    description:
      'Webhook aceptado (evento ping, push encolado para despliegue o evento ignorado).',
    schema: {
      example: {
        status: 'queued',
        jobId: '42',
        deploymentId: '550e8400-e29b-41d4-a716-446655440000',
        repository: 'sotk-devs/TitanPaaS',
        branch: 'main',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Falta el header x-github-event o el payload de push es inválido.',
  })
  @ApiResponse({
    status: 401,
    description: 'Firma HMAC-SHA256 inválida o ausente.',
  })
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
