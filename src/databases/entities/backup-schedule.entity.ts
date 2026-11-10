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
import type { ProjectDatabase } from './project-database.entity.js';

@Entity('backup_schedules')
export class BackupSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'database_id', unique: true })
  @Index()
  databaseId: string;

  @ManyToOne('ProjectDatabase', 'backupSchedule', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'database_id' })
  database: Relation<ProjectDatabase>;

  @Column({ type: 'varchar', name: 'cron_expression', default: '0 2 * * *' })
  cronExpression: string;

  @Column({ type: 'int', name: 'retention_days', default: 7 })
  retentionDays: number;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({
    type: 'timestamp with time zone',
    nullable: true,
    name: 'last_run_at',
  })
  lastRunAt: Date | null;

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', name: 'updated_at' })
  updatedAt: Date;
}
