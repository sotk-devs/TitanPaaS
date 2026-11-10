import { PartialType } from '@nestjs/swagger';
import { CreateNotificationWebhookDto } from './create-notification-webhook.dto.js';

export class UpdateNotificationWebhookDto extends PartialType(
  CreateNotificationWebhookDto,
) {}
