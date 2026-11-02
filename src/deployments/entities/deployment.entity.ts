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
import { DeploymentStatus } from '../enums/deployment-status.enum.js';
import type { Project } from '../../projects/entities/project.entity.js';

@Entity('deployments')
export class Deployment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'project_id' })
  @Index()
  projectId: string;

  @ManyToOne('Project', 'deployments', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'project_id' })
  project: Relation<Project>;

  @Column({
    type: 'enum',
    enum: DeploymentStatus,
    default: DeploymentStatus.PENDING,
  })
  @Index()
  status: DeploymentStatus;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'commit_sha' })
  commitSha: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'commit_message' })
  commitMessage: string | null;

  @Column({ type: 'varchar', default: 'main' })
  branch: string;

  @Column({ type: 'text', nullable: true })
  logs: string | null;

  @Column({ type: 'jsonb', nullable: true })
  stages: Record<string, any>[] | null;

  @Column({
    type: 'varchar',
    length: 128,
    nullable: true,
    name: 'container_id',
  })
  containerId: string | null;

  @Column({
    type: 'timestamp with time zone',
    nullable: true,
    name: 'started_at',
  })
  startedAt: Date | null;

  @Column({
    type: 'timestamp with time zone',
    nullable: true,
    name: 'finished_at',
  })
  finishedAt: Date | null;

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', name: 'updated_at' })
  updatedAt: Date;
}
