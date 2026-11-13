import {
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac } from 'node:crypto';
import { NotificationWebhook } from './entities/notification-webhook.entity.js';
import { Project } from '../projects/entities/project.entity.js';
import { CreateNotificationWebhookDto } from './dto/create-notification-webhook.dto.js';
import { UpdateNotificationWebhookDto } from './dto/update-notification-webhook.dto.js';
import { NotificationProviderType } from './enums/notification-provider-type.enum.js';
import { NotificationEvent } from './enums/notification-event.enum.js';
import {
  DeploymentNotificationPayload,
  WebhookDeliveryResult,
} from './interfaces/notification-payload.interface.js';
import { EmailService } from './services/email.service.js';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly defaultEvents: NotificationEvent[] = [
    NotificationEvent.DEPLOY_STARTED,
    NotificationEvent.DEPLOY_SUCCEEDED,
    NotificationEvent.DEPLOY_FAILED,
  ];

  constructor(
    @Optional()
    @InjectRepository(NotificationWebhook)
    private readonly webhookRepository?: Repository<NotificationWebhook>,
    @Optional()
    @InjectRepository(Project)
    private readonly projectRepository?: Repository<Project>,
    @Optional()
    private readonly emailService?: EmailService,
  ) {}

  getEmailService(): EmailService | undefined {
    return this.emailService;
  }

  private async verifyProjectOwnership(
    userId: string,
    projectId: string,
  ): Promise<Project> {
    if (!this.projectRepository) {
      throw new NotFoundException(`Proyecto #${projectId} no encontrado`);
    }

    const project = await this.projectRepository.findOne({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new NotFoundException(
        `Proyecto #${projectId} no encontrado o no pertenece al usuario autenticado.`,
      );
    }

    return project;
  }

  async create(
    userId: string,
    projectId: string,
    dto: CreateNotificationWebhookDto,
  ): Promise<NotificationWebhook> {
    await this.verifyProjectOwnership(userId, projectId);

    const webhook = this.webhookRepository!.create({
      projectId,
      name: dto.name.trim(),
      type: dto.type,
      url: dto.url.trim(),
      events: dto.events?.length ? dto.events : [...this.defaultEvents],
      secret: dto.secret?.trim() || null,
      isActive: dto.isActive ?? true,
    });

    return this.webhookRepository!.save(webhook);
  }

  async findByProject(
    userId: string,
    projectId: string,
  ): Promise<NotificationWebhook[]> {
    await this.verifyProjectOwnership(userId, projectId);

    return this.webhookRepository!.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(
    userId: string,
    projectId: string,
    id: string,
  ): Promise<NotificationWebhook> {
    await this.verifyProjectOwnership(userId, projectId);

    const webhook = await this.webhookRepository!.findOne({
      where: { id, projectId },
    });

    if (!webhook) {
      throw new NotFoundException(
        `Webhook de notificación #${id} no encontrado en el proyecto #${projectId}.`,
      );
    }

    return webhook;
  }

  async update(
    userId: string,
    projectId: string,
    id: string,
    dto: UpdateNotificationWebhookDto,
  ): Promise<NotificationWebhook> {
    const webhook = await this.findOne(userId, projectId, id);

    if (dto.name !== undefined) {
      webhook.name = dto.name.trim();
    }
    if (dto.type !== undefined) {
      webhook.type = dto.type;
    }
    if (dto.url !== undefined) {
      webhook.url = dto.url.trim();
    }
    if (dto.events !== undefined) {
      webhook.events = dto.events;
    }
    if (dto.secret !== undefined) {
      webhook.secret = dto.secret.trim() || null;
    }
    if (dto.isActive !== undefined) {
      webhook.isActive = dto.isActive;
    }

    return this.webhookRepository!.save(webhook);
  }

  async remove(
    userId: string,
    projectId: string,
    id: string,
  ): Promise<{ message: string }> {
    const webhook = await this.findOne(userId, projectId, id);
    await this.webhookRepository!.remove(webhook);

    return {
      message: `Webhook "${webhook.name}" eliminado exitosamente`,
    };
  }

  async testWebhook(
    userId: string,
    projectId: string,
    id: string,
  ): Promise<WebhookDeliveryResult> {
    const project = await this.verifyProjectOwnership(userId, projectId);
    const webhook = await this.findOne(userId, projectId, id);

    const testPayload: DeploymentNotificationPayload = {
      event: NotificationEvent.DEPLOY_SUCCEEDED,
      projectId: project.id,
      projectName: project.name,
      repositoryName: project.repositoryName,
      branch: project.branch || 'main',
      commitSha: 'test000000000000000000000000000000000000',
      commitMessage: 'Test notification from TitanPaaS',
      author: 'TitanPaaS',
      durationMs: 1200,
      timestamp: new Date().toISOString(),
    };

    return this.deliverToWebhook(webhook, testPayload);
  }

  async notifyDeploymentEvent(
    event: NotificationEvent,
    payload: Omit<DeploymentNotificationPayload, 'event' | 'timestamp'>,
  ): Promise<WebhookDeliveryResult[]> {
    if (!payload.projectId) {
      return [];
    }

    // Despachar alerta por correo al propietario si el despliegue fallo
    if (event === NotificationEvent.DEPLOY_FAILED) {
      await this.handleDeploymentFailureEmail(payload);
    }

    if (!this.webhookRepository) {
      return [];
    }

    try {
      const webhooks = await this.webhookRepository.find({
        where: { projectId: payload.projectId, isActive: true },
      });

      const matching = webhooks.filter(
        (wh) => Array.isArray(wh.events) && wh.events.includes(event),
      );

      if (matching.length === 0) {
        return [];
      }

      const fullPayload: DeploymentNotificationPayload = {
        ...payload,
        event,
        timestamp: new Date().toISOString(),
      };

      const settled = await Promise.allSettled(
        matching.map((wh) => this.deliverToWebhook(wh, fullPayload)),
      );

      return settled.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        }
        return {
          webhookId: matching[index].id,
          delivered: false,
          error: (result.reason as Error)?.message || 'Unknown delivery error',
        };
      });
    } catch (error) {
      this.logger.error(
        `Error al despachar notificaciones para proyecto ${payload.projectId}: ${(error as Error).message}`,
      );
      return [];
    }
  }

  private async handleDeploymentFailureEmail(
    payload: Omit<DeploymentNotificationPayload, 'event' | 'timestamp'>,
  ): Promise<void> {
    if (!this.emailService) {
      return;
    }

    try {
      let recipientEmail = payload.userEmail;
      let recipientName = payload.userName;

      if (!recipientEmail && this.projectRepository) {
        const project = await this.projectRepository.findOne({
          where: { id: payload.projectId },
          relations: ['user'],
        });
        if (project?.user?.email) {
          recipientEmail = project.user.email;
          recipientName = project.user.name;
        }
      }

      if (!recipientEmail) {
        this.logger.debug(
          `[NotificationsService] No se encontro correo electronico para el proyecto ${payload.projectId}. Omitiendo alerta por email.`,
        );
        return;
      }

      await this.emailService.sendDeploymentFailureAlert({
        to: recipientEmail,
        userName: recipientName,
        projectId: payload.projectId,
        projectName: payload.projectName,
        repositoryName: payload.repositoryName,
        deploymentId: payload.deploymentId,
        branch: payload.branch,
        commitSha: payload.commitSha,
        commitMessage: payload.commitMessage,
        author: payload.author,
        durationMs: payload.durationMs,
        errorMessage: payload.errorMessage,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      this.logger.error(
        `[NotificationsService] Error inesperado al procesar alerta por correo: ${(err as Error).message}`,
      );
    }
  }

  buildProviderPayload(
    webhook: NotificationWebhook,
    payload: DeploymentNotificationPayload,
  ): Record<string, unknown> {
    const meta = this.getEventMetadata(payload.event);
    const shortCommit = payload.commitSha
      ? payload.commitSha.substring(0, 7)
      : 'HEAD';

    if (webhook.type === NotificationProviderType.DISCORD) {
      const fields: Array<{ name: string; value: string; inline: boolean }> = [
        { name: 'Proyecto', value: payload.projectName, inline: true },
        { name: 'Rama', value: payload.branch, inline: true },
        { name: 'Commit', value: `\`${shortCommit}\``, inline: true },
      ];

      if (payload.author) {
        fields.push({ name: 'Autor', value: payload.author, inline: true });
      }
      if (payload.durationMs !== undefined) {
        fields.push({
          name: 'Duración',
          value: `${(payload.durationMs / 1000).toFixed(2)}s`,
          inline: true,
        });
      }
      if (payload.url) {
        fields.push({ name: 'URL', value: payload.url, inline: false });
      }
      if (payload.errorMessage) {
        fields.push({
          name: 'Error',
          value: payload.errorMessage.slice(0, 1000),
          inline: false,
        });
      }

      return {
        username: 'TitanPaaS',
        embeds: [
          {
            title: `${meta.emoji} ${meta.title}`,
            description: payload.commitMessage || payload.repositoryName,
            color: meta.discordColor,
            fields,
            timestamp: payload.timestamp,
          },
        ],
      };
    }

    if (webhook.type === NotificationProviderType.SLACK) {
      const fields: Array<{ title: string; value: string; short: boolean }> = [
        { title: 'Proyecto', value: payload.projectName, short: true },
        { title: 'Rama', value: payload.branch, short: true },
        { title: 'Commit', value: shortCommit, short: true },
      ];

      if (payload.author) {
        fields.push({ title: 'Autor', value: payload.author, short: true });
      }
      if (payload.durationMs !== undefined) {
        fields.push({
          title: 'Duración',
          value: `${(payload.durationMs / 1000).toFixed(2)}s`,
          short: true,
        });
      }
      if (payload.url) {
        fields.push({ title: 'URL', value: payload.url, short: false });
      }
      if (payload.errorMessage) {
        fields.push({
          title: 'Error',
          value: payload.errorMessage.slice(0, 1000),
          short: false,
        });
      }

      return {
        text: `${meta.emoji} *${meta.title}* - ${payload.projectName} (${payload.branch})`,
        attachments: [
          {
            color: meta.slackColor,
            title: payload.commitMessage || payload.repositoryName,
            fields,
            ts: Math.floor(new Date(payload.timestamp).getTime() / 1000),
          },
        ],
      };
    }

    return {
      event: payload.event,
      timestamp: payload.timestamp,
      project: {
        id: payload.projectId,
        name: payload.projectName,
        repositoryName: payload.repositoryName,
      },
      deployment: {
        id: payload.deploymentId,
        branch: payload.branch,
        commitSha: payload.commitSha,
        commitMessage: payload.commitMessage,
        author: payload.author,
        url: payload.url,
        durationMs: payload.durationMs,
        errorMessage: payload.errorMessage,
      },
    };
  }

  async deliverToWebhook(
    webhook: NotificationWebhook,
    payload: DeploymentNotificationPayload,
  ): Promise<WebhookDeliveryResult> {
    const bodyObject = this.buildProviderPayload(webhook, payload);
    const bodyString = JSON.stringify(bodyObject);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'TitanPaaS-Webhook/1.0',
      'X-TitanPaaS-Event': payload.event,
    };

    if (webhook.secret) {
      const signature = createHmac('sha256', webhook.secret)
        .update(bodyString)
        .digest('hex');
      headers['X-TitanPaaS-Signature'] = `sha256=${signature}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: bodyString,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = `HTTP ${response.status}`;
        this.logger.warn(
          `Fallo al enviar notificación a "${webhook.name}" (${webhook.type}): ${errorText}`,
        );
        return {
          webhookId: webhook.id,
          delivered: false,
          statusCode: response.status,
          error: errorText,
        };
      }

      return {
        webhookId: webhook.id,
        delivered: true,
        statusCode: response.status,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      const message = (error as Error).message || 'Network error';
      this.logger.warn(
        `Error de red enviando notificación a "${webhook.name}" (${webhook.type}): ${message}`,
      );
      return {
        webhookId: webhook.id,
        delivered: false,
        error: message,
      };
    }
  }

  private getEventMetadata(event: NotificationEvent): {
    title: string;
    emoji: string;
    discordColor: number;
    slackColor: string;
  } {
    switch (event) {
      case NotificationEvent.DEPLOY_STARTED:
        return {
          title: 'Despliegue iniciado',
          emoji: '🚀',
          discordColor: 3447003,
          slackColor: '#3498db',
        };
      case NotificationEvent.DEPLOY_SUCCEEDED:
        return {
          title: 'Despliegue completado exitosamente',
          emoji: '✅',
          discordColor: 3066993,
          slackColor: '#2ecc71',
        };
      case NotificationEvent.DEPLOY_FAILED:
        return {
          title: 'Despliegue fallido',
          emoji: '❌',
          discordColor: 15158332,
          slackColor: '#e74c3c',
        };
    }
  }
}
