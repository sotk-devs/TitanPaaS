import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  type Relation,
} from 'typeorm';
import type { User } from '../../users/entities/user.entity.js';
import { AuditAction } from '../enums/audit-action.enum.js';
import { AuditResourceType } from '../enums/audit-resource-type.enum.js';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  @Index()
  userId: string | null;

  @ManyToOne('User', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: Relation<User> | null;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  action: AuditAction;

  @Column({ type: 'varchar', length: 50, name: 'resource_type' })
  @Index()
  resourceType: AuditResourceType;

  @Column({ type: 'varchar', length: 255, name: 'resource_id', nullable: true })
  @Index()
  resourceId: string | null;

  @Column({ type: 'uuid', name: 'project_id', nullable: true })
  @Index()
  projectId: string | null;

  @Column({ type: 'jsonb', default: {} })
  details: Record<string, unknown>;

  @Column({ type: 'varchar', length: 64, name: 'ip_address', nullable: true })
  ipAddress: string | null;

  @Column({ type: 'varchar', length: 255, name: 'user_agent', nullable: true })
  userAgent: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  @Index()
  createdAt: Date;
}
