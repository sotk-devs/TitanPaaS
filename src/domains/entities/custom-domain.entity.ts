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
import { DomainStatus } from '../enums/domain-status.enum.js';
import type { Project } from '../../projects/entities/project.entity.js';

@Entity('custom_domains')
export class CustomDomain {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  @Index({ unique: true })
  domain: string;

  @Column({ type: 'uuid', name: 'project_id' })
  @Index()
  projectId: string;

  @ManyToOne('Project', 'customDomains', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Relation<Project>;

  @Column({
    type: 'enum',
    enum: DomainStatus,
    default: DomainStatus.PENDING,
  })
  @Index()
  status: DomainStatus;

  @Column({ type: 'text', nullable: true, name: 'verification_error' })
  verificationError: string | null;

  @Column({
    type: 'timestamp with time zone',
    nullable: true,
    name: 'verified_at',
  })
  verifiedAt: Date | null;

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', name: 'updated_at' })
  updatedAt: Date;
}
