import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
  type Relation,
} from 'typeorm';
import type { Project } from '../../projects/entities/project.entity.js';
import type { Team } from '../../teams/entities/team.entity.js';
import type { TeamMember } from '../../teams/entities/team-member.entity.js';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  @Index({ unique: true })
  email: string;

  @Column({ type: 'varchar', nullable: true })
  password?: string | null;

  @Column({ type: 'varchar', nullable: true, unique: true, name: 'github_id' })
  @Index({ unique: true })
  githubId?: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'github_username' })
  githubUsername?: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'avatar_url' })
  avatarUrl?: string | null;

  @Column({ type: 'text', nullable: true, name: 'github_access_token' })
  githubAccessToken?: string | null;

  @Column({ type: 'varchar' })
  name: string;

  @OneToMany('Project', 'user')
  projects: Relation<Project>[];

  @OneToMany('Team', 'owner')
  ownedTeams?: Relation<Team>[];

  @OneToMany('TeamMember', 'user')
  teamMemberships?: Relation<TeamMember>[];

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', name: 'updated_at' })
  updatedAt: Date;
}
