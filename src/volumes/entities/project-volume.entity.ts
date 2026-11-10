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

@Entity('project_volumes')
@Index(['projectId', 'mountPath'], { unique: true })
export class ProjectVolume {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', name: 'volume_name', unique: true })
  @Index({ unique: true })
  volumeName: string;

  @Column({ type: 'varchar', name: 'mount_path' })
  mountPath: string;

  @Column({ type: 'boolean', default: false, name: 'read_only' })
  readOnly: boolean;

  @Column({ type: 'varchar', nullable: true })
  size?: string | null;

  @Column({ type: 'uuid', name: 'project_id' })
  @Index()
  projectId: string;

  @ManyToOne('Project', 'volumes', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Relation<Project>;

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', name: 'updated_at' })
  updatedAt: Date;
}
