import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationProviderType } from '../enums/notification-provider-type.enum.js';
import { NotificationEvent } from '../enums/notification-event.enum.js';

export class CreateNotificationWebhookDto {
  @ApiProperty({
    example: 'Discord #deploys',
    description: 'Nombre descriptivo del canal de notificación',
    minLength: 2,
  })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  name: string;

  @ApiProperty({
    enum: NotificationProviderType,
    example: NotificationProviderType.DISCORD,
    description: 'Tipo de proveedor del webhook saliente',
  })
  @IsEnum(NotificationProviderType, {
    message: 'El tipo debe ser DISCORD, SLACK o WEBHOOK',
  })
  type: NotificationProviderType;

  @ApiProperty({
    example: 'https://discord.com/api/webhooks/123456/abcdef',
    description: 'URL de destino para el webhook saliente',
  })
  @IsUrl(
    {
      require_tld: false,
      protocols: ['http', 'https'],
      require_protocol: true,
    },
    { message: 'La URL del webhook debe ser una URL HTTP/HTTPS válida' },
  )
  @IsNotEmpty({ message: 'La URL es obligatoria' })
  url: string;

  @ApiPropertyOptional({
    enum: NotificationEvent,
    isArray: true,
    example: [
      NotificationEvent.DEPLOY_STARTED,
      NotificationEvent.DEPLOY_SUCCEEDED,
      NotificationEvent.DEPLOY_FAILED,
    ],
    description: 'Eventos de despliegue que dispararán la notificación',
  })
  @IsOptional()
  @IsArray({ message: 'Los eventos deben ser un arreglo' })
  @ArrayNotEmpty({ message: 'Debe seleccionar al menos un evento' })
  @IsEnum(NotificationEvent, {
    each: true,
    message:
      'Cada evento debe ser DEPLOY_STARTED, DEPLOY_SUCCEEDED o DEPLOY_FAILED',
  })
  events?: NotificationEvent[];

  @ApiPropertyOptional({
    example: 'my-webhook-signing-secret',
    description:
      'Secreto opcional para firmar payloads personalizados con HMAC-SHA256',
  })
  @IsOptional()
  @IsString({ message: 'El secreto debe ser una cadena de texto' })
  secret?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Indica si el webhook está activo',
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'isActive debe ser un valor booleano' })
  isActive?: boolean;
}
