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
import { BackupStatus } from '../enums/backup-status.enum.js';
import { BackupTrigger } from '../enums/backup-trigger.enum.js';
import type { ProjectDatabase } from './project-database.entity.js';

@Entity('database_backups')
export class DatabaseBackup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'database_id' })
  @Index()
  databaseId: string;

  @ManyToOne('ProjectDatabase', 'backups', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'database_id' })
  database: Relation<ProjectDatabase>;

  @Column({ type: 'uuid', name: 'project_id' })
  @Index()
  projectId: string;

  @Column({ type: 'varchar', name: 'file_name' })
  fileName: string;

  @Column({ type: 'bigint', name: 'file_size', default: 0 })
  fileSize: number;

  @Column({ type: 'varchar', name: 'storage_key' })
  storageKey: string;

  @Column({ type: 'varchar', name: 'storage_bucket' })
  storageBucket: string;

  @Column({
    type: 'varchar',
    enum: BackupStatus,
    default: BackupStatus.PENDING,
  })
  status: BackupStatus;

  @Column({
    type: 'varchar',
    enum: BackupTrigger,
    default: BackupTrigger.MANUAL,
  })
  trigger: BackupTrigger;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage: string | null;

  @Column({
    type: 'timestamp with time zone',
    nullable: true,
    name: 'completed_at',
  })
  completedAt: Date | null;

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', name: 'updated_at' })
  updatedAt: Date;
}
