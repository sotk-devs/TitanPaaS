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
import type { TeamMember } from './team-member.entity.js';
import type { Project } from '../../projects/entities/project.entity.js';

@Entity('teams')
export class Team {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', unique: true })
  @Index({ unique: true })
  slug: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  description: string | null;

  @Column({ type: 'uuid', name: 'owner_id' })
  @Index()
  ownerId: string;

  @ManyToOne('User', 'ownedTeams', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner: Relation<User>;

  @OneToMany('TeamMember', 'team')
  members: Relation<TeamMember>[];

  @OneToMany('Project', 'team')
  projects?: Relation<Project>[];

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', name: 'updated_at' })
  updatedAt: Date;
}
