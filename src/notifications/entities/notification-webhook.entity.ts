import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  type Relation,
} from 'typeorm';
import type { Project } from '../../projects/entities/project.entity.js';
import { NotificationProviderType } from '../enums/notification-provider-type.enum.js';
import { NotificationEvent } from '../enums/notification-event.enum.js';

@Entity('notification_webhooks')
export class NotificationWebhook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'project_id' })
  @Index()
  projectId: string;

  @ManyToOne('Project', 'notificationWebhooks', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Relation<Project>;

  @Column({ type: 'varchar' })
  name: string;

  @Column({
    type: 'enum',
    enum: NotificationProviderType,
    default: NotificationProviderType.WEBHOOK,
  })
  type: NotificationProviderType;

  @Column({ type: 'varchar' })
  url: string;

  @Column({
    type: 'jsonb',
    default: [
      NotificationEvent.DEPLOY_STARTED,
      NotificationEvent.DEPLOY_SUCCEEDED,
      NotificationEvent.DEPLOY_FAILED,
    ],
  })
  events: NotificationEvent[];

  @Column({ type: 'varchar', nullable: true, default: null })
  secret: string | null;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', name: 'updated_at' })
  updatedAt: Date;
}
