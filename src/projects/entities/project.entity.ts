import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  type Relation,
} from 'typeorm';
import type { User } from '../../users/entities/user.entity.js';
import type { Deployment } from '../../deployments/entities/deployment.entity.js';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', name: 'repository_url' })
  repositoryUrl: string;

  @Column({ type: 'varchar', name: 'repository_name' })
  @Index()
  repositoryName: string;

  @Column({ type: 'varchar', default: 'main' })
  branch: string;

  @Column({ type: 'int', default: 3000 })
  port: number;

  @Column({ type: 'jsonb', default: {}, name: 'env_variables' })
  envVariables: Record<string, string>;

  @Column({ type: 'float', nullable: true, name: 'cpu_limit' })
  cpuLimit?: number | null;

  @Column({ type: 'varchar', nullable: true, name: 'memory_limit' })
  memoryLimit?: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'memory_swap' })
  memorySwap?: string | null;

  @Column({ type: 'uuid', name: 'user_id' })
  @Index()
  userId: string;

  @ManyToOne('User', 'projects', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @OneToMany('Deployment', 'project')
  deployments: Relation<Deployment>[];

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', name: 'updated_at' })
  updatedAt: Date;
}
