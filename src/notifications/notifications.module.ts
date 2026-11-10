import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationWebhook } from './entities/notification-webhook.entity.js';
import { Project } from '../projects/entities/project.entity.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationsController } from './notifications.controller.js';

const databaseImports =
  process.env.NODE_ENV !== 'test'
    ? [TypeOrmModule.forFeature([NotificationWebhook, Project])]
    : [];

@Module({
  imports: [...databaseImports],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
