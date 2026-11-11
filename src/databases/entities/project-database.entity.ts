import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
  Index,
  Unique,
  type Relation,
} from 'typeorm';
import { DatabaseType } from '../enums/database-type.enum.js';
import { DatabaseStatus } from '../enums/database-status.enum.js';
import type { Project } from '../../projects/entities/project.entity.js';
import type { DatabaseBackup } from './database-backup.entity.js';
import type { BackupSchedule } from './backup-schedule.entity.js';

@Entity('project_databases')
@Unique(['projectId', 'name'])
export class ProjectDatabase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', enum: DatabaseType })
  type: DatabaseType;

  @Column({ type: 'varchar' })
  version: string;

  @Column({
    type: 'varchar',
    enum: DatabaseStatus,
    default: DatabaseStatus.PROVISIONING,
  })
  status: DatabaseStatus;

  @Column({ type: 'varchar', name: 'container_name' })
  containerName: string;

  @Column({ type: 'varchar', nullable: true, name: 'container_id' })
  containerId: string | null;

  @Column({ type: 'varchar', name: 'volume_name' })
  volumeName: string;

  @Column({ type: 'int' })
  port: number;

  @Column({ type: 'varchar', nullable: true, name: 'database_name' })
  databaseName: string | null;

  @Column({ type: 'varchar', nullable: true })
  username: string | null;

  @Column({ type: 'varchar' })
  password: string;

  @Column({ type: 'varchar', name: 'connection_url' })
  connectionUrl: string;

  @Column({ type: 'uuid', name: 'project_id' })
  @Index()
  projectId: string;

  @ManyToOne('Project', 'databases', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Relation<Project>;

  @OneToMany('DatabaseBackup', 'database')
  backups?: Relation<DatabaseBackup>[];

  @OneToOne('BackupSchedule', 'database')
  backupSchedule?: Relation<BackupSchedule>;

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', name: 'updated_at' })
  updatedAt: Date;
}
